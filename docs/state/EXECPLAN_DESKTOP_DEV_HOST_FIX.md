# ExecPlan: Desktop Dev Host Fix

## Goal

Make the Tauri desktop dev loop reliably detect the desktop Vite server by aligning the renderer host binding with the `devUrl` Tauri waits on.

## Context

- `src-tauri/tauri.conf.json` uses `http://127.0.0.1:1420` as `build.devUrl`.
- `scripts/dev-reset.mjs` also treats `127.0.0.1:1420` as the expected desktop UI endpoint.
- `apps/desktop/vite.config.ts` fell back to Vite's default host behavior when `TAURI_DEV_HOST` was unset, which can expose only `localhost` and leave Tauri waiting on `127.0.0.1`.

## Non-goals

- Changing API startup behavior.
- Reworking dynamic port discovery.
- Solving broader Node/toolchain version issues.

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
- apps/desktop/vite.config.ts
- src-tauri/tauri.conf.json
- scripts/dev-reset.mjs

## Planned changes

1. Bind the desktop Vite dev server to `127.0.0.1` by default when `TAURI_DEV_HOST` is unset.
2. Keep HMR aligned with the same host so the desktop dev loop uses one consistent loopback address.
3. Record the fix and validation notes in `docs/state/CURRENT_STATE.md`.

## Validation

Commands to run:

```bash
pnpm --filter desktop dev
```

Expected results:

- Desktop Vite announces `127.0.0.1:1420` availability or otherwise becomes reachable from that URL.

## Risks

- Some environments may still fail before binding if their local Node runtime is older than the Vite requirement.

## Rollback

- Revert `apps/desktop/vite.config.ts` to the previous host fallback behavior.

## Completion notes

- Completed:
  - `apps/desktop/vite.config.ts` now defaults the dev server and HMR host to `127.0.0.1` when `TAURI_DEV_HOST` is unset.
  - `docs/state/CURRENT_STATE.md` records the change, commands run, and the sandbox verification limitation.
- Tests run:
  - `pnpm --filter desktop dev` attempted in this sandbox.
- Known gaps:
  - Full runtime verification is blocked here because the available Node runtime is `18.16.1`, below Vite 7's minimum supported version.
