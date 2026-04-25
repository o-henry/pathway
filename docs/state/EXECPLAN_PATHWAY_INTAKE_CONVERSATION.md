# ExecPlan: Pathway Intake Conversation

## Goal

Make the first Pathway tab behave like an agent-led intake conversation: the user states a goal, the agent asks only necessary checklist-style follow-up questions, and graph generation starts only after the user approves.

## Context

The desktop first tab already uses the upstream o-rail `TasksPage` shell, conversation surface, and composer. Backend goal analysis already returns `followup_questions`, but they currently appear only in the workflow sidebar after manual analysis.

## Non-goals

- Do not replace the graph workflow.
- Do not implement broad autonomous source discovery in this pass.
- Do not remove the existing task-thread experience outside Pathway mode.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/phases/phase-02-agent-led-research-loop.md`
- `docs/state/CURRENT_STATE.md`
- `apps/desktop/src/pages/tasks/TasksPage.tsx`
- `apps/desktop/src/app/MainAppImpl.tsx`

## Planned changes

1. Add Pathway-mode intake state and messages to `TasksPage`.
2. Wire first user message to create/analyze a goal, then render analysis follow-ups as a checklist in the o-rail conversation surface.
3. Wire approval words to graph generation and navigate to the workflow tab only after approval.
4. Add a small goal update API helper so clarified answers are preserved before graph generation.
5. Update current state documentation.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- TypeScript passes.
- The first tab can render the Pathway intake conversation without depending on a task thread.

## Risks

- The first pass uses the existing analysis/generation endpoints; broader collector execution remains separate.
- Existing saved goals do not load historical intake chat transcripts because no chat persistence exists yet.

## Rollback

- Revert the desktop changes in `TasksPage`, `MainAppImpl`, and `api.ts`.

## Completion notes

- Completed:
  - Added a Pathway-specific intake conversation state to the upstream o-rail `TasksPage` shell.
  - Wired first goal messages to create/analyze a goal and render backend follow-up questions as a checklist.
  - Wired user approval to preserve clarified answers, generate a graph, and move to the workflow tab.
  - Added a desktop API helper for goal patch updates.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - Browser smoke test against `http://127.0.0.1:1420/` using local Google Chrome through Playwright.
- Known gaps:
  - Intake chat transcript is client-local only; only the goal text and clarification answers are persisted to the goal record.
  - The approval flow uses existing analysis/generation endpoints; broader collector execution remains a separate workflow.
