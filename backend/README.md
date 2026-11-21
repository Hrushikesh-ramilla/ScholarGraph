# ScholarGraph — Backend

A LangGraph-powered multi-agent research backend with two primary engines: **paper finding** (OpenAlex + arXiv federated search, native Google Search Grounding via Google GenAI SDK, and in-process FlashRank ONNX neural cross-encoder reranking) and **evidence-grounded Q&A** (scoped vector retrieval and synthesis over ingested literature via Qdrant).

## Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Docker & Docker Compose

## Quick Start

```bash
# 1. Copy and configure environment
cp backend/.env_example backend/.env
# Edit backend/.env — at minimum set GEMINI_API_KEY

# 2. Start all infrastructure
# Postgres (5432), Redis (6379), Qdrant (6333), Grobid (8070)
docker compose up -d

# 3. Start the Celery worker (in a separate terminal)
cd backend && uv run python -m celery -A app.celery_app worker --loglevel=info --pool=solo

# 4. Start the LangGraph dev server (in a separate terminal)
cd backend && uv run langgraph dev

# 5. Start the frontend (in a separate terminal, from project root)
cd web && pnpm dev
```

The backend API will be available at `http://localhost:2024`.

---

## Environment Variables

### LLM & Embedding APIs

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key — powers all agent reasoning loops, Google Search Grounding, and dense vector embeddings (`models/gemini-embedding-001`) |
| `OPENAI_API_KEY` | No | Optional legacy fallback for third-party OpenAI embedding models (`text-embedding-3-small`) |

### Model Configurations

All agents run natively on **Google Gemini** via LangChain's `init_chat_model` and `langchain-google-genai`:

| Variable | Default | Agent Persona / Role |
|---|---|---|
| `SUPERVISOR_MODEL_NAME` | `google_genai:gemini-3-flash-preview` | **Supervisor Orchestrator**: Evaluates user query ambiguity, constructs execution DAG, routes between subagents, and manages paper review interrupts |
| `PF_AGENT_MODEL_NAME` | `google_genai:gemini-3.5-flash-lite` | **Paper Finding Subagent**: Multi-step search planner and iterative ReAct search agent over OpenAlex, arXiv, and Google Search Grounding |
| `PF_FILTER_MODEL_NAME` | `google_genai:gemini-3.5-flash-lite` | **Abstract Relevance Filter**: High-throughput abstract evaluation and pre-filtering before FlashRank ONNX neural reranking |
| `QA_AGENT_MODEL_NAME` | `google_genai:gemini-3.5-flash-lite` | **Q&A Evidence Subagent**: Generates targeted vector retrieval queries and synthesizes final answers grounded in selected paper chunks |
| `QA_EVALUATION_MODEL_NAME` | `google_genai:gemini-3.5-flash-lite` | **Evidence Sufficiency Evaluator**: Evaluates retrieved chunks (`AnswerQuestion` vs `AskForMoreEvidence` with feedback loop) |
| `QA_EVALUATOR_MODEL_NAME` | `google_genai:gemini-3-flash-preview` | **Offline Benchmark Judge**: High-precision evaluation and grading against QASPER academic datasets |
| `QA_BASELINE_MODEL_NAME` | `google_genai:gemini-3.5-flash-lite` | **Evaluation Baseline**: Unassisted zero-shot baseline model for benchmark comparison |
| `EMBEDDING_MODEL_NAME` | `models/gemini-embedding-001` | **Dense Vector Embeddings**: Google 3072-dim embedding model used for Qdrant document chunk indexing |

### LangSmith Tracing (optional)

| Variable | Default | Description |
|---|---|---|
| `LANGSMITH_TRACING_V2` | `false` | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | — | LangSmith API key |
| `LANGCHAIN_PROJECT` | `scholargraph` | LangSmith project name |

### External APIs (Optional)

| Variable | Required | Description |
|---|---|---|
| `S2_API_KEY` | No | Semantic Scholar API key (system natively federates across OpenAlex and arXiv automatically) |
| `COHERE_API_KEY` | No | Legacy Cohere key (system uses in-process ONNX FlashRank cross-encoder by default) |

### Qdrant Vector Database

| Variable | Default | Description |
|---|---|---|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST endpoint |
| `QDRANT_API_KEY` | _(empty)_ | Leave blank for local |
| `QDRANT_VECTOR_SIZE` | `3072` | Embedding dimensions (3072 for `gemini-embedding-001`) |
| `QDRANT_COLLECTION` | `papers` | Collection name |
| `QDRANT_DISTANCE` | `COSINE` | Distance metric |

### Redis / Celery

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Celery broker |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/0` | Celery result backend |

### Paper Processing

| Variable | Default | Description |
|---|---|---|
| `PDF_DOWNLOAD_DIR` | `./papers` | Local directory for downloaded PDFs |
| `GROBID_SERVER_URL` | `http://localhost:8070` | Grobid REST endpoint |

### Auth (Google OIDC / Local Sessions)

| Variable | Default | Description |
|---|---|---|
| `GOOGLE_JWKS_URL` | `https://www.googleapis.com/oauth2/v3/certs` | Google public JWKS endpoint for validating RS256 ID tokens |
| `DISABLE_AUTH` | `false` | Set `true` to allow open guest cryptographic sessions |

### Logging

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, or `CRITICAL` |

---

## Architecture

### Supervisor Graph (`graph.py`)

Entry point that orchestrates the full workflow:

```
query_evaluation → planner → executor → supervisor_tools → post_tool
                                                                ↓
                                                    [replanner interrupt]
```

The supervisor evaluates query clarity, constructs the execution plan, dispatches to the subgraphs, and triggers human-in-the-loop interrupts so users can inspect and filter discovered papers.

### Paper Finder Subgraph (`paper_finder.py`)

Iterative search loop (max 3 iterations):

```
planner → executor → replan_agent
   ↑_____________________________|  (if goal not achieved)
```

- **planner**: Analyzes the query and generates concrete search operations.
- **executor**: Runs iterative searches using OpenAlex, arXiv, Google Search Grounding, and citation snowballing. Accumulates results and reranks top-35 candidates using FlashRank ONNX.
- **replan_agent**: Inspects accumulated candidate papers against the original goal and loops if necessary.

**Tools available to the paper finder:**

| Tool | Engine | Description |
|---|---|---|
| `s2_search_papers` | OpenAlex + arXiv | Federated search across 250M+ open-access papers, citation chasing, and Semantic Scholar fallback |
| `google_search_grounding` | Google GenAI SDK | Official Google Search grounding for live literature discovery, author profiles, and preprints |
| `forward_snowball` | OpenAlex / S2 Graph | Discovers follow-on research citing a seed paper |
| `backward_snowball` | OpenAlex / S2 Graph | Discovers foundational literature cited by a seed paper |

### Q&A Subgraph (`qa.py`)

Evidence-based retrieval loop (max 2 refinement iterations):

```
qa_retrieve → qa_evaluate → qa_answer
                   ↓
              (refine queries and retry if evidence insufficient)
```

- **qa_retrieve**: Generates focused queries and retrieves evidence chunks from Qdrant, filtered strictly to user-selected `paper_id`s.
- **qa_evaluate**: Validates evidence sufficiency (`AnswerQuestion` vs `AskForMoreEvidence`).
- **qa_answer**: Synthesizes the final answer with segment citations.

---

## Project Structure

```
backend/
├── app/
│   ├── agent/
│   │   ├── graph.py             # Supervisor graph — main orchestrator
│   │   ├── paper_finder.py      # Paper finder subgraph with FlashRank ONNX reranking
│   │   ├── paper_finder_fast.py # Optimized fast-path search pipeline
│   │   ├── qa.py                # Q&A subgraph with scoped vector retrieval
│   │   ├── qa_baseline.py       # Zero-shot baseline for benchmark comparisons
│   │   ├── states.py            # TypedDict state definitions
│   │   ├── prompts.py           # Structured agent system prompts
│   │   ├── ui_manager.py        # push_ui_message helper for live streaming
│   │   ├── RedisDocumentStore.py# Redis-backed parent document store
│   │   └── utils.py             # Shared utilities
│   ├── auth.py                  # Google OIDC public JWKS token verification & session middleware
│   ├── celery_app.py            # Celery task queue configuration
│   ├── core/
│   │   ├── config.py            # Pydantic Settings — models, credentials, endpoints
│   │   ├── logging_config.py    # Structured logging configuration
│   │   └── schema.py            # Shared Pydantic schemas (Paper, Query, Plan)
│   ├── services/
│   │   ├── qdrant.py            # Qdrant client wrapper & Google Gemini embedding pipeline
│   │   └── s2_client.py         # OpenAlex + arXiv federated retrieval service
│   ├── tasks/
│   │   └── ingest.py            # Celery task: download → Grobid TEI → embed → Qdrant
│   ├── tools/
│   │   └── search.py            # Google GenAI Search Grounding & OpenAlex tool bindings
│   └── webapp/
│       └── app.py               # FastAPI application
├── .env                         # Local runtime environment file
├── .env_example                 # Clean environment variable template
├── langgraph.json               # LangGraph server configuration
└── pyproject.toml               # Python dependencies (managed by uv)
```
