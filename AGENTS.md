# AGENTS.md — Life Map / Life Guide

This repository is a local-first personal Life Map / Life Guide application.
Codex must treat this file as the root instruction document for all code changes.

## 0. Product contract

Build a local web service that helps the user structure goals, choices, risks, checkpoints, and evidence into a dynamic mind-map / life-map.

The app is **not** a fortune teller and must not claim to predict the user's future.
It must present outputs as scenario maps, assumptions, trade-offs, and possible routes.

Core product loop:

1. User enters profile, constraints, and a goal.
2. System generates a dynamic graph bundle from user input and optional RAG evidence.
3. Graph is rendered as a playful hand-drawn mind-map / tree.
4. User selects a route and writes check-ins.
5. System revises the graph based on actual progress.

## 1. Read order before implementation

Before touching code, read in this order:

1. `docs/CODEX_START_HERE.md`
2. `docs/IMPLEMENTATION_PLAN.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DYNAMIC_GRAPH_SPEC.md`
5. `docs/SECURITY_CHECKLIST.md`
6. The specific phase file under `docs/phases/` for the current task
7. `docs/state/CURRENT_STATE.md`

Do not load every document into a single huge prompt unless necessary. Work phase by phase.

## 2. Context-rot prevention

For non-trivial changes:

- Create or update an ExecPlan using the template in `docs/PLANS.md`.
- Work on exactly one phase at a time.
- Keep the diff small and reviewable.
- At the end of every phase, update `docs/state/CURRENT_STATE.md` with:
  - completed work
  - changed files
  - commands run
  - known gaps
  - next recommended task

If the task becomes too broad, split it into a smaller phase and document the split.

## 3. Security rules — non-negotiable

Never hardcode:

- API keys
- access tokens
- passwords
- OAuth secrets
- database passwords
- personal identifiers from real users
- private URLs, cookies, or session headers

Use environment variables and local `.env` files only. `.env` must be ignored by git. Provide `.env.example` with placeholder values only.

Do not log raw user profile data, secrets, prompts containing private information, or full retrieved documents by default.

Run secret scanning before finalizing any phase that changes config, tests, or source ingestion code.

Required local guardrails:

- `.gitignore` includes `.env`, local databases, vector indexes, logs, and uploaded private files.
- `gitleaks` or equivalent secret scanner is configured.
- `pre-commit` is configured.
- Python settings are loaded via `pydantic-settings` or equivalent.
- Frontend public env vars must be explicitly prefixed and must never contain secrets.

## 4. Crawling and source collection rules

The default ingestion path is manual: user-pasted notes, URLs, exported markdown, or local files.

Automated crawling must obey:

- robots.txt where applicable
- source terms of service
- rate limits
- no auth-wall bypass
- no paywall bypass
- no captcha bypass
- no anti-bot bypass
- no scraping of private communities or logged-in pages unless the user owns the data and the site terms permit it

Scrapling may be used for parsing permitted pages, but do not enable stealth, anti-bot, or bypass behavior.

If a source cannot be collected safely, store only user-provided notes and metadata.

## 5. Architecture principles

Use a layered architecture:

- `domain`: pure models and business rules
- `application`: use cases and orchestration
- `infrastructure`: database, vector store, LLM, crawler, embeddings
- `api`: HTTP routes and DTOs
- `web`: UI and client state

Follow SOLID pragmatically:

- Single responsibility per module.
- Depend on interfaces/protocols for LLM, embeddings, source fetching, vector search, and graph layout.
- Keep domain logic free of framework code.
- Keep graph validation deterministic and unit-tested.
- Do not let UI components contain RAG or persistence logic.

## 6. Dynamic graph requirements

Do not implement node types as a fixed global enum.

Each generated graph must contain a `GraphBundle` with:

- `ontology.node_types`: dynamic node type definitions for this map
- `ontology.edge_types`: dynamic edge type definitions for this map
- `nodes`: graph nodes using the bundle's node type IDs
- `edges`: graph edges using the bundle's edge type IDs
- `evidence`: supporting sources and snippets/summaries
- `assumptions`: explicit assumptions
- `warnings`: uncertainty, scope, safety warnings

The core node envelope is stable, but the node type semantics are generated dynamically.
Unknown node types must render with a generic fallback style.

Temporal/progression edges must form a DAG unless explicitly marked as non-progression reference edges.

## 7. AI/RAG rules

Generated content must distinguish:

- evidence-backed observations
- assumptions
- user-provided facts
- model-generated suggestions

Every factual claim derived from external material should reference an evidence item.
Every unsupported claim must be labeled as an assumption or suggestion.

LLM JSON output must be schema-validated. If invalid, repair through a deterministic or LLM-assisted repair loop, then validate again.

## 8. UX rules

The map should look like a playful mind-map, not a sterile enterprise graph.

Use:

- rounded pastel nodes
- hand-drawn/sketchy borders or connectors
- soft spacing
- small node-specific visual accents
- clear risk/checkpoint/evidence markers
- readable labels

Do not sacrifice readability for decoration.

Use the reference images in `assets/references/` as style direction, not as exact copies.

## 9. Preferred stack

Frontend:

- SvelteKit
- TypeScript
- Svelte Flow
- Rough.js for sketch-like accents
- ELK.js for layout
- Vitest for unit tests
- Playwright for e2e tests

Backend:

- Python
- FastAPI
- SQLModel or SQLAlchemy
- SQLite
- LanceDB for local vector search
- Ollama by default for local embeddings and local LLM provider
- OpenAI provider optional through environment variables only
- pytest, ruff, mypy/pyright where practical
- uv for Python dependency management

Crawler/RAG:

- Manual source ingestion first
- Crawl4AI for permitted LLM-ready Markdown extraction
- Trafilatura/readability-style extraction as fallback
- Scrapling only for permitted parsing, no bypass behavior
- Optional local SearXNG adapter later

## 10. Commands must be documented

Whenever commands are added, document them in `README.md`.
Expected command categories:

- install
- run web
- run API
- run all dev services
- test frontend
- test backend
- lint
- typecheck
- secret scan

## 11. Definition of done

A phase is done only when:

- implementation matches the current phase spec
- unit tests exist for core logic
- relevant UI path works locally or is stubbed with clear TODOs
- lint/typecheck/test commands pass or failures are documented
- no secrets are introduced
- `docs/state/CURRENT_STATE.md` is updated
- the next phase is clear
