# ScholarGraph

A **production multi-agent AI research platform** built on an autonomous supervisor architecture. A top-level LangGraph supervisor orchestrates specialized subagents — an iterative Paper Finding Agent for federated academic retrieval and citation chasing, and a grounded Q&A Agent for evidence-based synthesis over user-selected literature.

> 🚀 **Live Production Deployment**: [scholargraph.hrushikeshramilla.in](https://scholargraph.hrushikeshramilla.in)  
> Hosted on AWS EC2, automated TLS termination via Caddy reverse proxy, containerized vector & ingestion services, powered by Google Gemini, FlashRank in-process ONNX neural reranking, OpenAlex + arXiv federated retrieval, and Google OpenID Connect.

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![LangGraph](https://img.shields.io/badge/orchestration-LangGraph-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![Google Gemini](https://img.shields.io/badge/LLM-Google%20Gemini%203.5-4285F4.svg)](https://ai.google.dev/)
[![React 19](https://img.shields.io/badge/frontend-React%2019%20(Dark%20Navy)-61DAFB.svg)](https://react.dev/)
[![ONNX Runtime](https://img.shields.io/badge/reranker-FlashRank%20ONNX-005CED.svg)](https://github.com/PrithivirajDamodaran/FlashRank)
[![OpenAlex](https://img.shields.io/badge/literature-OpenAlex%20%2B%20arXiv-brightgreen.svg)](https://openalex.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**[MCP Server](./mcp/)** — use ScholarGraph's search and citation tools directly in Claude Desktop or custom agent harnesses. | **[Backend Architecture](./backend/README.md)** | **[Frontend Guide](./web/README.md)**

---

## Technical Stack

| Layer | Technology | Engineering Rationale |
| :--- | :--- | :--- |
| **Agent Orchestration** | LangGraph (Cyclical DAG + Subgraphs) | Stateful human-in-the-loop interrupts, deterministic graph transitions, checkpoint recovery |
| **LLM Inference** | Google Gemini `gemini-3.5-flash-lite` / `gemini-3-flash-preview` | Ultra-fast token latency, high concurrency limits, native structured output |
| **API Server** | FastAPI + Uvicorn | High-throughput asynchronous REST & streaming endpoints |
| **Task Queue** | Celery + Redis | Asynchronous background PDF downloads, Grobid TEI extraction, and embedding jobs |
| **Frontend UI** | React 19 + Vite + TypeScript + Tailwind CSS | Deep Dark Navy theme (`#0f1015` / `#16171e`) inspired by Gemini & ChatGPT, zero layout shifts |
| **Vector Database** | Qdrant | Dense vector indexing with payload filtering scoped to user-selected paper IDs |
| **PDF Extraction** | Grobid (Docker) | Section-aware XML/TEI extraction, title, abstract, and bibliography parsing |
| **Academic Retrieval** | OpenAlex + arXiv Federated Engine | 250M+ open-access scientific publications, immune to cloud datacenter IP blocks |
| **Web Grounding** | Google Search Grounding (`google.genai`) | Official Google Search grounding with direct web citations and freshness verification |
| **Document Reranking**| In-Process ONNX Neural Cross-Encoder (`FlashRank`) | `ms-marco-TinyBERT-L-2-v2` cross-attention; **4.92ms latency**, $0 API cost, zero external SaaS round-trips |
| **Dense Embeddings** | Google Gemini `models/gemini-embedding-001` (3072-dim) | High-dimensional semantic representation for parent-child chunk indexing |
| **Authentication** | Google OpenID Connect (OIDC) / Cryptographic Session | Direct public JWKS validation (`https://www.googleapis.com/oauth2/v3/certs`) + guest sessions |

---

## Agent Architecture

ScholarGraph implements a hierarchical multi-agent pattern with LangGraph: a top-level **Supervisor** orchestrating an iterative **Paper Finding Subgraph** and an evidence-grounded **Q&A Subgraph**.

```
                         ┌────────────────────────────────────┐
                         │         User Query / Input         │
                         └─────────────────┬──────────────────┘
                                           │
                                           ▼
                         ┌────────────────────────────────────┐
                         │   query_evaluation (Classifier)    │
                         └─────────────────┬──────────────────┘
                                           │ (clear query)
                                           ▼
                         ┌────────────────────────────────────┐
                         │       planner (DAG Strategy)       │
                         └─────────────────┬──────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
     ┌─────────────────────────────┐               ┌─────────────────────────────┐
     │  Paper Finding Subgraph     │               │        Q&A Subgraph         │
     │  - OpenAlex + arXiv search  │               │  - Qdrant scoped retrieval  │
     │  - Google Search Grounding  │               │  - Evidence sufficiency eval│
     │  - Citation & reference snow│               │  - Synthesis & attribution  │
     │  - FlashRank ONNX reranking │               └─────────────────────────────┘
     └──────────────┬──────────────┘
                    │
                    ▼
     ┌─────────────────────────────┐
     │ LangGraph Interrupt Pause   │
     │ (User selects papers in UI) │
     └──────────────┬──────────────┘
                    │ (Resume with selected papers)
                    ▼
     ┌─────────────────────────────┐
     │   Q&A Grounded Generation   │
     └─────────────────────────────┘
```

### 1. Supervisor Orchestrator (`graph.py`)

Every user message enters the supervisor, executing a deterministic five-node sequence:
- `query_evaluation`: Evaluates query ambiguity and intent using structured Pydantic schemas (`clear`, `needs_clarification`, `unselected_paper`, `irrelevant`, `inappropriate`).
- `planner`: Constructs the execution DAG (`find_only`, `qa_only`, or `find_then_qa`).
- `executor`: Dispatches structured tool calls to the appropriate subgraph.
- `post_tool`: Commits state updates and prepares the paper payload.
- `replanner`: Triggers a LangGraph `interrupt("select_papers")`, allowing users to inspect cards, view PDF abstracts, and select relevant literature before evidence retrieval begins.

### 2. Paper Finding Agent (`paper_finder.py`)

An autonomous ReAct search loop (max 3 iterations) that gathers, cross-references, and ranks scientific literature:

| Tool | Engine | Description |
| :--- | :--- | :--- |
| `s2_search_papers` | OpenAlex + arXiv Federated Engine | Queries over 250M+ open scientific works with metadata filtering (year, venue, citation metrics, open access PDF links). Falls back seamlessly to Semantic Scholar. |
| `google_search_grounding` | Google GenAI SDK (`google.genai`) | Official Google Search grounding tool for seminal papers, author lab sites, and recent press/preprints. |
| `forward_snowball` | OpenAlex / S2 Graph API | Traverses forward citation graphs to surface recent follow-on research citing a seed paper. |
| `backward_snowball` | OpenAlex / S2 Graph API | Traverses reference graphs to identify foundational papers cited by a seed paper. |

**In-Process ONNX Reranking:**  
Unlike legacy systems that send candidate pools over HTTP to Cohere, ScholarGraph executes local cross-encoder neural inference via **FlashRank** (`ms-marco-TinyBERT-L-2-v2`, ~3.2MB ONNX model). Reranking 35 papers takes **~4.9ms** on standard CPU, eliminating network latency and third-party SaaS charges.

### 3. Grounded Q&A Agent (`qa.py`)

An iterative evidence retrieval loop scoped strictly to user-selected paper IDs:
- `qa_retrieve`: Generates targeted vector queries and retrieves relevant chunks from Qdrant, filtered by payload `paper_id`.
- `qa_evaluate`: Validates whether retrieved evidence provides sufficient empirical backing (`AnswerQuestion` vs `AskForMoreEvidence` with refined query limitations).
- `qa_answer`: Synthesizes the final answer with direct paper citations and caveats if only abstracts were indexable.

### 4. Background Paper Ingestion Pipeline (Celery)

When papers are bookmarked or selected:
1. **arXiv Discovery**: Resolves paper titles to open-access preprint identifiers.
2. **PDF Acquisition**: Streams PDFs into a temporary staging directory (`PDF_DOWNLOAD_DIR`).
3. **Grobid Parsing**: Parses PDF binaries into structured XML/TEI, isolating title, abstract, sections, and references.
4. **Parent-Child Indexing**: Splits text into parent context blocks and embedded child chunks using Google Gemini embeddings (`models/gemini-embedding-001`, 3072-dim).
5. **Qdrant Upsert**: Deduplicates vectors globally across users, skipping re-indexing if already present.

---

## UI & Design System

The web interface is built with **React 19, TypeScript, and Tailwind CSS**, featuring:
- **Dark Navy Aesthetic**: Deep off-black / dark navy background (`#0f1015`), elevated card surfaces (`#16171e`), subtle borders (`#232530`), and high-contrast typography (`#f1f3f7`) designed to match ChatGPT and Gemini.
- **Collapsible Drawer Sidebar**: Fast history navigation and local cryptographic session management.
- **Interactive Human-in-the-Loop Interrupts**: Interactive paper selection trays with inline metadata (citations, publication year, open-access status).
- **Subagent Status Telemetry**: Live progress cards showing real-time planning, searching, evaluating, and reranking stages.

---

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/Hrushikesh-ramilla/ScholarGraph.git
cd ScholarGraph
```

### 2. Configure Environment

```bash
cp backend/.env_example backend/.env.local
```

Edit `backend/.env.local` — **only one API key is required**:

```env
# Required: Google Gemini API key (powers reasoning, search grounding, and embeddings)
GEMINI_API_KEY=your_gemini_api_key_here

# Zero external keys required for search (OpenAlex & arXiv are open) or reranking (FlashRank runs locally)
```

### 3. Launch Services with Docker Compose

```bash
# Starts Postgres (5432), Redis (6379), Qdrant (6333), and Grobid (8070)
make infra
```

### 4. Run Application Services

```bash
# Terminal 1: Background Ingestion Worker
make worker

# Terminal 2: LangGraph Orchestration Backend (http://localhost:2024)
make dev

# Terminal 3: React Frontend (http://localhost:5173)
make frontend
```

Visit `http://localhost:5173` to explore the interface.

---

## Production Deployment on AWS EC2

The live production deployment at `scholargraph.hrushikeshramilla.in` runs under:
- **Compute**: AWS EC2 Ubuntu instance (`65.1.112.251`)
- **Reverse Proxy**: Caddy server managing automatic Let's Encrypt TLS certificates, static asset compression, and `/api` reverse proxying to localhost:2024.
- **Service Supervision**: `systemd` managing `scholargraph.service` with automated crash restarts and journald logging.

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
