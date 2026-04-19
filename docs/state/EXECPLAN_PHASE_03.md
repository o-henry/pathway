# ExecPlan: Phase 3 Dynamic Graph Schema and Validation

## Goal

Implement a validated dynamic `GraphBundle` contract in the backend and align the
frontend TypeScript types with the same envelope.

## Context

- Phase 0, Phase 1, and Phase 2 are already complete and pushed.
- The app must keep a dynamic ontology. Validation must enforce structure
  without introducing a hardcoded node taxonomy.
- Phase 3 should stay offline and deterministic. No LLM or RAG calls.

## Non-goals

- No graph generation
- No retrieval
- No crawling

## Files to read

- `AGENTS.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/phases/phase-03-dynamic-graph-schema-validation.md`
- `docs/state/CURRENT_STATE.md`

## Planned changes

1. Add backend Pydantic models for `GraphBundle`, ontology, nodes, edges, evidence, and assumptions.
2. Implement validation rules for ontology references, required dynamic fields, evidence/assumption refs, score ranges, and progression DAG checks.
3. Use the validated model in map create/read flows and align frontend TypeScript graph types with the backend shape.
4. Add valid/invalid bundle tests plus API boundary coverage.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest
UV_CACHE_DIR=.uv-cache uv run ruff check apps/api
UV_CACHE_DIR=.uv-cache pnpm lint
pnpm typecheck
```

Expected results:

- Invalid node types are rejected.
- Missing edge endpoints are rejected.
- Missing evidence refs are rejected.
- Progression cycles are rejected.
- Reference-only cycles remain allowed.

## Risks

- Over-validating graph semantics could accidentally reintroduce implicit hardcoded business rules.
- If read/write layers keep using raw dicts inconsistently, later LLM phases will drift.

## Rollback

- Remove `apps/api/lifemap_api/domain/graph_bundle.py`
- Revert `LifeMapCreate` and `LifeMap` to raw `dict[str, Any]` graph payloads
- Restore tests to the old minimal raw JSON fixture

## Completion notes

- Completed:
  - Added backend `GraphBundle` Pydantic models and a reusable `validate_graph_bundle` entrypoint.
  - Enforced ontology type references, required dynamic fields, evidence/assumption refs, score bounds, and progression-only DAG validation.
  - Updated map persistence to store validated graph bundle snapshots as JSON and rehydrate them back into typed domain models.
  - Aligned frontend graph types with backend envelope additions such as `weight`, `style_overrides`, `status`, `created_from`, and `revision_meta`.
  - Added domain, repository, and API tests for valid and invalid graph bundles.
- Tests run:
  - `UV_CACHE_DIR=.uv-cache uv run pytest`
  - `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api`
  - `UV_CACHE_DIR=.uv-cache pnpm lint`
  - `pnpm typecheck`
- Known gaps:
  - Validation does not yet infer “external claim” semantics; evidence-vs-assumption provenance remains structural rather than semantic.
  - Frontend still trusts fixture/runtime graph shape and does not run its own schema validator yet.
