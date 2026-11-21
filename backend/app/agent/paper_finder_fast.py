import asyncio
import logging
from langchain.chat_models import init_chat_model
from langchain.messages import SystemMessage
from langgraph.graph import START, END, StateGraph
from langgraph.prebuilt import ToolNode
from app.tools.search import s2_search_papers, google_search_grounding, tavily_research_overview, forward_snowball, backward_snowball
from app.core.config import settings
from app.agent.utils import get_paper_info_text
from flashrank import Ranker, RerankRequest
from app.core.schema import S2Paper
from typing import List, Annotated, Union
from langchain.agents import AgentState
from langgraph.prebuilt import tools_condition

logger = logging.getLogger(__name__)


MAX_PAPER_LIST_LENGTH = 20

model = init_chat_model(model=settings.PF_AGENT_MODEL_NAME)

tools = [google_search_grounding, s2_search_papers, forward_snowball, backward_snowball]
search_agent_model = model.bind_tools(tools)

# Initialize FlashRank in-process ONNX neural cross-encoder
ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2", cache_dir="./cache")


class Replace:
    def __init__(self, value: list):
        self.value = value

def flexible_reducer(current: list, update: Union[list, "Replace"]) -> list:
    if isinstance(update, Replace):
        return update.value
    seen = {p.paperId for p in current}
    return current + [p for p in update if p.paperId not in seen]

class SearchAgentState(AgentState):
    search_task: str
    rerank_query: str
    papers: Annotated[List[S2Paper], flexible_reducer]
    iter: int



async def search_agent_node(state: SearchAgentState):
    paper_info_text = get_paper_info_text(state.get("papers", []))
    search_query_prompt = f"""
    You are a senior research assistant who helps finding academic papers based on a user query.

    Your goal is to utilize the provided tools to help user find the most relevant papers to the user query.

    You have access to multiple search methods:
    1. Google Search Grounding (google_search_grounding): Use this when the research topic is general or unfamiliar.
       This helps you understand the research landscape and identify seminal papers using live web grounding.

    2. Academic database search (s2_search_papers): Search open academic database (OpenAlex + arXiv, 250M+ papers).
       Use keyword queries, filters by year, venue, citation count, etc. to find relevant papers.

    3. Citation chasing tools:
       - forward_snowball: Find papers that CITE your seed papers (recent work building on them)
       - backward_snowball: Find papers that your seed papers CITE (their foundations/references)
       Use these when you've found good papers and want to explore their citation network.

    Strategy tips:
    - If the user query is about a specific paper, use the academic database search with the title/author filters to find the paper and quickly finish the task. Never use citation chase (snowball) here unless specifically asked for.
    - If the user query is more general, you should follow the following strategy:
        - Start with web search if topic is unfamiliar to get context
        - Use academic database for targeted searches with filters
        - Use citation chasing to expand from good seed papers you've found

    Current papers in your list:
    {paper_info_text}

    Reflect on past actions and completed steps to decide what to do next.
    If you have sufficient results, stop and provide a concise summary of what you found.
    """

    response = await search_agent_model.ainvoke([
        SystemMessage(content=search_query_prompt),
        *state.get("messages", [])
    ])
    return {"messages": [response]}

search_tool_node = ToolNode(tools)

async def rerank_node(state: SearchAgentState):
    papers = state.get("papers", [])
    iter = state.get("iter", 0) + 1

    if not papers:
        return {"iter": iter}

    user_query = state.get("rerank_query", "")

    if not user_query or not user_query.strip():
        logger.warning("Skipping rerank: no query provided")
        return {"papers": Replace(papers[:MAX_PAPER_LIST_LENGTH]), "iter": iter}

    try:
        passages = [
            {
                "id": str(p.paperId),
                "text": f"Title: {p.title or ''}\nAbstract: {p.abstract or ''}",
                "meta": p.model_dump(),
            }
            for p in papers
        ]
        logger.debug("Reranking %d papers with query: %s...", len(passages), user_query[:50])
        reranked = ranker.rerank(RerankRequest(query=user_query, passages=passages))
        final_papers = [S2Paper.model_validate(r["meta"]) for r in reranked[:MAX_PAPER_LIST_LENGTH]]
        logger.info("Reranking successful: %d papers", len(final_papers))
    except Exception as e:
        logger.error("Reranking failed: %s: %s", type(e).__name__, e)
        final_papers = papers[:MAX_PAPER_LIST_LENGTH]

    return {"papers": Replace(final_papers), "iter": iter}

def my_tools_condition(state: SearchAgentState):
    if state.get("iter", 0) > 3:
        return "__end__"
    return tools_condition(state)

paper_finder_fast_graph = StateGraph(SearchAgentState)
paper_finder_fast_graph.add_node("search_agent", search_agent_node)
paper_finder_fast_graph.add_node("search_tool", search_tool_node)
paper_finder_fast_graph.add_node("rerank", rerank_node)

paper_finder_fast_graph.add_edge(START, "search_agent")
paper_finder_fast_graph.add_conditional_edges("search_agent", my_tools_condition, {"tools": "search_tool", "__end__": END})
paper_finder_fast_graph.add_edge("search_tool", "rerank")
paper_finder_fast_graph.add_edge("rerank", "search_agent")
paper_finder_fast_graph = paper_finder_fast_graph.compile()
