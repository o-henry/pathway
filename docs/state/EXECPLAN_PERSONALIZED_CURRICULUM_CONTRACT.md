# ExecPlan: Personalized Curriculum Contract

## Goal

Make generated Pathway maps behave like evidence-grounded, personal curricula rather than shallow route labels or generic advice.

## Context

- The user clarified that Pathway must provide a personally tailored, evolving curriculum for the user's request/goal.
- The curriculum must be easy to read and follow, with detailed practical instructions.
- Personalization must not become hallucination: claims should come from user state, user sources, collected evidence, or explicit assumptions.
- Existing UI work made action content more visible, but backend generation and quality gates still allow weak or generic action content.

## Non-goals

- Do not introduce broad web crawling or bypass behavior.
- Do not hardcode goal-specific curriculum logic for English, language learning, career, or any topic.
- Do not change persistence schema or delete existing graph history.
- Do not make unsupported factual claims appear evidence-backed.

## Planned changes

1. Strengthen the graph-generation prompt around a `personal curriculum` contract.
2. Require user-facing route/support nodes to contain a full action set, not just one action-like field.
3. Add curriculum fields for personalization, cadence, resources, progression, grounding, and switch conditions.
4. Make deterministic fallback action attachment produce fuller, evidence-linked curriculum instructions.
5. Render more of the action/curriculum fields in the selected-node panel instead of truncating them away.
6. Add focused tests so sparse/generic action nodes fail quality validation.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_graph_quality.py apps/api/tests/test_map_generation.py
zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/pathwayWorkspaceUtils.test.ts
pnpm --filter desktop exec tsc --noEmit
git diff --check
pnpm secret-scan
```

## Completion notes

- Completed:
  - Strengthened generation and revision prompts so every route/checkpoint/risk/cost/switch/fallback/curriculum/media/community/tutor/practice node must carry a complete personalized curriculum card.
  - Added deterministic graph-quality enforcement for curriculum fields: practical step, detailed execution, success check, recording format, switch condition, fit reason, evidence basis, personalization basis, resource plan, session cadence, and progression rule.
  - Expanded the Codex strict output schema so generated node data can contain the new curriculum fields.
  - Improved fallback action attachment so weak generated nodes receive evidence-linked, honest curriculum scaffolding instead of empty or generic panel content.
  - Expanded the selected-node panel extraction so the desktop UI shows the full curriculum sequence instead of truncating after a few generic fields.
  - Documented the product-level personal curriculum contract in `docs/PATHWAY_REFRAME.md` and the graph data contract in `docs/DYNAMIC_GRAPH_SPEC.md`.
- Tests run:
  - `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_graph_quality.py apps/api/tests/test_map_generation.py apps/api/tests/test_generation_grounding.py apps/api/tests/test_revisions.py`
  - `zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/pathwayWorkspaceUtils.test.ts`
  - `pnpm --filter desktop exec tsc --noEmit`
  - `git diff --check`
  - `pnpm secret-scan`
- Known gaps:
  - The app now rejects or repairs sparse curriculum nodes, but true personalization depth still depends on the quality of collected sources and user-state capture.
  - Broader source discovery and richer evidence ranking remain future backend work.
