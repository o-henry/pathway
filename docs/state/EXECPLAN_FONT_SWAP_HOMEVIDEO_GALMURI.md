# ExecPlan: Font Swap To HomeVideo And Galmuri

## Goal

Apply the user-provided English and Korean fonts across the desktop app without hand-editing every individual component font declaration.

## Context

- The desktop app already loads many font families from `apps/desktop/src/styles/base/fonts.css`.
- A large portion of the UI still references older family names directly, so changing only root tokens would leave the app visually inconsistent.
- The user supplied these local font files:
  - English: `HomeVideo-BLG6G.ttf`
  - Korean: `galmuri14.ttf`

## Non-goals

- Redesigning typography scale or spacing
- Cleaning every legacy font-family declaration in the repo
- Reworking Japanese-specific font handling

## Files to read

- AGENTS.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/styles/base/fonts.css
- apps/desktop/src/styles/tokens/theme.css
- apps/desktop/public/FONT_LICENSES.txt

## Planned changes

1. Copy the user-provided font files into `apps/desktop/public/fonts`.
2. Repoint the app's existing primary font family aliases to the new English/Korean font files.
3. Update root font tokens so the default stack also resolves to the new fonts.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
```

Expected results:

- Existing UI surfaces render with HomeVideo for Latin text and Galmuri for Hangul.
- Existing hardcoded family names still resolve because aliases remain intact.
- Desktop TypeScript check passes.

## Risks

- A single-weight display font may look too heavy in dense UI areas.
- Replacing mono/display aliases with one font could reduce contrast in code-like surfaces.

## Rollback

- Revert the copied font asset and the latest edits in `fonts.css`, `theme.css`, and the state note.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
