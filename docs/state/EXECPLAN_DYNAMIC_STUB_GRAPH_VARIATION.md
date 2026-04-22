# ExecPlan: Dynamic Stub Graph Variation

## Goal

Make the default local stub generator stop emitting a near-fixed six-node graph and instead vary node count, node types, and route shape by goal family, profile context, current-state context, and retrieved evidence.

## Context

- `apps/api/lifemap_api/infrastructure/llm_providers.py` currently powers the default `stub` LLM path.
- The product contract requires graph semantics to be dynamic per goal, even when the local fallback path is active.
- The current desktop UI already surfaces whatever graph bundle the API returns, so fixing the API shape is the highest-leverage change.

## Non-goals

- Replacing the stub provider with a real Ollama/OpenAI graph builder.
- Redesigning the desktop node renderer.
- Implementing full ontology generation for every possible goal domain.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/phases/phase-06-rag-grounded-generation.md`
- `docs/state/CURRENT_STATE.md`

## Planned changes

1. Parse goal, profile, current-state, and grounding packet sections from the stub prompt.
2. Preserve retrieved evidence items instead of replacing them with placeholder titles.
3. Emit goal-family-specific graph bundles so language goals and non-language goals differ in node count and ontology.
4. Add endpoint tests that fail if the stub regresses back to the fixed-six-node topology.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_map_generation.py
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- API generation tests pass.
- Language-goal stub graphs include language-specific nodes and more than six nodes.
- Non-language goals produce a different topology from the language graph.

## Risks

- The stub path is still heuristic, so overly broad keyword matching could misclassify some goals.
- If the retrieval packet is empty, the stub must still remain schema-valid.

## Rollback

- Revert `apps/api/lifemap_api/infrastructure/llm_providers.py` and `apps/api/tests/test_map_generation.py`.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
