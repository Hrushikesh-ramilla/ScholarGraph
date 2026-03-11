# ScholarGraph Architecture

## System Overview

ScholarGraph is an autonomous multi-agent academic research and synthesis platform built with LangGraph supervisor orchestration, Google Gemini inference, and a React 19 real-time chat interface.

## Core Architecture

### Backend (`/backend`) - Multi-Agent Supervisor & Retrieval Layer

- **Supervisor Orchestrator**: LangGraph StateGraph coordinating specialized sub-agents with human-in-the-loop review interrupts (`select_papers`).
- **Paper Finding Subagent**: Multi-hop iterative research loop over Semantic Scholar API with citation snowballing (forward/backward chasing) and Cohere semantic reranking.
- **Q&A Evidence Subagent**: Parent-document retrieval over Qdrant vector database with iterative evidence sufficiency evaluation (`qa_evaluate`) and limitation feedback loops.
- **Vector Database**: Qdrant with Google Gemini `models/text-embedding-004` (768-dim) parent-child chunk indexing.
- **Document Ingestion**: Celery + Redis background worker executing structured PDF extraction via GROBID (TEI-XML section parsing).
- **Tool Interoperability**: Model Context Protocol (MCP) server exposing academic search and citation tools.

### Frontend (`/web`) - Real-Time Chat & Inspection

- **React 19 + TypeScript**: Real-time token streaming and generative UI using LangGraph SDK.
- **Subagent Status Cards**: Real-time visualization of agent planning, searching, evaluating, and generating states.
- **Paper Management**: Interactive paper selection drawer and background ingestion progress tracker.
- **Styling**: Tailwind CSS v4 with fluid dark/light theming.
