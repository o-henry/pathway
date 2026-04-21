# ExecPlan: Settings Restore And Nav Consolidation

## Goal

Restore a visible settings entry for CODEX authentication and reduce the top-level Pathway navigation so the main workflow is not split across too many sibling tabs.

## Context

- `apps/desktop/src/app/MainAppImpl.tsx` currently defines only `tasks`, `workflow`, `knowledge`, and `adaptation` as custom top-level tabs.
- The original desktop app still contains a functioning settings surface and login-related runtime contracts, but the Pathway-specific shell no longer exposes that entry point.
- The user confirmed two UX problems:
  - workflow input/view surfaces feel too spread out
  - removing settings makes CODEX login unreachable

## Non-goals

- Re-implementing the entire legacy RAIL settings/runtime shell
- Reworking graph canvas layout in this pass
- Deleting the knowledge/adaptation code paths entirely

## Files to read

- AGENTS.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/components/AppNav.tsx
- apps/desktop/src/pages/settings/SettingsPage.tsx
- apps/desktop/src/app/mainAppUtils.ts

## Planned changes

1. Reintroduce a top-level `settings` tab in the Pathway shell navigation.
2. Narrow the primary navigation to `tasks`, `workflow`, and `settings` so graph work is less fragmented.
3. Wire a minimal but working settings surface for CODEX login/logout, auth status, cwd selection, and related preferences.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Settings is visible in the left nav again.
- CODEX login controls are reachable from the Pathway shell.
- Desktop TypeScript check passes.

## Risks

- The simplified settings bridge may not expose every legacy setting from the full RAIL shell.
- Users accustomed to direct `knowledge` / `adaptation` tabs may need a follow-up pass if additional shortcuts are desired.

## Rollback

- Revert `MainAppImpl.tsx`, `AppNav.tsx`, and the state note for this pass.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
