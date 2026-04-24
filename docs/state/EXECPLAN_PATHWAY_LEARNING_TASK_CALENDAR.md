# ExecPlan: Pathway Learning Task Calendar

## Goal

Add a left-nav learning task calendar where the user records date-based tasks toward the active GOAL, completes them, receives quiz-style understanding checks, and sees completed work added to the graph as a personal learning route.

## Context

- The desktop app currently exposes `목표`, `워크플로우`, and `설정` tabs.
- The Pathway graph is graph-first and must continue evolving without deleting prior branches.
- Dribbble task-calendar references emphasize compact calendar grids, agenda/task cards, side panels, status chips, and completion rhythm.

## Non-goals

- Full backend persistence for learning tasks in this pass.
- A real LLM/agent quiz provider in this pass.
- Automatic deletion or replacement of existing graph nodes.

## Files To Read

- AGENTS.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/phases/phase-07-checkins-revisions.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/components/AppNav.tsx
- apps/desktop/src/app/PathwayRailCanvas.tsx
- apps/desktop/src/pathway.css

## Planned Changes

1. Add a `learning` workspace tab and nav icon.
2. Build a local-first task calendar UI with date selection, daily task entry, completion, quiz questions, answer review, and resource suggestions.
3. Persist learning tasks in localStorage per active goal.
4. Merge completed learning tasks into the displayed graph as a distinct personal learning route color without removing existing graph content.
5. Add an absolute graph preservation rule to the repo instructions.

## Validation

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript passes.
- Learning tab is reachable from the left nav.
- Completed tasks are available for display-bundle graph augmentation.

## Risks

- Quiz generation is deterministic/local in this pass, so real agent personalization remains a follow-up.
- Graph augmentation is display-layer only until backend revisions learn from task records.

## Rollback

- Revert the learning page, nav changes, graph display augmentation, icon asset, and documentation edits.

## Completion Notes

- Completed:
  - Added the `learning` left-nav tab using the provided stack icon.
  - Built a local-first task calendar with month grid, selected-date task entry, completion checks, quiz prompts, quiz grading feedback, and resource suggestions.
  - Persisted learning tasks per active goal in localStorage.
  - Added completed learning tasks to the displayed Pathway graph as a distinct personal learning route connected to GOAL.
  - Added graph preservation rules to `AGENTS.md` and `docs/DYNAMIC_GRAPH_SPEC.md`.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - Playwright CLI opened `http://127.0.0.1:1420/`, clicked the learning tab, registered a task, completed it, and verified the learning node appears in the workflow graph.
- Known gaps:
  - Quiz generation and grading are deterministic/local in this pass, not yet powered by a real LLM agent.
  - Learning tasks are stored in localStorage rather than the FastAPI/SQLite backend.
  - The graph augmentation is display-layer only; backend revision generation should later ingest learning task records as first-class current-state evidence.
