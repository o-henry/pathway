# Phase 2 — Static Life Map UI

## Goal

Render a static example dynamic graph bundle in a playful mind-map style.

## Non-goals

- No LLM generation.
- No RAG.
- No backend graph generation.

## Deliverables

- Load `templates/example_graph_bundle.json` or equivalent frontend fixture.
- Render with Svelte Flow.
- Custom generic dynamic node component.
- Custom edge component/style.
- Detail drawer for node data.
- Evidence/assumption badges.
- Basic responsive layout.

## Acceptance criteria

- The example graph displays.
- Node type styles come from ontology.
- Unknown node type does not crash.
- Clicking a node opens detail drawer.
- Visual style follows `docs/STYLE_GUIDE.md`.
