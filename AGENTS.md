# AGENTS.md — Pathway

This repository is a local-first personal **Pathway** application.
Codex must treat this file as the root instruction document for all code changes.

## 0. Product contract

Build a local web service that helps the user turn a live goal into an evolving decision graph.

Pathway is:

- a goal-first, graph-first decision workspace
- a local research and planning surface
- an evolving map of routes, costs, risks, checkpoints, missed options, and state changes

Pathway is **not**:

- a fortune teller
- a generic to-do app
- a static concept-map toy
- a regex-heavy decision tree hardcoded in advance

The app must not claim to predict the user's future.
It must present outputs as scenario maps, evidence-backed observations, assumptions, trade-offs, and possible routes.

Core product loop:

1. User states a goal in natural language.
2. System infers what resource dimensions matter for that goal and asks only the necessary follow-up questions.
3. System runs multi-agent research across the user's source library and permitted public sources.
4. System synthesizes a dynamic graph bundle from user facts, retrieved evidence, and explicit assumptions.
5. Graph is rendered as the primary workspace, not as a secondary visualization below forms.
6. User selects routes, records reality, and updates current constraints.
7. System revises the graph so the map reflects the user's current state, not a stale earlier snapshot.

## 1. Read order before implementation

Before touching code, read in this order:

1. `docs/CODEX_START_HERE.md`
2. `docs/PATHWAY_REFRAME.md`
3. `docs/DESIGN_RESEARCH_PLAYBOOK.md`
4. `docs/IMPLEMENTATION_PLAN.md`
5. `docs/ARCHITECTURE.md`
6. `docs/DYNAMIC_GRAPH_SPEC.md`
7. `docs/RAG_AND_CRAWLING_SPEC.md`
8. `docs/SECURITY_CHECKLIST.md`
9. The specific phase file under `docs/phases/` for the current task
10. `docs/state/CURRENT_STATE.md`

Do not load every document into a single huge prompt unless necessary. Work phase by phase.

## 2. Context-rot prevention

For non-trivial changes:

- Create or update an ExecPlan using the template in `docs/PLANS.md`.
- Work on exactly one bounded objective at a time.
- Keep the diff small and reviewable.
- At the end of every bounded objective, update `docs/state/CURRENT_STATE.md` with:
  - completed work
  - changed files
  - commands run
  - known gaps
  - next recommended task
- Re-read the relevant phase doc before resuming work after an interruption.
- Prefer adding a new phase doc or sub-phase note over keeping a massive rolling task in memory.

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

The ingestion path has three layers:

1. user-owned context
2. targeted goal-specific research
3. broader contextual research that helps the graph branch into alternatives, missed opportunities, and future route switches

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
- Depend on interfaces/protocols for LLM, embeddings, source fetching, vector search, graph layout, and research roles.
- Keep domain logic free of framework code.
- Keep graph validation deterministic and unit-tested.
- Do not let UI components contain RAG or persistence logic.

Avoid brittle hardcoding:

- Do not use regex or text-branching as the core strategy for goal analysis, resource inference, route generation, or graph semantics.
- Regex is acceptable for sanitation, parsing tiny known formats, or validation of bounded machine formats.
- The primary logic for intake and generation must be schema-driven, model-assisted, and evidence-aware.
- Route semantics must emerge from dynamic ontology and grounded synthesis, not from giant `if/elif` trees keyed by topic names.

## 6. Multi-agent research contract

Pathway should move toward a bounded multi-agent research loop:

- `goal analyst`: rewrites the user's goal into research questions and identifies which resource dimensions matter
- `scout agents`: collect diverse evidence from user-owned sources and permitted public sources
- `skeptic/verifier`: challenges weak claims, flags bias, duplication, stale evidence, and unsupported leaps
- `synthesizer`: produces the evidence packet and graph-ready ontology proposal
- `graph builder`: emits schema-valid `GraphBundle`

This is an orchestration contract, not an excuse for agent sprawl.
Every extra agent must have:

- a sharply bounded role
- explicit inputs/outputs
- a measurable reason to exist

## 7. Dynamic graph requirements

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

The graph must be able to grow as the user's present changes.
New constraints, reduced budget, lost time, changed motivation, or new evidence should be able to:

- add branches
- collapse branches
- downgrade routes
- surface opportunity cost
- mark previously viable routes as out of reach
- recover routes that become viable again

Absolute graph preservation rule:

- Existing graph nodes, edges, evidence, assumptions, and prior route history must not be deleted or overwritten during normal recalculation, research, revision, task completion, or learning-route updates.
- Updates should append, annotate, weaken, hide, supersede, or connect new material while preserving the prior graph.
- Destructive removal is allowed only after the user explicitly requests deletion or uses a clear delete interaction for the specific graph element.

## 8. AI/RAG rules

Generated content must distinguish:

- evidence-backed observations
- assumptions
- user-provided facts
- model-generated suggestions

Every factual claim derived from external material should reference an evidence item.
Every unsupported claim must be labeled as an assumption or suggestion.

LLM JSON output must be schema-validated. If invalid, repair through a deterministic or LLM-assisted repair loop, then validate again.

For long-context synthesis:

- place retrieved evidence before the task query
- structure documents with XML-like sections or equivalent machine-parsable blocks
- ask the model to quote or ground claims before synthesizing route recommendations
- split complex flows into chained subtasks when one prompt becomes unstable

## 9. UX rules

The graph is the protagonist.
Forms, history, source management, and revisions are supporting rails around the graph workspace.

The Pathway visual language should be:

- graph-first
- editorial, technical, and intentional
- low-radius or near-square by default
- light on candy colors
- spatially clear under high information density
- capable of looking slightly hand-directed without becoming childish

Avoid:

- giant rounded pills everywhere
- generic SaaS landing page sections stacked vertically
- “cute pastel dashboard” defaults
- decoration that weakens information hierarchy

Use:

- restrained corners
- strong contrast between canvas and rails
- clear route status markers
- visible evidence / assumption / risk affordances
- graph-paper / plotting-room / decision-table sensibility

Use the reference images in `assets/references/` as inspiration for spatial branching, not as a direct style target.

## 10. Design quality protocol

When changing the UI:

- define success criteria before coding
- use reference-driven direction, not generic dashboard habits
- do one design pass, one critique pass, then one refinement pass
- document the critique in the relevant phase or state note if the change is substantial
- prefer fewer, stronger visual ideas over many weak ones

## 11. Preferred stack

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
- Codex GPT-5.5 by default for desktop agent execution
- OpenAI provider optional through environment variables only for backend graph generation
- pytest, ruff, mypy/pyright where practical
- uv for Python dependency management

Crawler/RAG:

- Manual source ingestion first
- Crawl4AI for permitted LLM-ready Markdown extraction
- Lightpanda for fast JS-capable headless fetch flows when browser execution is needed
- Scrapy for disciplined crawl orchestration and queueing when breadth increases
- Scrapling only for permitted parsing, no bypass behavior
- Trafilatura/readability-style fallback for article extraction
- Optional local SearXNG adapter later

## 12. Commands must be documented

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

## 13. Definition of done

A phase is done only when:

- implementation matches the current phase spec
- unit tests exist for core logic
- relevant UI path works locally or is stubbed with clear TODOs
- lint/typecheck/test commands pass or failures are documented
- no secrets are introduced
- `docs/state/CURRENT_STATE.md` is updated
- the next phase is clear
