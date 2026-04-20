# ExecPlan: RAIL UI Pivot for Pathway Desktop

## Goal

Replace the current Svelte-first desktop-facing UI path with a Tauri + React desktop app that adopts the actual RAIL shell direction and hosts Pathway's graph-first workflow inside it.

## Context

- The repo already contains a working backend and a first `src-tauri/` shell.
- The current `apps/web` Svelte UI remains in the repo but does not match the user's existing RAIL app.
- The user explicitly wants the product to feel like their RAIL desktop app, while Pathway-specific graph and decision logic stays intact.
- We should reuse the RAIL shell/layout language directly where practical, but avoid dragging over unrelated app-specific providers, i18n, and internal features.

## Non-goals

- Do not package the Python backend into a fully self-contained production desktop bundle.
- Do not migrate every existing Svelte component into React.
- Do not reproduce every RAIL feature unrelated to Pathway.

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
- docs/phases/phase-08-quality-export-packaging.md
- docs/state/CURRENT_STATE.md

## Planned changes

1. Add a new `apps/desktop` React/Vite frontend aligned with the RAIL shell structure and visual language.
2. Implement a Pathway workspace in that shell with:
   - goal creation
   - goal analysis trigger
   - pathway generation trigger
   - graph-first main board
   - route selection
   - state update logging
   - map/history browsing
3. Repoint the Tauri config and root scripts so the desktop runtime uses the new React app instead of the previous Svelte app.
4. Document the pivot and update current state notes.

## Validation

Commands to run:

```bash
pnpm install
pnpm --filter desktop build
pnpm --filter desktop exec tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected results:

- The React desktop frontend builds successfully.
- Tauri still validates against the updated frontend path.
- No secrets or local data are introduced.

## Risks

- A partial transplant could still feel "inspired by" RAIL rather than close enough to the user's app.
- The backend remains development-hosted through `uv`, so desktop runtime is still a dev shell rather than final packaging.
- The new React desktop app can temporarily duplicate logic/types already present in the Svelte app.

## Rollback

- Point Tauri `build.devUrl` and `build.frontendDist` back to `apps/web`.
- Remove `apps/desktop`.
- Restore root scripts to the Svelte app targets.

## Completion notes

- Completed:
  - Verified the earlier user complaint was correct: the first pass only copied shell/nav/theme assets and not the real RAIL workspace runtime.
  - Cloned the upstream `o-rail` repository and audited the actual app layers responsible for the real UX: `src/app/MainAppImpl.tsx`, `src/app/main/presentation/*`, `src/pages/workflow/*`, and related canvas/runtime hooks.
  - Preserved the earlier Pathway-specific desktop rewrite in `apps/desktop/pathway_snapshot/` so its API and graph logic can be reused later.
  - Replaced the desktop frontend baseline with a full upstream `o-rail` frontend snapshot under `apps/desktop/src`, `apps/desktop/public`, `apps/desktop/index.html`, `apps/desktop/vite.config.ts`, and TypeScript config files.
  - Updated desktop package dependencies so the imported RAIL frontend now builds inside this monorepo.
  - Adjusted desktop TypeScript config to exclude `*.test.*` files from runtime typecheck/build so the imported app can be compiled as an application baseline.
  - Reattached the Pathway desktop workflow by switching `apps/desktop/src/app/MainAppImpl.tsx` to the Pathway goal / map / state-update implementation, while keeping the imported upstream RAIL shell/style baseline in place.
  - Restored Pathway-specific app framing details such as `Pathway` document title, `pathway_ui_locale` storage isolation, and `ko/en` locale cycling.
  - Replaced the workflow tab's temporary custom board with a `PathwayRailCanvas` adapter that renders Pathway bundles through the original RAIL workflow canvas runtime.
  - Restored core graph interaction on that canvas for Pathway nodes, including selection and direct drag repositioning.
  - Added a Pathway-specific concept-map skin and less rigid clustered layout pass so the graph reads more like a decision map and less like a workflow engine card grid.
- Tests run:
  - `pnpm --filter desktop typecheck`
  - `pnpm --filter desktop build`
- Known gaps:
  - The imported desktop app is now a real RAIL baseline and the workflow tab is back on the original RAIL canvas runtime, but Pathway still uses a compatibility adapter rather than the full native RAIL graph data model.
  - Runtime behavior may still call native commands that belong to upstream RAIL until those bridges are adapted or stubbed for Pathway.
  - The new Pathway layout is more organic than the earlier lane stack, but it is still deterministic and should eventually evolve toward stronger semantic clustering, route grouping, and revision-aware reflow.
  - Production packaging of the Python backend remains unresolved.
