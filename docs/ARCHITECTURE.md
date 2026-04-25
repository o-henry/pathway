# Architecture

## 1. System overview

```text
Browser / SvelteKit UI
  -> FastAPI HTTP API
    -> Application services
      -> Domain models and validators
      -> SQLite repositories
      -> LanceDB vector store
      -> LLM provider interface
      -> Embedding provider interface
      -> Source ingestion adapters
      -> Research orchestration roles
```

The system is local-first. It should work without external network access after dependencies and local models are installed, except for explicit source fetching or optional external LLM usage.
The graph workspace is the center of the product; support panels exist to help create, inspect, revise, and ground the graph.

## 2. Layering

### 2.1 Domain layer

Contains pure concepts:

- `Profile`
- `Goal`
- `GoalAnalysis`
- `ResourceDimension`
- `SourceDocument`
- `SourceChunk`
- `GraphBundle`
- `GraphOntology`
- `GraphNode`
- `GraphEdge`
- `EvidenceItem`
- `CurrentStateSnapshot`
- `StateUpdate`
- `RouteSelection`
- `Decision`
- `RevisionProposal`
- `ResearchRun`
- `ResearchFinding`

Domain layer must not import FastAPI, SQLAlchemy sessions, Svelte, HTTP clients, or LLM SDKs.

### 2.2 Application layer

Use cases:

- create/update profile
- analyze goal
- infer required resource dimensions
- create goal
- create/update current state snapshot
- append state update
- select active route
- create map from manual input
- generate map with LLM
- ingest source
- retrieve evidence
- generate RAG-grounded map
- create state update
- propose map revision
- accept/reject revision

Application services depend on protocols/interfaces:

- `GoalRepository`
- `GraphRepository`
- `SourceRepository`
- `VectorSearchPort`
- `LLMProvider`
- `EmbeddingProvider`
- `SourceFetcher`
- `ResearchRole`
- `ResearchPlanner`

### 2.3 Infrastructure layer

Implements:

- SQLite repositories
- LanceDB vector search
- Codex CLI provider
- deterministic stub provider
- Crawl4AI fetcher
- Lightpanda-backed renderer when JS execution is needed
- Scrapy crawl queue/orchestration when breadth increases
- Scrapling parser, restricted
- file storage
- config loading

### 2.4 API layer

FastAPI routers only:

- validate request DTOs
- call application services
- return response DTOs
- handle HTTP errors

No business logic in route handlers.

### 2.5 Web layer

SvelteKit UI:

- routes
- graph rendering
- intake forms
- API client
- stores
- layout/theme

No persistence logic or RAG logic in UI components.
The center column should remain the graph workspace whenever possible.

## 3. Research orchestration

Pathway should evolve toward a bounded orchestration model:

```text
Goal statement
  -> goal analyst
  -> resource-dimension inference
  -> targeted query planner
  -> scout agents
  -> skeptic/verifier
  -> evidence packet
  -> graph builder
  -> graph validator / repair
```

This does not require many runtime agents on day one.
It does require keeping the roles explicit in code so the system does not collapse into one giant prompt with mixed responsibilities.

## 4. API endpoint map

Current and near-term API:

```text
GET    /health

GET    /profiles/default
PUT    /profiles/default

GET    /goals
POST   /goals
GET    /goals/{goal_id}
PATCH  /goals/{goal_id}
DELETE /goals/{goal_id}
POST   /goals/{goal_id}/analysis
GET    /goals/{goal_id}/current-state
PUT    /goals/{goal_id}/current-state
GET    /goals/{goal_id}/state-updates
POST   /goals/{goal_id}/state-updates

POST   /goals/intake/analyze
POST   /goals/intake/questions

GET    /maps/{map_id}
POST   /maps
POST   /goals/{goal_id}/maps/generate
POST   /goals/{goal_id}/pathways/generate
POST   /maps/{map_id}/layout
GET    /pathways/{pathway_id}
GET    /pathways/{pathway_id}/route-selection
PUT    /pathways/{pathway_id}/route-selection

GET    /sources
POST   /sources/manual
POST   /sources/url/preview
POST   /sources/url/ingest
GET    /sources/{source_id}
POST   /sources/search

POST   /goals/{goal_id}/checkins
GET    /goals/{goal_id}/checkins
POST   /maps/{map_id}/revise-from-checkin
POST   /pathways/{pathway_id}/revision-previews
GET    /revision-previews/{proposal_id}
POST   /revision-previews/{proposal_id}/accept
POST   /revision-previews/{proposal_id}/reject
```

The `intake` endpoints may initially be stubs or a phased feature, but the architecture should reserve space for them.
Legacy `/maps`, `/checkins`, and revision-proposal routes may continue to exist during transition; newer UI flows should prefer the Pathway/state terminology.

## 5. Database model

SQLite tables:

```text
profiles
  id TEXT PRIMARY KEY
  display_name TEXT
  age INTEGER NULL
  weekly_free_hours REAL NULL
  monthly_budget_amount REAL NULL
  monthly_budget_currency TEXT NULL
  energy_level TEXT NULL
  preference_tags_json TEXT
  constraints_json TEXT
  created_at TEXT
  updated_at TEXT

goals
  id TEXT PRIMARY KEY
  profile_id TEXT
  title TEXT
  description TEXT
  category TEXT
  deadline TEXT NULL
  success_criteria TEXT
  status TEXT
  created_at TEXT
  updated_at TEXT

life_maps
  id TEXT PRIMARY KEY
  goal_id TEXT
  title TEXT
  graph_bundle_json TEXT
  active_revision_id TEXT NULL
  created_at TEXT
  updated_at TEXT

map_revisions
  id TEXT PRIMARY KEY
  map_id TEXT
  parent_revision_id TEXT NULL
  graph_bundle_json TEXT
  reason TEXT
  created_at TEXT

sources
  id TEXT PRIMARY KEY
  title TEXT
  url TEXT NULL
  source_type TEXT
  content_text TEXT
  content_hash TEXT
  metadata_json TEXT
  created_at TEXT
  updated_at TEXT

source_chunks
  id TEXT PRIMARY KEY
  source_id TEXT
  chunk_index INTEGER
  text TEXT
  token_estimate INTEGER
  metadata_json TEXT
  embedding_status TEXT
  created_at TEXT

checkins
  id TEXT PRIMARY KEY
  goal_id TEXT
  map_id TEXT NULL
  checkin_date TEXT
  actual_time_spent REAL NULL
  actual_money_spent REAL NULL
  mood TEXT NULL
  progress_summary TEXT
  blockers TEXT
  next_adjustment TEXT
  created_at TEXT

decisions
  id TEXT PRIMARY KEY
  goal_id TEXT
  map_id TEXT
  node_id TEXT
  decision_text TEXT
  selected_at TEXT
  metadata_json TEXT

research_runs
  id TEXT PRIMARY KEY
  goal_id TEXT
  objective TEXT
  planner_output_json TEXT
  status TEXT
  created_at TEXT

research_findings
  id TEXT PRIMARY KEY
  run_id TEXT
  role TEXT
  source_id TEXT NULL
  finding_json TEXT
  created_at TEXT
```

Store graph bundle JSON as a full snapshot. This simplifies dynamic schema evolution.
Later, frequently queried fields can be indexed separately.

## 6. Graph rendering architecture

Frontend graph modules:

```text
src/lib/graph/
  types.ts
  normalizeGraphBundle.ts
  layoutElk.ts
  styleFromOntology.ts
  evidence.ts
  riskScoring.ts
  svelteFlowAdapter.ts
```

Rules:

- UI should not assume a fixed node type enum.
- Node visual style is computed from `bundle.ontology.node_types`.
- Unknown types render as `GenericMindMapNode`.
- Node detail panel displays dynamic fields using field definitions.
- Evidence badges use `node.evidence_refs`.
- Progression path highlighting uses edge roles.
- Lost opportunity / invalidated path overlays should be possible without breaking the base schema.

## 7. Dynamic graph generation pipeline

```text
User goal statement
  -> infer missing resource dimensions
  -> collect user facts
  -> targeted query planning
  -> optional local + permitted web retrieval
  -> skeptic / verifier pass
  -> generate graph ontology
  -> generate nodes and edges
  -> validate bundle
  -> repair invalid bundle
  -> layout graph
  -> persist snapshot
  -> render
```

## 8. Error handling

Failure categories:

- invalid user input
- invalid generated graph
- LLM unavailable
- embedding model unavailable
- source fetch blocked by policy
- source extraction failed
- DB unavailable

Each category must have:

- user-facing message
- developer log without secrets
- suggested next action

## 9. Local-first privacy

Default storage:

- SQLite under `data/local.db`
- LanceDB under `data/lancedb/`
- Uploads under `data/uploads/`

These paths are ignored by git.

External calls must be explicit:

- Source fetching: user action required.
- External LLM: user config required.
- No telemetry by default.
