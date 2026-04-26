# ExecPlan: Security and Intake UI Hardening

## Goal

Close the concrete security gaps from the local audit and fix the Pathway intake conversation UI issues seen in the user's screenshots.

## Context

- Pathway intentionally uses the logged-in Codex CLI session for structured generation.
- The app must not expose Codex raw login/status output to the UI.
- Local API endpoints currently run on loopback without authentication.
- Codex strict structured output rejects object schemas unless every object has `additionalProperties: false`.
- The Pathway intake conversation lives in `apps/desktop/src/pages/tasks/TasksPage.tsx` and `apps/desktop/src/pathway.css`.

## Non-goals

- Do not remove Codex CLI usage.
- Do not add API-key-backed OpenAI providers.
- Do not redesign the whole task/workflow shell.
- Do not implement broad crawling.

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
- docs/phases/phase-08-quality-export-packaging.md
- docs/state/CURRENT_STATE.md

## Planned Changes

1. Redact/remove raw Codex login/status output from Tauri command responses.
2. Add a local API bearer-token guard and wire the desktop/web clients to send it when configured.
3. Revalidate URL fetches after redirects and block private/loopback destinations.
4. Make Codex GraphBundle output schemas strict-schema compatible.
5. Fix Pathway intake message rendering, pending animation/timer, assistant bubble color, and user bubble width.

## Validation

Commands to run:

```bash
pnpm --filter desktop exec tsc --noEmit
cargo check --manifest-path src-tauri/Cargo.toml
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_goal_analysis.py apps/api/tests/test_map_generation.py apps/api/tests/test_source_library.py apps/api/tests/test_health.py
pnpm secret-scan
```

Expected results:

- Typecheck and Rust check pass.
- Backend tests pass.
- Secret scan passes.

## Risks

- Local API token wiring must not break existing dev mode.
- Strict GraphBundle schema may constrain generated node dynamic data; preserve validation while allowing useful compact fields.

## Rollback

- Revert the files listed in completion notes for this ExecPlan.

## Completion Notes

- Completed:
  - Removed raw Codex CLI status/login output from desktop command responses and return only sanitized auth states.
  - Added optional local API bearer-token protection and wired desktop dev/Tauri API calls to send the generated token.
  - Blocked private, loopback, link-local, multicast, and unspecified URL fetch targets before and after redirects.
  - Tightened Tauri CSP script policy by removing inline/eval script allowances.
  - Rebuilt the Codex GraphBundle structured-output schema so all object schemas are strict and `style_overrides` includes `additionalProperties: false`.
  - Fixed intake UI formatting, animated pending dots, elapsed timer, assistant bubble color, and compact user bubble width.
- Tests run:
  - `pnpm --filter desktop exec tsc --noEmit`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_goal_analysis.py apps/api/tests/test_map_generation.py apps/api/tests/test_source_library.py apps/api/tests/test_health.py`
  - `pnpm secret-scan`
  - `git diff --check`
- Known gaps:
  - Standalone non-desktop web clients only send the bearer token when `VITE_PATHWAY_LOCAL_API_TOKEN` is configured for that frontend runtime.
  - `style-src 'unsafe-inline'` remains in the Tauri CSP for current React/Tauri inline-style compatibility; script execution is locked to `script-src 'self'`.
