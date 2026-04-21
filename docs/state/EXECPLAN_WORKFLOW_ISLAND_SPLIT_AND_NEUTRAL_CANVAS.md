# ExecPlan: Workflow Island Split And Neutral Canvas

## Goal

Make the workflow screen read as two separate working islands instead of one nested white slab, and remove the remaining lavender gradient wash from the canvas.

## Context

- `apps/desktop/src/app/MainAppImpl.tsx` already separates the workflow canvas panel and the right detail sidebar into sibling regions.
- `apps/desktop/src/pathway.css` still gives the canvas a tinted plotting surface, which makes the whole area feel visually fused even after the shell split.
- The user explicitly wants:
  - no gradient-like wash on the canvas
  - a canvas island separate from the detail island
  - no nested giant white parent card look

## Non-goals

- Reworking graph layout or edge routing
- Changing workflow content or sidebar information architecture
- Adding new controls or interaction modes

## Files to read

- AGENTS.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/pathway.css

## Planned changes

1. Neutralize the canvas plotting surface so it reads as a flat technical work area instead of a lavender gradient field.
2. Strengthen the visual separation between canvas and sidebar islands with explicit border/background treatment on each sibling panel.
3. Validate in runtime with Playwright and record the bounded pass in `CURRENT_STATE.md`.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
zsh -lc 'PATH=/Users/henry/.nvm/versions/node/v24.13.1/bin:$PATH pnpm --filter desktop dev -- --host 127.0.0.1 --port 1420'
zsh -lc 'export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"; export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"; "$PWCLI" open http://127.0.0.1:1420 --headed'
zsh -lc 'export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"; export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"; "$PWCLI" screenshot'
```

Expected results:

- The workflow canvas has no lavender/gradient wash.
- Canvas and detail sidebar read as separate bordered islands.
- Desktop TypeScript check passes.

## Risks

- Making the grid too neutral could weaken graph-paper readability.
- Strengthening island boundaries too much could make the workflow surface feel overly boxed in.

## Rollback

- Revert the latest `MainAppImpl.tsx` / `pathway.css` edits for the workflow shell and canvas surface.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
