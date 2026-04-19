# Execplan Phase 06

## Goal

Ground map generation in retrieved evidence from the local source library.

## Delivered

- Added a retrieval query planner that composes goal, success criteria, and profile constraints into reusable search queries.
- Added a grounding packet builder that converts retrieved source hits into canonical evidence IDs for generation.
- Updated the map generation prompt so the model can only use provided evidence IDs and must move unsupported claims into assumptions.
- Added post-generation grounding validation that rejects invented evidence IDs and canonicalizes evidence items back to the retrieved packet.
- Wired grounded generation through the goal map generation endpoint.
- Updated the generation panel to surface evidence/assumption counts after generation.
- Added integration tests for:
  - successful grounded generation
  - repair flow after invalid evidence IDs
  - failure when nonexistent evidence refs remain

## Verification

- `uv run pytest`
- `uv run ruff check apps/api`
- `UV_CACHE_DIR=.uv-cache pnpm lint`
- `pnpm typecheck`
- `pnpm --filter web build`

## Notes

- Grounding currently uses retrieved snippets rather than full remote fetch summaries.
- If no evidence is found, generation remains allowed but the prompt and warnings steer the model toward explicit assumptions.
- The node detail drawer already serves as the evidence drawer for referenced evidence and assumptions.
