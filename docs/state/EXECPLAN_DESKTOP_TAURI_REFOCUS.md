# ExecPlan: Desktop Tauri Refocus

## Goal

Make Pathway run as a Tauri-first desktop app again, with `pnpm dev` launching the desktop runtime and the workflow tab presenting the graph canvas as the dominant workspace surface.

## Context

- The repo currently contains both a Svelte web app under `apps/web` and a React desktop app under `apps/desktop`.
- `src-tauri/tauri.conf.json` still points `beforeDevCommand` at the root `pnpm dev`, which was recently changed to a web-first flow and is now inconsistent with `devUrl`.
- The desktop workflow tab in `apps/desktop/src/app/MainAppImpl.tsx` still uses a two-column dashboard layout, so the graph is not the clear protagonist.
- `apps/desktop/src/app/PathwayRailCanvas.tsx` already adapts Pathway bundles into the imported RAIL canvas runtime, but the presentation still reads like a compact adapter rather than a primary decision surface.

## Non-goals

- Do not remove the existing web app from the repository.
- Do not rewrite the imported RAIL canvas runtime from scratch.
- Do not solve final production bundling of the Python backend in this pass.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/IMPLEMENTATION_PLAN.md
- docs/ARCHITECTURE.md
- docs/phases/phase-02-static-life-map-ui.md
- docs/state/CURRENT_STATE.md
- package.json
- src-tauri/tauri.conf.json
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/pathway.css

## Planned changes

1. Rewire the root and Tauri dev scripts so the default local run path is desktop-only and Tauri starts the desktop UI plus API services coherently.
2. Rebuild the workflow tab into a graph-dominant shell where the canvas owns nearly the full viewport and secondary controls live in overlay panels.
3. Strengthen the Pathway canvas presentation and interaction feel so selection, zoom, and branch reading are clearer in the desktop runtime.
4. Validate desktop typecheck/build and update README plus state docs for the restored Tauri-first workflow.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
pnpm --filter desktop build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected results:

- Desktop typecheck passes.
- Desktop production build passes.
- Tauri config points to the desktop runtime rather than the web-first dev flow.

## Risks

- Desktop-specific layout overrides may drift from the imported upstream RAIL runtime markup.
- Repointing root dev scripts can surprise older web-only habits if README and state notes are not updated in the same pass.
- Tauri startup still depends on a locally available Python/uv environment for the API process.

## Rollback

- Revert the root script changes in `package.json` and `src-tauri/tauri.conf.json`.
- Revert the workflow tab and Pathway canvas edits in `apps/desktop/src/app/MainAppImpl.tsx`, `apps/desktop/src/app/PathwayRailCanvas.tsx`, and `apps/desktop/src/pathway.css`.
- Remove this ExecPlan if the task is abandoned.

## Completion notes

- Completed:
  - Rewired the root and Tauri dev scripts so `pnpm dev` is desktop-first again and Tauri now starts the desktop UI plus API services instead of the web-first flow.
  - Rebuilt the workflow tab into a graph-dominant stage with overlay metrics, a compact Pathway loop dock, a persistent agent request lane, and a slide-over inspector that no longer permanently reduces canvas width.
  - Retuned the Pathway canvas layout and node sizing so the graph reads larger on load and better occupies the available desktop viewport.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - `pnpm --filter desktop build`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
- Known gaps:
  - The agent request lane still writes through the existing state-update API; the deeper follow-up question loop is not yet fully modeled as a conversational revision workflow.
  - Desktop bundle size remains large and still wants chunk-splitting work.
  - I validated through typecheck/build plus Tauri config wiring, not through a fresh runtime screenshot in this sandboxed session.
