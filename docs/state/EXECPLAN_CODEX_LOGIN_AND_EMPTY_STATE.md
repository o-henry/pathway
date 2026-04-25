# ExecPlan: Codex Login And Workflow Empty State

## Goal

Make the Pathway settings CODEX login button invoke real desktop commands again, and center the workflow placeholder copy shown when no goal is selected.

## Context

- `apps/desktop/src/app/MainAppImpl.tsx` calls Tauri commands such as `engine_start`, `auth_probe`, `login_chatgpt`, and `logout_codex`.
- `src-tauri/src/main.rs` currently registers only collector commands, so the login UI cannot complete its command path.
- The workflow empty state uses the shared `.pathway-empty-state` style, which left-aligns text inside the canvas.

## Planned Changes

1. Add minimal Tauri commands for Codex auth lifecycle:
   - no-op engine start/stop for the current Pathway shell
   - login status probing via `codex login status`
   - ChatGPT device-login startup via `codex login --device-auth`
   - logout via `codex logout`
2. Register the Tauri opener plugin so the browser login URL can open from the desktop app.
3. Surface the device code in the status message when available.
4. Center only the workflow placeholder text/copy while preserving other empty states.

## Validation

- `cargo check --manifest-path src-tauri/Cargo.toml`
- `pnpm --filter desktop exec tsc --noEmit`
- `git diff --check`

## Risks

- The login command depends on the local `codex` CLI being installed and available in common shell paths.
- Device-code login still requires the user to complete the browser step manually.

