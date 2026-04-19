# ExecPlan: Phase 2 Static Life Map UI

## Goal

Render the example graph bundle as a playful static Life Map in the Svelte
frontend, using ontology-driven styles, a generic dynamic node component,
custom edges, and a detail drawer.

## Context

- Phase 0 and Phase 1 are already complete and pushed.
- Phase 2 must stay frontend-only and use fixture data.
- The map should not assume a fixed node taxonomy; it should read style and
  field definitions from the bundle ontology.

## Non-goals

- No LLM generation
- No RAG
- No backend graph generation or validation

## Files to read

- `AGENTS.md`
- `docs/STYLE_GUIDE.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/phases/phase-02-static-life-map-ui.md`
- `templates/example_graph_bundle.json`
- `docs/state/CURRENT_STATE.md`

## Planned changes

1. Add frontend dependencies for Svelte Flow, Rough.js, and ELK.js.
2. Add frontend graph types, fixture loader, ontology/style helpers, and layout mapping.
3. Build a generic dynamic node, custom edge, evidence/assumption badges, and detail drawer.
4. Replace the landing page body with a static rendered Life Map view and add unit coverage.

## Validation

Commands to run:

```bash
pnpm install
pnpm --filter web check
pnpm --filter web test:unit -- --run
UV_CACHE_DIR=.uv-cache pnpm lint
pnpm typecheck
```

Expected results:

- The example graph renders without crashing.
- Clicking a node opens the detail drawer.
- Unknown node types still render with fallback styling.

## Risks

- Svelte Flow sizing and custom node rendering can be finicky if the viewport container is not explicit.
- Over-styling could make the graph pretty but unreadable.

## Rollback

- Remove the new graph UI files and restore `apps/web/src/routes/+page.svelte`.

## Completion notes

- Completed:
  - Added ontology-driven frontend graph types, fixture bundle loader, flow builder, and ELK-based layout.
  - Implemented a generic dynamic node component with fallback-safe rendering for unknown node types.
  - Implemented a custom edge component with progression highlighting and hover labels.
  - Added a node detail drawer that reads dynamic fields, scores, evidence, and assumptions from the bundle ontology/data.
  - Reworked the landing page to render the static Life Map example in a responsive, playful mind-map layout.
  - Added unit coverage for graph styling and progression-path selection helpers.
- Tests run:
  - `pnpm --filter web check`
  - `pnpm --filter web test:unit -- --run`
  - `UV_CACHE_DIR=.uv-cache pnpm lint`
  - `pnpm typecheck`
  - `pnpm --filter web build`
- Known gaps:
  - No browser-driven interaction verification yet; the phase is validated through static checks, unit tests, and production build success.
  - The production client bundle is currently large because Svelte Flow and ELK are still loaded eagerly; code-splitting can be revisited later if needed.
