# ExecPlan: Pathway Merge Alignment Pass

## Goal

Make Pathway graph columns read more naturally when multiple parent nodes converge into a shared downstream node.

## Context

Relevant file:
- `apps/desktop/src/app/PathwayRailCanvas.tsx`

Current pain point:
- Nodes are technically connected, but same-column placement still feels visually unstable.
- Multi-parent nodes should sit near the vertical center of their parent set.
- Same-depth sibling nodes should preserve readable lane spacing without forcing awkward drift.

## Non-goals

- Replacing the whole layout engine with ELK.
- Reworking graph semantics or node styling.
- Solving every dense-graph crossing case.

## Files to read

- `AGENTS.md`
- `docs/state/CURRENT_STATE.md`
- `apps/desktop/src/app/PathwayRailCanvas.tsx`

## Planned changes

1. Replace the tree-first relaxation stack with a top-down column layout driven by incoming parent rows.
2. Keep single-parent chains on the same row while centering only true merge nodes between multiple parents.
3. Place the terminal GOAL node at the average center of its incoming parents so the final bundle reads like one shared trunk.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Desktop TypeScript check passes.
- Multi-parent columns read closer to a centered merge structure.

## Risks

- Some graphs may still need a stronger global crossing minimizer.
- Over-correcting one lane could make other lanes feel too compressed.

## Rollback

- Revert the `buildLayout` relaxation block in `PathwayRailCanvas.tsx`.

## Completion notes

- Completed:
  - Replaced the previous tree/relaxation hybrid with a direct lane-by-lane placement pass.
  - Single-parent nodes now inherit their parent row; multi-parent nodes center between parents.
  - GOAL now centers on the average of incoming parent rows instead of drifting above the final shared bundle.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
- Known gaps:
  - Local Playwright CLI runtime verification failed in this environment because the bundled browser helper hit `URL.canParse is not a function`.
