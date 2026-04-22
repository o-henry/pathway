# ExecPlan: Research Breadth and Diversity Grounding

## Goal

Increase Pathway's research depth so map generation pulls in more varied evidence families such as lived experience, failure patterns, switching conditions, and alternative routes instead of overfitting to a narrow top-similarity packet.

## Context

- The current RAG contract already calls for `user context`, `targeted evidence`, and `contextual expansion`.
- Existing retrieval planning was still shallow: a few generic goal/profile queries with score-heavy ranking.
- The user explicitly wants more varied routes grounded in many people's experiences and route-switching conditions.

## Non-goals

- Full broad web-search orchestration.
- Paywalled or policy-breaking crawling.
- A complete multi-agent scout/verifier runtime.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/RAG_AND_CRAWLING_SPEC.md
- docs/phases/phase-05-source-library-rag.md
- docs/phases/phase-06-rag-grounded-generation.md
- docs/state/CURRENT_STATE.md
- apps/api/lifemap_api/application/generation_grounding.py
- apps/api/lifemap_api/application/generation.py
- apps/api/lifemap_api/application/goal_analysis.py
- apps/api/lifemap_api/application/sources.py

## Planned changes

1. Expand retrieval planning beyond generic goal/profile queries into route-pattern, lived-experience, failure-mode, switching-condition, and alternative-route query families.
2. Select evidence with layer/source/query diversity instead of keeping only the narrowest top-similarity ordering.
3. Surface a grounding warning when the evidence packet is still too narrow.
4. Add focused tests for query breadth and evidence-family diversity.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py
UV_CACHE_DIR=.uv-cache uv run ruff check apps/api/lifemap_api/application/generation_grounding.py apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/config.py apps/api/tests/test_generation_grounding.py
pnpm secret-scan
```

Expected results:

- Query planner emits multiple research families for a live goal.
- Grounding packet includes more varied evidence layers when available.
- The graph prompt now nudges route diversity and switching conditions.

## Risks

- Broader retrieval defaults may increase prompt size and slightly reduce determinism.
- Diversity selection may surface slightly lower-similarity but strategically useful evidence.

## Rollback

- Restore the previous compact query planner and score-only hit selection.
- Revert the config defaults for query/evidence counts if prompt cost becomes too high.

## Completion notes

- Completed:
  - Expanded retrieval planning to include lived experience, failure modes, switching conditions, route patterns, and alternative routes, with current-state context folded into the query planner.
  - Added diversity-aware evidence selection so the grounding packet prefers varied layers and sources instead of only the highest-similarity cluster.
  - Added warnings when the retrieved evidence remains too narrow or lacks lived-experience material.
  - Increased default grounding breadth from 4 queries / 6 evidence items to 6 queries / 8 evidence items.
  - Added focused tests covering query-family expansion and diverse evidence selection.
- Tests run:
  - `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py`
  - `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api/lifemap_api/application/generation_grounding.py apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/config.py apps/api/tests/test_generation_grounding.py`
  - `pnpm secret-scan`
- Known gaps:
  - This improves use of already-ingested sources but does not yet implement a full public-web scout/search planner.
  - Diversity still depends on source metadata quality (`layer`, etc.), so inconsistent ingestion metadata can weaken the benefit.
