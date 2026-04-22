# ExecPlan: Collector Status Live Wiring

## Goal

Make Settings > Collector Doctor use the real live collector state in the desktop app instead of getting stuck in the inert initial `checking` cards.

## Context

- The user reports that pressing `새로고침` does nothing.
- The current screenshot still shows every collector card in the blank `checking` state.
- `MainAppImpl` owns real collector state and refresh/install handlers.
- `MainAppWorkspaceContent` still contains a stale SettingsPage mount path with empty collector props.
- `MainAppImpl` runtime detection currently only checks `window.__TAURI_INTERNALS__`, which appears too narrow for the current desktop runtime.

## Non-goals

- Changing collector provider semantics.
- Implementing Steel or Lightpanda auto-install.
- Redesigning the Settings layout.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PLANS.md
- docs/state/CURRENT_STATE.md
- apps/desktop/src/app/MainAppImpl.tsx
- apps/desktop/src/app/main/presentation/MainAppWorkspaceContent.tsx
- apps/desktop/src/app/main/presentation/MainAppShell.tsx

## Planned changes

1. Broaden desktop runtime detection so Settings refresh does not false-negative inside the real app.
2. Remove stale empty collector props in the alternate SettingsPage path and pass through live props.
3. Re-run desktop verification commands and update state notes.

## Validation

Commands to run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
pnpm dev
curl -sS http://127.0.0.1:1420/
```

Expected results:

- Desktop app boots.
- Collector refresh no longer stays permanently in the inert default state because of missing runtime detection or empty props.

## Risks

- Runtime detection may still vary across environments if future Tauri shells expose different globals.

## Rollback

- Restore previous runtime detection expression.
- Restore previous Settings prop wiring.

## Completion notes

- Completed:
  - Broadened Tauri runtime detection in `MainAppImpl` to also accept `window.__TAURI__` and `navigator.userAgent` matches for `Tauri`.
  - Fixed the stale Settings mount path in `MainAppWorkspaceContent` that was hardcoding `collectorDoctorStatuses={[]}` and `onRefreshCollectorDoctor={() => {}}`.
  - Threaded live collector props and handlers through `MainAppShell` so the alternate shell path uses the same real refresh/install state.
- Tests run:
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `pnpm dev`
  - `curl -sS http://127.0.0.1:1420/`
- Known gaps:
  - macOS UI capture remained unreliable in this session because the desktop window stayed on another visible Space, so direct visual confirmation still depends on the newly restarted live app on the user's side.
  - `pnpm typecheck` was re-run but did not complete within this shell window before handoff.
