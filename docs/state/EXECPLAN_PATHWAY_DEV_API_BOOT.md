# ExecPlan: Desktop Dev API Boot Reliability

## Objective

Make the primary `pnpm dev` desktop workflow start Pathway's local API automatically and prevent the Tasks intake from waiting through graph generation before reporting that the API is unavailable.

## Scope

- Keep the change bounded to dev service startup, API readiness checks, and intake generation handoff.
- Do not change graph generation semantics, research prompts, or persistence behavior.

## Steps

1. Update the desktop dev service group so the API starts alongside the desktop UI before Tauri opens.
2. Add a fast local API readiness probe that does not use the long retry loop.
3. Run the readiness probe before the Tasks intake switches into graph generation.
4. Verify with focused frontend tests and typecheck.

## Success Criteria

- `pnpm dev` no longer depends on the user separately running `pnpm dev:api`.
- The intake shows the generation-start message only after API readiness passes.
- A missing API fails quickly and leaves the intake in the ready phase so the user can retry after restart.
