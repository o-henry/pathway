# ExecPlan: Workspace Top Gap Fix

## Goal

Remove the meaningless top dead space above the Pathway workflow canvas by fixing the workspace shell layout, not just the canvas internals.

## Context

- The user-facing regression is a large blank area above the workflow canvas.
- The immediate cause is the `MainAppImpl` workspace shell still behaving like a multi-row shell while this screen has no real header row to occupy that space.
- Relevant files are `apps/desktop/src/app/MainAppImpl.tsx`, `apps/desktop/src/pathway.css`, and `docs/state/CURRENT_STATE.md`.

## Non-goals

- Redesigning the workflow sidebar cards.
- Reworking graph generation or data loading.
- Changing inspector behavior.

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
- docs/phases/phase-08-quality-export-packaging.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/pathway.css

## Planned changes

1. Give the `MainAppImpl` workspace a single-row shell mode instead of inheriting empty header/warning rows.
2. Force the workflow frame/body/main/canvas panel stack to stretch to the available height.
3. Keep errors and warnings as overlays so the screen can stay top-aligned.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript checks pass.
- The workflow canvas begins near the top of the available workspace instead of below a dead spacer band.

## Risks

- Overlay styling for error/warning bars may want a later polish pass.

## Rollback

- Revert `apps/desktop/src/app/MainAppImpl.tsx` and `apps/desktop/src/pathway.css`.

## Completion notes

- Completed:
  - Added a dedicated `workspace-simple-shell` mode for `MainAppImpl`.
  - Forced the workflow frame/body/canvas stack to fill available height.
  - Recorded the fix in `docs/state/CURRENT_STATE.md`.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
- Known gaps:
  - No fresh live screenshot verification was run in this sandboxed turn.
