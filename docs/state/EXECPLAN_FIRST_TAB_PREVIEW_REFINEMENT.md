# ExecPlan: First Tab Preview Refinement

## Goal

Refine the hardcoded Pathway first-tab preview so it reads like a restrained conversation UI instead of a nested colored demo card.

## Context

- The current empty-state preview uses too many surface colors and reads as a card inside another card.
- Message spacing is too tight for a conversation.
- The empty-state headline still says to state a goal even when an active goal already exists.

## Non-goals

- Persisting the intake transcript.
- Replacing the real intake flow.
- Changing graph generation or collector runtime behavior.

## Planned Changes

1. Hide the "목표를 먼저 말해 주세요" copy once an active goal exists.
2. Flatten the first-tab preview surface so it is not a colored panel inside a gray panel.
3. Increase message spacing and reduce the preview palette to neutral surfaces plus a single dark action.
4. Validate with TypeScript and a browser style check.

## Validation

```bash
pnpm --filter desktop exec tsc --noEmit
git diff --check
```

## Completion Notes

- Completed:
  - Replaced the stale empty-state headline with a current-goal summary when an active goal already exists.
  - Flattened the Pathway preview container by removing the gray empty-state surface and making the preview grid surface white.
  - Increased conversation spacing and reduced preview colors to neutral white/gray surfaces plus one dark workflow action.
  - Verified in local Chrome that the old headline is absent, the empty state is transparent, the preview background is white, and the thread gap is `22px`.
  - Retuned the grid work surface to a barely tinted paper color and removed box shadows from preview messages and the handoff row.
  - Added low-saturation role backgrounds for USER, PATHWAY, and READY states so the log roles are easier to scan without using bright colors.
  - Set USER log backgrounds back to pure white and neutralized the preview grid background to off-white gray.
  - Added subtle 1px borders to USER, PATHWAY, and READY log blocks while keeping shadows removed.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - `git diff --check`
  - `pnpm --filter desktop exec node --input-type=module -e "...local Chrome first-tab style verification..."`
  - `pnpm --filter desktop exec node --input-type=module -e "...local Chrome beige/flat preview verification..."`
  - `pnpm --filter desktop exec node --input-type=module -e "...local Chrome subtle paper preview verification..."`
  - `pnpm --filter desktop exec node --input-type=module -e "...local Chrome role background verification..."`
  - `pnpm --filter desktop exec node --input-type=module -e "...local Chrome neutral user-white verification..."`
  - `pnpm --filter desktop exec node --input-type=module -e "...local Chrome message border verification..."`
