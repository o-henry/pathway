# ExecPlan: Collector Doctor Runtime Fix

## Goal

Make the Settings Collector Doctor report real local collector readiness instead of marking installed collectors red because the Tauri process cannot find terminal-installed tools or cannot access the default `uv` cache.

## Context

- The current machine has several collector runtimes installed under the repo, but the UI can still show all-red status.
- Tauri health checks call `uv`, `pnpm`, and external binaries by bare command name, which is fragile when launched from macOS GUI contexts with a reduced `PATH`.
- `uv run` can fail when it tries to initialize `~/.cache/uv`; the app should use a repo-local cache for these checks.
- Settings intentionally uses only the status dot for at-a-glance readiness; detailed messages should not be rendered in the row.

## Non-goals

- Installing Lightpanda or configuring Steel.
- Implementing missing fetch bridges for every interactive collector.
- Changing the crawling safety policy.

## Files to read

- AGENTS.md
- docs/CODEX_START_HERE.md
- docs/PATHWAY_REFRAME.md
- docs/DESIGN_RESEARCH_PLAYBOOK.md
- docs/IMPLEMENTATION_PLAN.md
- docs/ARCHITECTURE.md
- docs/DYNAMIC_GRAPH_SPEC.md
- docs/RAG_AND_CRAWLING_SPEC.md
- docs/SECURITY_CHECKLIST.md
- docs/phases/phase-05-source-library-rag.md
- docs/state/CURRENT_STATE.md
- src-tauri/src/main.rs
- apps/desktop/src/pages/settings/SettingsPage.tsx
- apps/desktop/src/styles/layout/shell/settings-hub.css

## Planned Changes

1. Resolve `uv`, `pnpm`, and optional binaries through both `PATH` and common macOS install directories.
2. Run `uv` health/install/fetch/API commands with repo-local `UV_CACHE_DIR=.uv-cache`.
3. Preserve dot-only Collector Doctor rows while keeping diagnostic messages available internally.
4. Validate Rust, TypeScript, and the actual local runtime checks.

## Validation

```bash
cargo check --manifest-path src-tauri/Cargo.toml
pnpm --filter desktop exec tsc --noEmit
UV_CACHE_DIR=.uv-cache uv run python3 -c "..."
pnpm --filter desktop exec playwright --version
```

Expected results:

- Rust and TypeScript pass.
- Repo-local Python collector imports resolve without touching `~/.cache/uv`.
- Playwright CLI resolves through the desktop package.

## Risks

- Common-path lookup is macOS/dev-environment oriented; packaged production builds may still need bundled runtimes or explicit configuration.
- Dot-only status can still be ambiguous when a provider is red, but that is the preferred UI direction for this screen.

## Rollback

- Revert `src-tauri/src/main.rs`, `SettingsPage.tsx`, `settings-hub.css`, this plan, and the corresponding `CURRENT_STATE.md` entry.

## Completion Notes

- Completed:
  - Added robust Tauri command lookup for terminal-installed tools by checking both `PATH` and common macOS install directories.
  - Updated Tauri collector health/install/fetch/API launch paths to pass an augmented `PATH`.
  - Updated all Tauri `uv` runtime checks to use repo-local `.uv-cache`, avoiding the home-cache permission failure that made installed collectors look unavailable.
  - Kept Collector Doctor rows dot-only, with health messages retained only as row titles for hover/debug context.
  - Changed browser-preview fallback from red failure dots to neutral checking dots so unavailable Tauri health IPC is not presented as collector failure.
- Tests run:
  - `cargo fmt --manifest-path src-tauri/Cargo.toml`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `pnpm --filter desktop exec tsc --noEmit`
  - `UV_CACHE_DIR=.uv-cache uv run python3 -c "...collector import probe..."`
  - `pnpm --filter desktop exec playwright --version`
  - `pnpm --filter desktop exec node --input-type=module -e "...local Chrome settings verification..."`
  - `git diff --check`
- Known gaps:
  - `lightpanda_experimental` remains red unless the external `lightpanda` binary is installed.
  - `steel` remains red unless a Steel key or CDP endpoint is configured.
