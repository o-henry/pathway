# ADR 0001 — Stack Selection

## Status

Accepted for MVP.

## Decision

Use:

- SvelteKit + TypeScript for frontend.
- Svelte Flow for graph UI.
- Rough.js for hand-drawn accents.
- ELK.js for graph layout.
- FastAPI for backend.
- SQLite for local persistence.
- LanceDB for vector search.
- Codex GPT-5.5 for desktop agent execution; backend graph generation uses stub or optional OpenAI.
- Optional OpenAI provider only through env vars.

## Rationale

The product is a local-first data-driven mind-map. It needs a dynamic graph UI and strong local RAG tooling.
SvelteKit avoids picking React by default while still supporting a capable node graph library through Svelte Flow.
Python backend keeps RAG/crawling/LLM integration simpler.
SQLite and LanceDB keep the app local and easy to back up.

## Consequences

- More integration work than an all-Next.js app.
- Clear API boundary between UI and RAG logic.
- Better Python ecosystem access for RAG and crawling.
