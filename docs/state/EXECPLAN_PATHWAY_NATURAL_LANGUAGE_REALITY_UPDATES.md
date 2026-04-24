# ExecPlan: Pathway Natural-Language Reality Updates

## Goal

Remove the separate learning tab and let the workflow reality-update surface accept freeform natural-language notes about what the user actually did toward the GOAL, then feed that text into graph revision generation.

## Context

- The desktop app currently has a temporary `learning` tab with local-only task storage and display-only graph augmentation.
- The workflow tab already creates append-only state updates and revision previews through the API.
- The user explicitly wants the natural-language update path analyzed by an agent/model, not by regex-heavy branching.

## Non-goals

- Building a brand-new task calendar or quiz surface elsewhere.
- Implementing destructive graph deletion.
- Replacing the whole revision system or introducing a new agent orchestration layer in this pass.

## Files To Read

- AGENTS.md
- docs/PATHWAY_REFRAME.md
- docs/DYNAMIC_GRAPH_SPEC.md
- docs/phases/phase-07-checkins-revisions.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/components/AppNav.tsx
- apps/api/lifemap_api/application/revisions.py

## Planned Changes

1. Remove the `learning` tab from the desktop shell and stop display-layer learning-route augmentation.
2. Reframe the workflow reality-update composer as the place where the user writes what they actually did, learned, or discovered for the GOAL.
3. Tighten the revision-generation prompt so the model treats the latest natural-language check-in as real progress evidence that can append or revise graph structure without deleting prior graph history.
4. Update state docs to record the pivot away from the separate learning tab.

## Validation

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript passes.
- The left nav only shows goals, workflow, and settings.
- Workflow reality updates are positioned as freeform natural-language input for graph revision previews.

## Risks

- The default local stub provider is still deterministic, so true agent-quality analysis depends on using a real configured provider.
- Removing the learning tab from navigation does not automatically delete old localStorage entries.

## Rollback

- Revert the navigation, workflow composer, and revision prompt changes, then restore the learning tab wiring if needed.

## Completion Notes

- Completed:
- Removed the separate desktop `learning` tab from the Pathway shell and deleted its local-only page/storage files.
- Reframed the workflow `현실 업데이트` composer as the natural-language place to record what the user actually did, learned, discovered, or got blocked by for the GOAL.
- Stopped display-layer learning-route augmentation so graph changes now flow through the existing append-only revision-preview path instead of a separate local tab.
- Strengthened the backend revision prompt so providers read the latest `progress_summary` as freeform reality input and infer graph changes from meaning rather than keyword branching.
- Tests run:
- `pnpm --filter desktop exec tsc --noEmit`
- Known gaps:
- The default stub LLM provider is still deterministic, so fully agentic revision quality depends on enabling a real provider such as Ollama or OpenAI.
- Old localStorage entries created by the removed learning tab are not migrated or deleted in this pass.
