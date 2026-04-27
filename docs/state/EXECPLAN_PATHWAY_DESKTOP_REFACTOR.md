# ExecPlan: Pathway Desktop Refactor

## Goal

Reduce `MainAppImpl.tsx` responsibility by extracting Pathway-specific pure helpers, workflow presentation, and collector contracts into focused modules while preserving the current UI behavior.

## Context

`MainAppImpl.tsx` had grown into a mixed container containing workspace state, graph helper logic, workflow JSX, collector provider contracts, settings actions, and task-page wiring. The next safe refactor is to remove self-contained chunks without changing Pathway generation, revision, or rendering behavior.

## Non-goals

- Do not redesign the Pathway UI.
- Do not change graph generation, revision, source collection, or API behavior.
- Do not introduce new state-management libraries.
- Do not split every remaining handler in one pass.

## Files to read

- AGENTS.md
- docs/PLANS.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/app/researchPlanCollectorJobs.ts

## Planned changes

1. Extract pure Pathway workspace helpers from `MainAppImpl.tsx`.
2. Extract workflow tab JSX into a dedicated `PathwayWorkflowPanel` component.
3. Extract collector doctor/result contracts and provider metadata.
4. Extract graph/workspace derived state into a hook.
5. Extract collector doctor status/install state into a hook.
6. Extract research-plan collection execution into a hook.
7. Extract goal workspace refresh/select/delete orchestration into a controller hook.
8. Extract intake/generation/revision/route-selection mutations into a controller hook.
9. Extract engine/auth/cwd lifecycle into an engine auth hook.
10. Run desktop typecheck and diff checks after each bounded change.
11. Update state documentation with commits and known gaps.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
git diff --check
pnpm secret-scan
```

Expected results:

- TypeScript passes.
- No whitespace diff errors.
- Secret scan passes.
- `MainAppImpl.tsx` is smaller and focused more on state orchestration.

## Risks

- Moving large JSX can accidentally change handler binding or prop nullability.
- Extracted utility contracts can drift if later state logic mutates shapes locally instead of updating the shared module.

## Rollback

- Revert the specific atomic commit for the failed extraction.

## Completion notes

- Completed:
  - Extracted pure Pathway helper functions into `pathwayWorkspaceUtils.ts`.
  - Extracted the workflow tab into `PathwayWorkflowPanel.tsx`.
  - Extracted collector doctor/result contracts into `pathwayCollectorContracts.ts`.
  - Extracted selected graph, evidence, assumptions, and progress marker derived state into `usePathwayWorkspaceDerivedState.ts`.
  - Extracted collector doctor status/install flow into `usePathwayCollectorDoctor.ts`.
  - Extracted research-plan collection provider fallback and status flow into `usePathwayResearchCollector.ts`.
  - Extracted goal workspace refresh/select/delete orchestration into `usePathwayGoalWorkspaceController.ts`.
  - Extracted intake, graph generation, state update preview, revision accept/reject, and route selection into `usePathwayMutationController.ts`.
  - Extracted engine start/stop, local API token, Codex auth, cwd, and settings persistence into `usePathwayEngineAuth.ts`.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - `git diff --check`
  - `pnpm secret-scan`
- Known gaps:
  - `MainAppImpl.tsx` is now mostly shell wiring, page composition, and lifecycle effects.
  - Future cleanup should focus on tests for the extracted hooks and optional smaller presentation prop builders.
