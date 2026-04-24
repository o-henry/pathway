# ExecPlan — Pathway GOAL Edge Routing Repair

## Objective

Restore orthogonal Pathway graph edges while preventing GOAL-targeted edges from being bundled into a confusing shared trunk.

## Success criteria

- Pathway graph edges do not render as diagonal straight lines.
- GOAL incoming edges keep right-angle routing.
- GOAL incoming edges enter separate anchor points instead of sharing one bundled target lane.
- Shared workflow graph rendering remains compatible with existing callers.

## Implementation

- Add optional target-anchor separation to the shared canvas edge renderer.
- Use that option only for Pathway GOAL-family nodes.
- Revert the Pathway canvas away from `routeStyle: "straight"`.

## Verification

- Run desktop TypeScript check.
- Verify the workflow canvas in a browser screenshot.
