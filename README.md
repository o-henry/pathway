<div align="center">

<pre>
░▒▓███████▓▒░ ░▒▓██████▓▒░▒▓████████▓▒░▒▓█▓▒░░▒▓█▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░
░▒▓███████▓▒░░▒▓████████▓▒░ ░▒▓█▓▒░   ░▒▓████████▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░   ░▒▓█▓▒░░▒▓█▓▒░
</pre>

Local-first decision graph workspace for long-term goals.

</div>

Pathway is a local-first decision graph workspace for long-term goals.
It helps a user describe a goal, inspect real constraints, collect evidence,
generate branching routes, lock an active route, and keep the graph aligned with reality as conditions change.

The current primary product surface is the desktop workspace built with `apps/desktop` and `src-tauri`.
The older web route under `apps/web` is still present for secondary validation and legacy experiments, but desktop is the main runtime target.

## Current focus

- Goal-first planning instead of static task lists
- Graph-first workspace where the route map is the main surface
- Local API + local storage for iterative route building
- Route revision without replacing the entire graph
- Evidence, assumptions, and route viability shown as separate product concepts

## Repository layout

- `apps/desktop` — React + Vite desktop UI
- `apps/web` — older SvelteKit pathway surface, now secondary
- `apps/api` — FastAPI local API
- `src-tauri` — Tauri shell for the desktop app
- `docs` — architecture, phase plans, design research, and current state notes
- `assets/references` — visual direction references
- `data` — local runtime data, git ignored except `.gitkeep`

## Before changing code

Read these first:

1. `AGENTS.md`
2. `docs/CODEX_START_HERE.md`
3. `docs/PATHWAY_REFRAME.md`
4. `docs/DESIGN_RESEARCH_PLAYBOOK.md`
5. The current phase doc in `docs/phases/`
6. `docs/state/CURRENT_STATE.md`

## Install

```bash
pnpm install
uv sync
```

## Run the desktop app

```bash
pnpm dev
```

This is the main development command.
It launches the Tauri desktop app and starts the desktop UI dev server on `1420` plus the local API on `8000`.
The reset script clears stale listeners before booting the workspace.
The default local AI path is now `stub`, so the workflow canvas opens without requiring Ollama.
Set `LIFEMAP_LLM_PROVIDER=ollama` or `LIFEMAP_LLM_PROVIDER=openai` only when you explicitly want a real model backend.

## Other development commands

Run desktop services without opening the Tauri window:

```bash
pnpm dev:desktop:services
```

Run the legacy web surface with the API:

```bash
pnpm dev:web:full
```

Run only the web app:

```bash
pnpm dev:web
```

Run only the API:

```bash
pnpm dev:api
```

To enable explicit public URL ingestion in the API during local development, set:

```bash
SOURCE_FETCH_ENABLED=true pnpm dev:api
```

The new `/sources/url/ingest` path obeys URL policy checks and robots decisions, and is intended for one-off permitted public pages rather than broad crawling.

Explicit desktop app commands:

```bash
pnpm dev:desktop
pnpm dev:desktop:full
```

Build the desktop app:

```bash
pnpm build:desktop
```

## Verification

Frontend:

```bash
pnpm --filter desktop typecheck
pnpm typecheck
pnpm --filter desktop build
pnpm check:desktop
```

Backend:

```bash
pnpm test:api
pnpm lint:api
```

End-to-end:

```bash
pnpm playwright:install
pnpm test:web:e2e
```

Security:

```bash
pnpm secret-scan
```

## Local data

Pathway stores state locally rather than depending on a hosted backend.

- `data/local.db` — profiles, goals, graph state, revisions, route selections
- `data/lancedb/` — retrieval index and vector data
- `data/uploads/` — future ingest originals and local source material

To back up the workspace:

```bash
cp data/local.db /path/to/backup/local.db
cp -R data/lancedb /path/to/backup/lancedb
```

To restore it:

```bash
cp /path/to/backup/local.db data/local.db
cp -R /path/to/backup/lancedb data/lancedb
```

## Product notes

- The graph model uses per-map ontology via `GraphBundle` rather than a single fixed global node enum.
- The backend remains the source of truth for graph validation.
- Evidence-backed observations, assumptions, and suggestions are separate concepts in the product contract.
- Desktop-first interaction quality, graph density, and revision flows are the active design priorities.

## Status

For the latest implementation state, use:

- `docs/state/CURRENT_STATE.md`
- the relevant exec plans under `docs/state/`
