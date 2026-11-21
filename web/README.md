# ScholarGraph — Frontend

A production React 19 web application for ScholarGraph, engineered with Vite, TypeScript, and Tailwind CSS. Connects via real-time streaming to the LangGraph multi-agent backend.

## Design System

- **Dark Navy Aesthetic**: Deep off-black background (`#0f1015`), elevated dark surfaces (`#16171e`), subtle borders (`#232530`), and crisp high-contrast typography (`#f1f3f7`), matching the visual standard of Google Gemini, ChatGPT, and Antigravity.
- **Glassmorphic Navigation**: Seamless drawer sidebar for past research threads and session state.
- **Interactive Human-in-the-Loop Trays**: Pause execution interrupts allowing researchers to inspect paper abstracts, check citation counts, and curate their reading lists before Q&A.

## Prerequisites

- Node.js 20+
- pnpm

## Quick Start

```bash
cd web
pnpm install
pnpm dev
```

The application will be accessible at `http://localhost:5173`.

---

## Environment Variables

Copy `web/.env.example` to `web/.env` and configure:

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:2024` | LangGraph backend URL |
| `VITE_ASSISTANT_ID` | `agent` | LangGraph graph / assistant ID |
| `VITE_LANGSMITH_API_KEY` | _(empty)_ | LangSmith API key (leave blank for local dev) |
| `VITE_GOOGLE_CLIENT_ID` | _(empty)_ | Google OAuth Client ID for Google Sign-In (falls back to local session if omitted) |

---

## Available Scripts

- `pnpm dev` — Start Vite development server with Hot Module Replacement (HMR)
- `pnpm build` — Build optimized production bundles in `dist/`
- `pnpm preview` — Locally preview production build
- `pnpm lint` — Run ESLint across TypeScript components
- `pnpm format` — Format source code with Prettier

---

## Core Features

- **Real-Time Subagent Telemetry**: Live cards tracking the Paper Finder and Q&A agents through planning, searching, evaluating, and reranking stages.
- **Human-in-the-Loop Paper Interrupts**: Interactive paper selection with citation metrics, authors, and arXiv preprint links.
- **Background Ingestion Monitor**: Live progress tracking as PDFs are downloaded, parsed via Grobid, and indexed into Qdrant.
- **Token-by-Token Streaming**: Low-latency token streaming using the LangGraph SDK.
- **Persistent Conversation History**: Multi-turn dialogue history saved and restored from backend PostgreSQL checkpoints.
- **Google OIDC & Local Session**: Secure Google Sign-In with public JWKS verification, with automated fallback to local cryptographic guest sessions.
