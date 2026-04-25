# Codex Tasks — Phase Prompts

Use these prompts one at a time. Do not ask Codex to implement all phases at once.

## Phase 0 prompt

```text
Read AGENTS.md, docs/CODEX_START_HERE.md, docs/IMPLEMENTATION_PLAN.md, docs/SECURITY_CHECKLIST.md, and docs/phases/phase-00-repo-bootstrap.md.
Execute Phase 0 only.
Create the monorepo skeleton, SvelteKit app, FastAPI app, package manager configs, .env.example, .gitignore, pre-commit and gitleaks config, minimal tests, health endpoint, and landing page.
Do not implement graph generation yet.
Run available checks and update docs/state/CURRENT_STATE.md.
```

## Phase 1 prompt

```text
Read AGENTS.md, docs/ARCHITECTURE.md, docs/DYNAMIC_GRAPH_SPEC.md, and docs/phases/phase-01-backend-domain-persistence.md.
Execute Phase 1 only.
Implement backend domain models, SQLite persistence, repositories, CRUD endpoints for profile/goals/maps/sources/checkins, and unit tests.
Do not implement LLM or RAG yet.
Run backend tests/lint and update docs/state/CURRENT_STATE.md.
```

## Phase 2 prompt

```text
Read AGENTS.md, docs/STYLE_GUIDE.md, docs/DYNAMIC_GRAPH_SPEC.md, and docs/phases/phase-02-static-life-map-ui.md.
Execute Phase 2 only.
Implement static Pathway graph rendering using Svelte Flow, custom nodes, custom edges, Rough.js/CSS sketch styling, node detail drawer, and the example graph bundle.
Do not implement LLM generation yet.
Run frontend tests/lint and update docs/state/CURRENT_STATE.md.
```

## Phase 3 prompt

```text
Read AGENTS.md, docs/DYNAMIC_GRAPH_SPEC.md, docs/ARCHITECTURE.md, and docs/phases/phase-03-dynamic-graph-schema-validation.md.
Execute Phase 3 only.
Implement dynamic GraphBundle schema validation in backend and matching TypeScript types in frontend. Enforce dynamic ontology, evidence refs, required dynamic fields, and progression DAG validation.
Run tests and update docs/state/CURRENT_STATE.md.
```

## Phase 4 prompt

```text
Read AGENTS.md, docs/DYNAMIC_GRAPH_SPEC.md, docs/phases/phase-04-llm-generation-no-rag.md, and docs/SECURITY_CHECKLIST.md.
Execute Phase 4 only.
Implement provider-based LLM graph generation without RAG. Use Codex GPT-5.5 through the logged-in Codex CLI session for desktop and backend AI analysis. Backend graph generation may use stub only as a deterministic local fallback. Implement validate-repair-validate loop.
Run tests and update docs/state/CURRENT_STATE.md.
```

## Phase 5 prompt

```text
Read AGENTS.md, docs/RAG_AND_CRAWLING_SPEC.md, docs/SECURITY_CHECKLIST.md, and docs/phases/phase-05-source-library-rag.md.
Execute Phase 5 only.
Implement manual source ingestion, permitted URL ingestion policy stubs, chunking, LanceDB vector storage, and retrieval endpoint.
Do not implement broad crawling or bypass mechanisms.
Run tests and update docs/state/CURRENT_STATE.md.
```

## Phase 6 prompt

```text
Read AGENTS.md, docs/RAG_AND_CRAWLING_SPEC.md, docs/DYNAMIC_GRAPH_SPEC.md, and docs/phases/phase-06-rag-grounded-generation.md.
Execute Phase 6 only.
Connect retrieval to graph generation. Ensure generated nodes reference evidence IDs or assumptions. Add UI evidence drawer and badges.
Run tests and update docs/state/CURRENT_STATE.md.
```

## Phase 7 prompt

```text
Read AGENTS.md, docs/phases/phase-07-checkins-revisions.md, docs/DYNAMIC_GRAPH_SPEC.md, and docs/ARCHITECTURE.md.
Execute Phase 7 only.
Implement check-in creation, graph revision proposals, diff UI, and accept/reject revision flow.
Run tests and update docs/state/CURRENT_STATE.md.
```

## Phase 8 prompt

```text
Read AGENTS.md, docs/phases/phase-08-quality-export-packaging.md, and docs/SECURITY_CHECKLIST.md.
Execute Phase 8 only.
Implement export/backup/restore, polish empty/loading/error states, add e2e tests, run security checks, and document final local run commands.
Update docs/state/CURRENT_STATE.md.
```
