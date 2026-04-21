# ExecPlan: Desktop Dev Service Stability

## Goal

Make `pnpm dev` more stable by reducing nested process wrappers in the desktop dev service chain so the renderer does not get torn down unexpectedly during Tauri startup.

## Context

- `tauri dev` runs `pnpm dev:desktop:services` as `beforeDevCommand`.
- That script currently launches the desktop renderer through `pnpm dev:desktop-ui`, which itself wraps `pnpm --filter desktop dev`, which then wraps `vite dev`.
- The user observed cases where the renderer printed `VITE ready` and then `pnpm dev:desktop-ui exited with code SIGTERM`, leaving the PATHWAY window white.

## Non-goals

- Reworking the desktop UI layout
- Changing API behavior
- Solving all possible Tauri/macOS renderer issues

## Files to read

- AGENTS.md
- docs/state/CURRENT_STATE.md
- package.json
- scripts/dev-reset.mjs
- apps/desktop/vite.config.ts

## Planned changes

1. Replace the nested `pnpm --filter desktop dev` launcher with a direct `vite dev --host 127.0.0.1 --port 1420` invocation.
2. Update cleanup patterns so the reset script targets the direct renderer command correctly.
3. Re-run desktop typecheck and document the stabilization pass.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
pnpm dev:desktop:services
```

Expected results:

- The renderer stays alive after printing the Vite ready banner.
- The API remains up at port `8000`.

## Risks

- Directly pinning the host/port in the service launcher duplicates Vite config intent.

## Rollback

- Restore the previous `dev:desktop-ui` script and cleanup patterns.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
