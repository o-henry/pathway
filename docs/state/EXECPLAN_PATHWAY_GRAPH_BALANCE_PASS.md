# ExecPlan — Pathway Graph Balance Pass

## Objective

Reduce awkwardness in the Pathway graph by rebalancing merge-node vertical placement and widening GOAL entry spacing without reverting to diagonal routing.

## Success criteria

- Multi-parent nodes sit closer to the visual center of their parent set.
- GOAL incoming edges remain orthogonal and feel less cramped.
- Existing graph rendering and TypeScript checks remain valid.

## Implementation

- Add a lightweight lane relaxation pass for multi-parent nodes in `buildLayout`.
- Increase separated incoming anchor spread for GOAL-targeted edges.
- Verify the result in the browser with the user's active graph.

## Verification

- `pnpm --filter desktop exec tsc --noEmit`
- Playwright screenshot of the workflow canvas
