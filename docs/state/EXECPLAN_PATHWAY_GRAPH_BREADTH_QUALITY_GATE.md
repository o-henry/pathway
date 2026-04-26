# ExecPlan: Pathway Graph Breadth Quality Gate

## Goal

Make generated Pathway maps feel like route atlases rather than thin two-node plans.

## Context

- The product contract requires many possible routes, trade-offs, missed options, checkpoints, and route switches.
- Current generation prompt still prefers `4 to 9 nodes`, which invites shallow maps.
- Grounding query planning can fill all default query slots before using goal-analysis research-plan queries.
- The fix should preserve local-first, evidence-aware behavior and avoid pretending to enumerate every possible future.

## Non-goals

- No broad automatic crawling.
- No destructive graph pruning.
- No massive hundred-node first render that overwhelms the UI.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/RAG_AND_CRAWLING_SPEC.md
- docs/DYNAMIC_GRAPH_SPEC.md
- docs/phases/phase-06-rag-grounded-generation.md
- docs/state/CURRENT_STATE.md
- apps/api/lifemap_api/application/generation.py
- apps/api/lifemap_api/application/generation_grounding.py
- apps/api/lifemap_api/infrastructure/llm_providers.py
- apps/api/tests/test_generation_grounding.py
- apps/api/tests/test_map_generation.py

## Planned Changes

1. Replace the compact-map prompt with a route-atlas contract: richer first maps, multiple route families, alternative branches, checkpoints, risks, and switch conditions.
2. Add a generation-only shape quality gate that rejects overly sparse candidate bundles and uses the existing repair loop to request a richer graph.
3. Reserve retrieval query slots for analysis/research-plan queries so specific scout planning is not starved by generic base queries.
4. Update the deterministic stub and focused tests so fallback generation also demonstrates richer route topology.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py
UV_CACHE_DIR=.uv-cache uv run ruff check apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/application/generation_grounding.py apps/api/lifemap_api/infrastructure/llm_providers.py apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py
git diff --check
```

Expected results:

- Sparse generated bundles are rejected before persistence.
- Repair prompts explain route breadth requirements.
- Analysis research queries appear in grounding plans under the default query limit.
- Stub and tests now expect richer route maps.

## Risks

- Richer maps increase prompt and render size.
- A stricter quality gate may require one additional LLM repair attempt when the first response is too small.

## Rollback

- Remove the generation shape gate and restore the compact prompt/node-count tests.

## Completion Notes

- Completed:
  - Replaced the compact `4 to 9 nodes` generation instruction with a route-atlas contract that asks for 12 to 24 nodes, multiple route families, representative variants, checkpoints, risks, switch conditions, and opportunity-cost nodes.
  - Added a generation-only pathway shape quality gate. Sparse valid JSON now fails before persistence and is sent through the existing repair loop with explicit expansion instructions.
  - Changed grounding query planning so goal-analysis research queries get reserved slots under the default query limit instead of being starved by generic base queries.
  - Included grounding warnings in the serialized evidence packet sent to generation.
  - Expanded the deterministic stub provider so fallback generation produces richer language and generic route maps.
  - Passed current-state context into revision grounding packet construction.
- Tests run:
  - `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_revisions.py apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py`
  - `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/application/generation_grounding.py apps/api/lifemap_api/application/revisions.py apps/api/lifemap_api/infrastructure/llm_providers.py apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py apps/api/tests/test_revisions.py`
  - `UV_CACHE_DIR=.uv-cache uv run python -m py_compile apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/application/generation_grounding.py apps/api/lifemap_api/application/revisions.py apps/api/lifemap_api/infrastructure/llm_providers.py apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py`
  - `pnpm secret-scan`
  - `git diff --check`
- Known gaps:
  - This still represents large route spaces as families and representative variants, not a literal hundred-node first render.
  - The deterministic stub is broader now, but lived-experience richness still depends on the collector/source library actually gathering varied sources.
