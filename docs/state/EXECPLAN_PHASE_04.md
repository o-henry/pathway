# Execplan Phase 04

## Goal

Implement LLM-based graph generation without RAG, while preserving the dynamic ontology contract and keeping provider integration local-first.

## Completed

- Added `LLMProvider` protocol for structured JSON generation.
- Added provider selection with:
  - `CodexCliProvider` as the logged-in Codex GPT-5.5 backend analysis path.
  - `StubPathwayProvider` as the deterministic local fallback for tests and graph stubs.
- Added generation service with:
  - system/user prompt builders,
  - JSON-schema-constrained generation,
  - validate-repair-validate loop,
  - goal-aware bundle normalization.
- Added `POST /goals/{goal_id}/maps/generate`.
- Added backend tests for:
  - successful map generation,
  - invalid-first-response repair flow,
  - irrecoverable generation failure.
- Added a minimal frontend generation panel that:
  - upserts the default profile,
  - creates a goal,
  - calls the generation endpoint,
  - swaps the displayed graph bundle with the generated result.
- Enabled local dev CORS for the web frontend talking to the API.

## Verification

- `UV_CACHE_DIR=.uv-cache uv sync`
- `UV_CACHE_DIR=.uv-cache uv run pytest`
- `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api`
- `pnpm typecheck`
- `UV_CACHE_DIR=.uv-cache pnpm lint`
- `pnpm --filter web build`

## Notes

- Generation remains schema-driven and ontology-driven; rendering does not depend on predeclared node enums.
- The provider layer is isolated so future RAG grounding can wrap the same generation service without rewriting the endpoint contract.
- The frontend generation panel is intentionally thin for this phase; richer workspace orchestration belongs in later phases.
