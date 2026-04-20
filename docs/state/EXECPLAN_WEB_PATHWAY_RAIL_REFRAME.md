# ExecPlan: Web Pathway Rail Reframe

## Goal

Refine the web Pathway workspace so it keeps the learned RAIL UI tone and density, while feeling purpose-built for Pathway's graph-first decision workspace instead of an awkward shell transplant.

## Context

- The user wants the web version to be the primary target.
- The current web UI already has a strong shell, but the graph board and surrounding rails do not yet read as one coherent product language.
- The graph must remain the protagonist and the screen should feel like a decision room rather than a generic dashboard.

## Non-goals

- Do not reintroduce desktop/Tauri-specific UI requirements.
- Do not change backend contracts or graph schema.
- Do not add new product features beyond the UI reframe.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/IMPLEMENTATION_PLAN.md
- docs/ARCHITECTURE.md
- docs/DYNAMIC_GRAPH_SPEC.md
- docs/RAG_AND_CRAWLING_SPEC.md
- docs/SECURITY_CHECKLIST.md
- docs/phases/phase-02-static-life-map-ui.md
- docs/state/CURRENT_STATE.md
- apps/web/src/routes/+page.svelte
- apps/web/src/lib/components/lifemap/StaticLifeMap.svelte
- apps/web/src/lib/components/lifemap/GenericMindMapNode.svelte

## Planned changes

1. Rework the web workspace shell so the graph board is visually dominant and the side rails feel more deliberate and control-room-like.
2. Simplify the graph chrome by reducing auxiliary Svelte Flow controls and strengthening the editorial decision-board presentation.
3. Restyle graph nodes and edges to keep the RAIL tone while making Pathway branches feel compact, legible, and graph-first.
4. Validate with web checks and update current state notes.

## Validation

Commands to run:

```bash
pnpm --filter web check
pnpm --filter web build
```

Expected results:

- Web type/style checks pass.
- Web production build passes.
- The Pathway web workspace reads as a cohesive RAIL-informed Pathway surface rather than a transplanted shell.

## Risks

- Compacting graph nodes too far can hurt readability for long labels.
- Removing too much chrome may reduce discoverability of graph affordances.

## Rollback

- Revert the web route and lifemap component/style changes.
- Remove this ExecPlan if the work is abandoned.

## Completion notes

- Completed:
  - Reworked the web workspace shell so the graph board sits inside a stronger, darker RAIL-like control frame while remaining the dominant surface.
  - Simplified graph chrome in `StaticLifeMap` by removing extra flow widgets and retuning the decision-board background and legend treatment.
  - Restyled graph nodes and edges into a more cohesive RAIL-informed Pathway language with softer paper-like nodes, stronger goal emphasis, and lighter branching connectors.
  - Reframed the graph board again so the canvas is clearly primary: the node dossier is now a floating in-board sheet instead of a permanent side-column that steals width from the map.
  - Increased graph breathing room by tightening node dimensions and expanding branch spacing, then reduced outer rail widths so the center board reads as the main workspace.
  - Promoted the graph to the true primary surface by removing permanent left/right columns from the app shell and moving both intake/history and inspector tools into collapsible overlay rails that float above the canvas.
  - Added a graph-surface refinement pass informed by graph-visualization readability guidance: the board now uses a taller full-screen canvas, lighter cognitive chrome, and stage scaffolding so the node-link map reads more like a structured route surface than a widget on an empty page.
- Tests run:
  - `pnpm --filter web check`
  - `pnpm --filter web build`
- Known gaps:
  - I validated through Svelte checks and production build, not a fresh browser screenshot comparison in this sandboxed session.
  - Some nodes with unusually long labels may still want smarter width handling or alternate truncation rules in a follow-up pass.
  - The next design pass should use runtime screenshots and critique against stronger graph-first inspiration boards so the visual hierarchy keeps improving instead of relying on code-only judgment.
