# ExecPlan: Agent-Led Pathway Research Loop Foundation

## Goal

Make Pathway's first step match the intended product loop: a natural-language goal produces agent-shaped follow-up questions and a concrete research plan before graph generation. The generated plan should be visible to the UI and usable by later collector-backed source collection.

## Context

- `GoalAnalysis` is currently category/template based.
- Graph generation already consumes `GoalAnalysis.research_questions` as retrieval queries.
- Source ingestion and local RAG exist, but automatic collector execution is still incomplete.
- This phase should create the contract that lets the Pathway agent decide what to ask and what to collect without hardcoded topic branching.

## Non-goals

- Do not implement broad automatic crawling in this pass.
- Do not bypass robots, paywalls, auth walls, captcha, or anti-bot protections.
- Do not remove existing graph/revision behavior.
- Do not package collector runtimes into git.

## Files to read

- `docs/phases/phase-05-source-library-rag.md`
- `docs/phases/phase-06-rag-grounded-generation.md`
- `docs/RAG_AND_CRAWLING_SPEC.md`
- `apps/api/lifemap_api/application/goal_analysis.py`
- `apps/api/lifemap_api/application/generation.py`
- `apps/desktop/src/app/MainAppImpl.tsx`

## Planned changes

1. Extend `GoalAnalysis` with agent-style `followup_questions` and `research_plan`.
2. Make goal analysis use the configured LLM provider when possible, with a deterministic local fallback.
3. Persist the new analysis fields with a SQLite-compatible lightweight migration.
4. Feed the richer research plan into graph generation prompts and retrieval query expansion.
5. Show follow-up questions and collection targets in the desktop sidebar.
6. Add focused backend tests for dynamic intake/research-plan behavior.

## Validation

Commands to run:

```bash
uv run pytest apps/api/tests/test_goal_analysis.py apps/api/tests/test_map_generation.py
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Goal analysis returns non-empty follow-up questions and research targets.
- Existing generation tests still pass.
- Desktop TypeScript still typechecks.

## Risks

- Existing local SQLite databases need new nullable/default JSON columns; the startup migration must be conservative.
- Stub generation remains deterministic, so truly rich agent analysis still requires a real provider.

## Rollback

- Revert the touched backend and desktop files.
- The added SQLite columns are additive and can be left in place safely.

## Completion notes

- Completed:
  - Extended `GoalAnalysis` with `followup_questions` and `research_plan`.
  - Replaced category-template goal analysis with an LLM-backed analyst prompt and deterministic local fallback.
  - Added additive SQLite migration support for existing `goal_analyses` tables.
  - Fed research-plan queries into RAG grounding query expansion for graph generation.
  - Exposed follow-up questions and collection targets in the desktop workflow sidebar.
  - Added backend tests for the new analysis contract.
- Tests run:
  - `uv run pytest apps/api/tests/test_goal_analysis.py apps/api/tests/test_map_generation.py`
  - `pnpm --filter desktop exec tsc --noEmit`
  - `uv run ruff check apps/api/lifemap_api/application/goal_analysis.py apps/api/lifemap_api/infrastructure/db.py apps/api/lifemap_api/infrastructure/repositories.py apps/api/tests/test_goal_analysis.py`
- Known gaps:
  - Collector execution is still the next phase: this pass creates the agent research plan but does not yet run Crawl4AI/Scrapling/Lightpanda to fill the source library.
  - The default stub provider gives deterministic planner output; truly goal-specific intake quality depends on enabling a real LLM provider.
