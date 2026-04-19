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
```

The system is local-first. It should work without external network access after dependencies and local models are installed, except for explicit source fetching or optional external LLM usage.

## 2. Layering

### 2.1 Domain layer

Contains pure concepts:

- `Profile`
- `Goal`
- `SourceDocument`
- `SourceChunk`
- `GraphBundle`
- `GraphOntology`
- `GraphNode`
- `GraphEdge`
- `EvidenceItem`
- `CheckIn`
- `Decision`
- `RevisionProposal`

Domain layer must not import FastAPI, SQLAlchemy sessions, Svelte, HTTP clients, or LLM SDKs.

### 2.2 Application layer

Use cases:

- create/update profile
- create goal
- create map from manual input
- generate map with LLM
- ingest source
- retrieve evidence
- generate RAG-grounded map
- create check-in
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

### 2.3 Infrastructure layer

Implements:

- SQLite repositories
- LanceDB vector search
- Ollama provider
- OpenAI provider
- Crawl4AI fetcher
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
- forms
- API client
- stores
- layout/theme

No persistence logic or RAG logic in UI components.

## 3. API endpoint map

Initial API:

```text
GET    /health

GET    /profiles/default
PUT    /profiles/default

GET    /goals
POST   /goals
GET    /goals/{goal_id}
PATCH  /goals/{goal_id}
DELETE /goals/{goal_id}

GET    /maps/{map_id}
POST   /maps
POST   /goals/{goal_id}/maps/generate
POST   /maps/{map_id}/layout

GET    /sources
POST   /sources/manual
POST   /sources/url/preview
POST   /sources/url/ingest
GET    /sources/{source_id}
POST   /sources/search

POST   /goals/{goal_id}/checkins
GET    /goals/{goal_id}/checkins
POST   /maps/{map_id}/revise-from-checkin
```

## 4. Database model

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
```

Store graph bundle JSON as a full snapshot. This simplifies dynamic schema evolution.
Later, frequently queried fields can be indexed separately.

## 5. Graph rendering architecture

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

## 6. Dynamic graph generation pipeline

```text
User profile + goal
  -> normalize constraints
  -> optional source retrieval
  -> generate graph ontology
  -> generate nodes and edges
  -> validate bundle
  -> repair invalid bundle
  -> layout graph
  -> persist snapshot
  -> render
```

## 7. Error handling

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

## 8. Local-first privacy

Default storage:

- SQLite under `data/local.db`
- LanceDB under `data/lancedb/`
- Uploads under `data/uploads/`

These paths are ignored by git.

External calls must be explicit:

- Source fetching: user action required.
- External LLM: user config required.
- No telemetry by default.
