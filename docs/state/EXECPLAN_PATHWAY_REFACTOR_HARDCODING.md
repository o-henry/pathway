# ExecPlan: Pathway Hardcoding Refactor

## Goal

Remove the most risky hardcoded topic paths from Pathway research, collection, and graph-quality code while keeping existing behavior testable and shippable through small atomic commits.

## Context

Recent graph-generation work improved grounding and action fields, but introduced or exposed several brittle seams:

- `generation_grounding.py` still derives focus fragments from fixed goal families such as language/career/fitness.
- `researchPlanCollectorJobs.ts` contains English-speaking-specific seed URLs.
- generation and revision both depend on private graph-quality helpers inside `generation.py`.

The user explicitly requested refactoring and atomic commits for each refactor. The product contract forbids topic-specific hardcoded branching as the core strategy.

## Non-goals

- Do not redesign the full RAG/crawler architecture in this pass.
- Do not implement a new live public search provider.
- Do not change graph schema persistence.
- Do not refactor the whole `MainAppImpl.tsx` file in this pass; keep the blast radius bounded.

## Files to read

- AGENTS.md
- docs/PLANS.md
- docs/state/CURRENT_STATE.md
- apps/api/lifemap_api/application/generation_grounding.py
- apps/api/lifemap_api/application/generation.py
- apps/api/lifemap_api/application/revisions.py
- apps/desktop/src/app/researchPlanCollectorJobs.ts

## Planned changes

1. Replace goal-family focus fragments with generic goal/profile/current-state fragments and goal-analysis supplied queries.
2. Replace fixed English-learning collector URL seeds with query-based source-family search URLs.
3. Move shared graph-quality helpers out of `generation.py` into a dedicated application module and make generation/revision import that module.
4. Update tests and state docs after each bounded change.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_generation_grounding.py
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_map_generation.py apps/api/tests/test_revisions.py
UV_CACHE_DIR=.uv-cache uv run ruff check apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/application/revisions.py apps/api/lifemap_api/application/generation_grounding.py
pnpm --filter desktop exec tsc --noEmit
git diff --check
```

Expected results:

- Tests pass.
- No topic-specific research branching remains in the touched planner/collector paths.
- Each refactor is committed separately.

## Risks

- Removing topic seeds can reduce immediate collection hit rate until source discovery matures.
- Shared helper extraction may accidentally change validation order if not kept mechanical.

## Rollback

- Revert the specific atomic commit for the failing refactor.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
