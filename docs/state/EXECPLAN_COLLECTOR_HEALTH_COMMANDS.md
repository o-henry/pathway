# ExecPlan: Collector Health Commands

## Goal

Make the desktop Settings "수집기 상태" section report real provider readiness from the Tauri backend instead of relying on missing invoke commands.

## Context

- `apps/desktop/src/app/MainAppImpl.tsx` calls `dashboard_crawl_provider_health`.
- The current `src-tauri/src/main.rs` launches the local API but does not register any crawl-provider invoke commands.
- The UI expects `ready`, `configured`, `installed`, `installable`, and `message` fields.

## Non-goals

- Implementing full collector fetch pipelines for every provider.
- Building a new settings UI.
- Replacing the collector doctor with a different architecture.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/ARCHITECTURE.md`
- `docs/state/CURRENT_STATE.md`
- `apps/desktop/src/app/MainAppImpl.tsx`
- `apps/desktop/src/app/main/runtime/roleKnowledgeProviders.ts`
- `src-tauri/src/main.rs`

## Planned changes

1. Add Tauri commands for `dashboard_crawl_provider_health` and `dashboard_crawl_provider_install`.
2. Implement real environment checks for local providers and configuration checks for remote providers.
3. Register the commands in the Tauri invoke handler and verify with `cargo check`.

## Validation

Commands to run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected results:

- Rust builds cleanly.
- Desktop Settings can invoke collector health without missing-command errors.
- Providers report green only when actually ready.

## Risks

- Provider availability checks are heuristic and may need tuning as the runtime evolves.
- Install commands may still fail if the local machine blocks network/package installs.

## Rollback

- Revert `src-tauri/src/main.rs` and this ExecPlan file.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
