# ExecPlan: Curriculum Grounding Trace

## Goal

Make each personalized curriculum node show why its instruction and sequence were chosen: which ranked sources shaped it, which user-state facts shaped it, and which progression condition places it in the path.

## Context

- Graph generation already requires complete curriculum fields.
- Grounding currently selects diverse evidence, but selected evidence loses query/ranking context once converted into graph evidence.
- Nodes can cite evidence IDs, but the context panel does not yet explain why those sources were ranked or why the node appears at that point in the curriculum.
- Source collection must remain bounded and policy-safe; this phase does not add broad crawling.

## Non-goals

- Do not introduce large-scale crawling or scraping bypass behavior.
- Do not hardcode topic-specific curricula.
- Do not delete or rewrite existing graph history.
- Do not make unsupported user-state claims look evidence-backed.

## Files to read

- AGENTS.md
- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/RAG_AND_CRAWLING_SPEC.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/phases/phase-05-source-library-rag.md`
- `docs/phases/phase-06-rag-grounded-generation.md`
- `docs/phases/phase-07-checkins-revisions.md`
- `docs/state/CURRENT_STATE.md`

## Planned changes

1. Preserve retrieval ranking context on evidence items: matched query labels, source layer, rank score, and a concise ranking reason.
2. Strengthen grounding selection so curriculum resources, profile fit, constraints, switching conditions, and failure modes are represented when available.
3. Add deterministic post-processing that annotates user-facing curriculum nodes with source-ranking, user-state, and sequence-basis fields.
4. Show those trace fields in the desktop selected-node action panel.
5. Add tests covering ranking metadata, node trace attachment, and UI display.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py apps/api/tests/test_graph_quality.py apps/api/tests/test_revisions.py
zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/pathwayWorkspaceUtils.test.ts
pnpm --filter desktop exec tsc --noEmit
git diff --check
pnpm secret-scan
```

Expected results:

- Tests pass.
- Generated maps preserve evidence IDs and now include curriculum trace fields on user-facing nodes.
- No secrets introduced.

## Risks

- Trace text could become too verbose in the panel. Keep it compact and truncate only where necessary.
- Ranking metadata must not imply a source proves more than its retrieved snippet supports.

## Rollback

- Revert the commit. The graph schema additions are optional fields, so older map bundles remain valid.

## Completion notes

- Completed:
  - Added ranking metadata to graph evidence items: rank score, matched query labels, source layer, and ranking reason.
  - Strengthened search/ranking bias toward user-owned/manual context and against metadata-only public URL candidates.
  - Reserved grounding selection slots for curriculum resources, profile fit, constraints, switching conditions, and failure modes when matching evidence exists.
  - Added deterministic curriculum trace attachment after graph validation for generation and revision flows.
  - Added trace fields to user-facing node data: `source_ranking_basis`, `user_state_basis`, and `curriculum_order_basis`.
  - Expanded the desktop selected-node panel logic and types so those trace fields are visible in the personalized curriculum list.
  - Documented ranking metadata and curriculum trace fields in the RAG and dynamic graph specs.
- Tests run:
  - `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py apps/api/tests/test_graph_quality.py apps/api/tests/test_revisions.py`
  - `zsh ./scripts/with-modern-node.sh pnpm --filter web exec vitest --root ../.. --run apps/desktop/src/app/pathwayWorkspaceUtils.test.ts`
  - `pnpm --filter desktop exec tsc --noEmit`
  - `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api/lifemap_api/application/curriculum_trace.py apps/api/lifemap_api/application/generation_grounding.py apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/application/revisions.py apps/api/lifemap_api/application/sources.py apps/api/lifemap_api/domain/graph_bundle.py apps/api/tests/test_generation_grounding.py apps/api/tests/test_map_generation.py`
  - `git diff --check`
  - `pnpm secret-scan`
- Known gaps:
  - Trace fields now explain selected-source ranking and current-state fit, but broader source discovery is still limited to the existing bounded collection targets.
  - Ranking reasons explain relevance selection; they do not claim a source proves more than its stored snippet supports.
