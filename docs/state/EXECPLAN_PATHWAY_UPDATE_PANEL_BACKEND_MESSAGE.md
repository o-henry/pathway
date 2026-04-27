# ExecPlan: Pathway Update Panel and Backend Message Cleanup

## Goal

Let the user see the full graph by keeping the reality-update input hidden until the left sparkle/magic control is clicked, and remove misleading transient backend messages after a graph has already been generated.

## Context

- The graph workspace is rendered in `apps/desktop/src/app/MainAppImpl.tsx`.
- The update input currently floats over the graph and uses a button labeled `미리보기`.
- The Pathway intake chat mirrors `pathwayGoalAnalysisError` unless it is identified as transient.
- A generated graph can coexist with a stale/transient goal-analysis error, which makes the chat show a backend-not-ready sentence after success.

## Non-goals

- No backend schema changes.
- No rewrite of graph layout, revision generation, or source collection.
- No deletion of existing graph or update history.

## Files to read

- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/phases/phase-07-checkins-revisions.md`
- `apps/desktop/src/app/MainAppImpl.tsx`
- `apps/desktop/src/pages/tasks/TasksPage.tsx`
- `apps/desktop/src/pathway.css`

## Planned changes

1. Replace the standalone input-analysis canvas button with an update-panel toggle using the existing magic/sparkle icon.
2. Hide the update floater by default, and submit the update directly from the textarea flow instead of showing a separate `미리보기` button as the primary action.
3. Suppress transient backend analysis errors from chat/status when an active graph already exists or the error is only local API readiness.
4. Add focused typecheck validation and update state notes.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
git diff --check
```

Expected results:

- Desktop TypeScript compiles.
- Diff has no whitespace errors.

## Risks

- Hiding the update panel could make the action less discoverable, so the toggle button keeps an explicit accessible label/title.
- Submitting on Enter can conflict with multiline notes, so Shift+Enter remains multiline and Cmd/Ctrl+Enter also submits.

## Rollback

- Revert this plan and the related edits in `MainAppImpl.tsx`, `TasksPage.tsx`, `pathway.css`, and `CURRENT_STATE.md`.

## Completion notes

- Completed:
  - Converted the left magic-stick canvas control from manual goal-analysis into an update-panel toggle.
  - Hid the update floater by default so the generated graph remains visible.
  - Changed the update flow from a confusing `미리보기` primary button to `전송`, with Enter submission and Shift+Enter preserved for multiline notes.
  - Made update submission refresh goal analysis automatically when collector jobs are missing or stale.
  - Suppressed transient local-backend analysis failures from Pathway chat once an active graph exists.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - `git diff --check`
- Known gaps:
  - No live Tauri/browser screenshot was captured in this pass.
