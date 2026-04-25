# Implementation Plan — Pathway

## 1. Target product

Build a local-first personal web service that helps the user create, inspect, and revise a **Pathway** decision graph:

- Profile: current situation, time, money, energy, personality tags, constraints.
- Goal: natural-language objective plus success criteria.
- Sources: user notes, URLs, markdown, and safely fetched public material.
- RAG: retrieve relevant source chunks.
- Dynamic graph generation: generate a per-map ontology and a graph bundle.
- Visualization: render a playful hand-drawn mind-map.
- Check-in: revise map based on real progress.

The primary user is the local owner. No SaaS assumptions.

## 2. Chosen stack

### 2.1 Frontend

| Concern | Choice | Reason |
|---|---|---|
| App framework | SvelteKit | Lower boilerplate than React for this UI-heavy local app; supports typed routes, SSR/static options, and fast iteration. |
| Language | TypeScript | Required for graph schema safety. |
| Graph canvas | Svelte Flow | Node-based UI component library for Svelte; avoids choosing React only because React is common. |
| Hand-drawn style | Rough.js + CSS | Adds sketch-like borders/connectors and playful style without implementing a full drawing engine. |
| Layout | ELK.js | Directed graph layout suitable for tree/layered route maps. |
| Unit tests | Vitest | Fast TS unit tests. |
| E2E tests | Playwright | Browser-level graph and flow tests. |

### 2.2 Backend

| Concern | Choice | Reason |
|---|---|---|
| API | FastAPI | Python has the strongest local RAG/crawling ecosystem; FastAPI keeps typed HTTP boundaries. |
| DB | SQLite | Single local file, easy backup, no server dependency. |
| ORM | SQLModel or SQLAlchemy 2.x | Typed models and clean persistence layer. |
| Vector DB | LanceDB | Embedded local vector store, good match for local-first RAG. |
| LLM | Provider interface | Codex GPT-5.5 through the logged-in Codex CLI session; no API-key-backed default runtime. |
| Embeddings | Deterministic local embeddings by default | Keeps private notes local by default. |
| Graph validation | Pydantic + NetworkX | Schema validation plus deterministic DAG/cycle checks. |
| Python deps | uv | Fast reproducible Python project management. |
| Backend tests | pytest | Standard Python testing. |
| Lint/format | Ruff | Fast linting and formatting. |

### 2.3 Source ingestion / RAG

| Concern | Choice | Reason |
|---|---|---|
| Manual ingestion | First-class | Safest and most useful for a personal app. |
| URL extraction | Crawl4AI | Converts permitted web pages to LLM-ready Markdown. |
| HTML extraction fallback | Trafilatura/readability style | Useful for article extraction when full crawler is unnecessary. |
| Adaptive parsing | Scrapling, restricted | Use only for permitted parsing. Do not enable stealth/anti-bot bypass behavior. |
| Search discovery | Optional local SearXNG | Later phase only; search discovery should not be required for MVP. |
| Public corpus | Optional Common Crawl | Later research corpus, not MVP. |

## 3. Rejected or deferred choices

| Option | Decision | Reason |
|---|---|---|
| React + React Flow | Deferred fallback | Good library ecosystem, but user explicitly does not want unconditional React selection. SvelteKit + Svelte Flow fits the local UI better. |
| Next.js | Deferred | Strong framework, but unnecessary complexity for this local app. |
| Excalidraw/tldraw as primary canvas | Deferred | Great whiteboard tools, but less suitable for data-driven dynamic graph bundles. Could be export/edit mode later. |
| Neo4j | Deferred | Too heavy for local MVP. Graph structure can live in SQLite JSON plus deterministic validation. |
| Cytoscape.js | Deferred | Powerful graph analysis; less aligned with playful mind-map editing than Svelte Flow. |
| Full automated web crawling | Deferred | Legal/ethical/security overhead. Manual and permitted sources first. |

## 4. Repository structure

```text
pathway/
  AGENTS.md
  README.md
  .env.example
  .gitignore
  .pre-commit-config.yaml
  gitleaks.toml
  package.json
  pnpm-workspace.yaml
  pyproject.toml
  uv.lock

  apps/
    web/
      src/
        lib/
          api/
          graph/
          stores/
          styles/
          components/
        routes/
          +layout.svelte
          +page.svelte
          goals/
          maps/
          sources/
          settings/
      tests/
      playwright.config.ts
      vite.config.ts
      package.json

    api/
      lifemap_api/
        main.py
        config.py
        domain/
          models.py
          graph_bundle.py
          validation.py
          policies.py
        application/
          goals.py
          graph_generation.py
          graph_revision.py
          source_ingestion.py
          retrieval.py
        infrastructure/
          db.py
          repositories.py
          vector_store_lancedb.py
          llm/
            base.py
            codex_cli_provider.py
          embeddings/
            base.py
          crawling/
            policy.py
            crawl4ai_fetcher.py
            scrapling_parser.py
            manual_ingest.py
        api/
          routes_goals.py
          routes_maps.py
          routes_sources.py
          routes_generate.py
          routes_checkins.py
        tests/
          unit/
          integration/
      alembic/  # optional after Phase 1

  packages/
    graph-schema/
      src/
        graphBundle.ts
        validators.ts
      package.json

  data/
    .gitkeep
    local.db       # ignored
    lancedb/       # ignored
    uploads/       # ignored

  docs/
    CODEX_START_HERE.md
    IMPLEMENTATION_PLAN.md
    ARCHITECTURE.md
    DYNAMIC_GRAPH_SPEC.md
    RAG_AND_CRAWLING_SPEC.md
    SECURITY_CHECKLIST.md
    PLANS.md
    CODEX_TASKS_PHASED.md
    RESOURCE_MAP.md
    phases/
    state/
```

## 5. Development phases

### Phase 0 — Repository bootstrap and guardrails

Goal:
Create a safe, testable monorepo skeleton.

Deliverables:

- SvelteKit app skeleton under `apps/web`.
- FastAPI app skeleton under `apps/api`.
- `pnpm` workspace.
- `uv` Python project setup.
- `.env.example`, `.gitignore`, `.pre-commit-config.yaml`, `gitleaks.toml`.
- Minimal health endpoints and frontend landing page.
- Empty but runnable test suites.

Do not implement graph generation yet.

### Phase 1 — Backend domain model and SQLite persistence

Goal:
Implement local persistence for profile, goals, map bundles, sources, and state history primitives.

Deliverables:

- Domain models.
- Repository interfaces.
- SQLite implementation.
- CRUD endpoints.
- Pydantic request/response DTOs.
- Unit tests for model validation.
- Additive support for:
  - goal analysis
  - current state snapshots
  - append-only state updates
  - route selection

### Phase 2 — Static Pathway UI

Goal:
Render a static example graph bundle in the desired visual style.

Deliverables:

- Svelte Flow graph rendering.
- Custom node components.
- Custom edge styling.
- Rough.js/CSS sketch accents.
- Node detail drawer.
- Read-only example map from `templates/example_graph_bundle.json`.

### Phase 3 — Dynamic GraphBundle schema and validation

Goal:
Implement dynamic graph bundle validation shared conceptually across backend and frontend.

Deliverables:

- Backend Pydantic models for GraphBundle.
- Frontend TypeScript types.
- Dynamic ontology support.
- Graph validator:
  - unique IDs
  - node type exists in ontology
  - edge type exists in ontology
  - endpoints exist
  - evidence refs exist
  - progression DAG check
  - warnings for unsupported claims
- Layout adapter using ELK.js on frontend or backend.

### Phase 4 — LLM graph generation without RAG

Goal:
Generate a valid graph bundle from only user profile and goal.

Deliverables:

- LLM provider interface.
- Codex GPT-5.5 desktop and backend analysis default through the logged-in Codex CLI session.
- No API-key-backed provider in the default Pathway runtime.
- Prompt templates.
- JSON schema generation.
- validate-repair-validate loop.
- API endpoint: `POST /generate/map`.

### Phase 5 — Source library and local RAG

Goal:
Allow user to save notes/URLs and search them locally.

Deliverables:

- Manual source ingestion.
- URL metadata model.
- Safe fetch policy model.
- Crawl4AI integration behind explicit user action.
- Chunking pipeline.
- Deterministic embedding fallback.
- LanceDB store.
- Hybrid retrieval with SQLite FTS if implemented.
- Source detail UI.

### Phase 6 — RAG-grounded map generation

Goal:
Generate maps using retrieved evidence.

Deliverables:

- Query planning from goal/profile.
- Retrieve top source chunks.
- Evidence packet passed to LLM.
- GraphBundle evidence references.
- UI evidence badges and evidence drawer.
- Grounding policy tests.

### Phase 7 — Check-in and graph revision

Goal:
Update the map based on actual behavior.

Deliverables:

- Check-in form.
- Revision endpoint.
- Diff between old and revised graph.
- User accepts/rejects suggested changes.
- Actual route tracking.

Post-phase additive direction:

- explicit `goal analysis` step after goal creation
- latest `current state snapshot` plus append-only `state updates`
- persisted `route selection` per pathway
- `revision preview` wording and alias routes at the product edge
- graph highlighting for selected routes and preview deltas
- backward-compatible transition without destructive data migration

### Phase 8 — Quality, export, local packaging

Goal:
Make the app durable for personal use.

Deliverables:

- Markdown/JSON export.
- Backup/restore local data.
- Playwright e2e tests.
- Improved empty/error/loading states.
- Optional Tauri desktop packaging research.
- Security checklist pass.

## 6. Codex working mode

For each phase:

1. Read only the current phase document and required specs.
2. Draft a short plan.
3. Implement.
4. Run tests/lint/typecheck.
5. Update `docs/state/CURRENT_STATE.md`.
6. Stop and ask for the next phase instruction.

## 7. Core success criteria

The MVP is successful when:

- The user can create a goal.
- The app generates or loads a dynamic graph bundle.
- The map renders with dynamic node types.
- The graph can reference evidence.
- The user can write a check-in.
- The graph can be revised from the check-in.
- All sensitive data remains local unless the user explicitly configures an external provider.
