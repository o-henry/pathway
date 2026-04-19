# Phase 3 — Dynamic Graph Schema and Validation

## Goal

Implement and test `GraphBundle` validation.

## Non-goals

- No LLM calls.
- No RAG.

## Deliverables

- Backend Pydantic models.
- Frontend TypeScript types.
- Validation service:
  - unique IDs
  - ontology type checks
  - evidence/assumption refs
  - required dynamic fields
  - progression DAG validation
- Tests with valid and invalid bundles.

## Acceptance criteria

- Invalid node type is rejected.
- Missing edge endpoint is rejected.
- Missing evidence ref is rejected.
- Cycle in progression edges is rejected.
- Cycle in reference-only edges is allowed.
