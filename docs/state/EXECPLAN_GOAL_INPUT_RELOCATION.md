# ExecPlan: Goal Input Relocation

## Goal

Move the goal input surface into the workflow workspace so the graph and its primary authoring input live together, while leaving the goal tab focused on browsing/selecting saved goals.

## Context

- `apps/desktop/src/app/MainAppImpl.tsx` currently renders both goal input and goal list inside `renderTasksTab()`.
- The workflow screen already has a main canvas column that can host a bottom composer-style panel.
- The left nav already exposes `목표 / 워크플로우 / 설정`; only the content split needs to change.

## Non-goals

- Reworking backend goal creation APIs.
- Changing graph generation semantics.
- Redesigning the entire goal list visual treatment.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/state/CURRENT_STATE.md
- `apps/desktop/src/app/MainAppImpl.tsx`
- `apps/desktop/src/pathway.css`

## Planned changes

1. Extract the goal input form into a reusable workflow-bottom composer panel.
2. Reduce the goal tab so it centers on the saved goal list and selection.
3. Make the initial desktop view land on the goal tab, since that is now the browsing/entry surface.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript passes.
- Goal list remains accessible from the goal tab.
- Workflow tab renders the goal input panel under the canvas without breaking inspector/sidebar layout.

## Risks

- The workflow main column may feel crowded if the bottom composer is too tall.
- Fullscreen canvas mode should not be forced to show the input panel.

## Rollback

- Restore the old `renderTasksTab()` structure and the previous workflow main-column grid rows.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
