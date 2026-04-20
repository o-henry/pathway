# Tauri Packaging Note

## Why Tauri is still a good fit

- The product is explicitly local-first.
- SQLite, LanceDB, and local file backup all map well to desktop packaging.
- A native shell would make export/import and backup flows more discoverable for long-term personal use.

## What is already compatible

- Frontend is now a self-contained React/Vite desktop UI under `apps/desktop`.
- Backend is a local FastAPI service with filesystem-backed state.
- No hard dependency on cloud auth, remote database, or server-side session storage.

## Packaging options

### Option A: Sidecar backend

- Bundle the desktop frontend in Tauri.
- Launch FastAPI as a sidecar process.
- Keep SQLite/LanceDB paths inside an app-specific local data directory.

Pros:

- Minimal backend rewrite
- Fastest path from current architecture

Cons:

- Need process lifecycle management
- Need robust port coordination / health checks

### Option B: Rust-hosted shell + embedded Python runtime

- Ship Python runtime and backend together.
- Start backend internally through Tauri bootstrap.

Pros:

- Cleaner installation story

Cons:

- More packaging complexity
- Harder cross-platform testing

## Current direction

The repository now includes a first real `src-tauri/` desktop shell plus a dedicated `apps/desktop` React frontend.

- `pnpm dev:desktop` starts the Tauri app in development.
- The desktop shell targets the React desktop UI on `http://127.0.0.1:1420`.
- The current Rust bootstrap attempts to start the local FastAPI app on `127.0.0.1:8000` when it is not already running.

This is intentionally the smallest viable desktop path, not the final packaged distribution story.

## Recommended next step

Continue with **Option A**:

1. Keep the current FastAPI app.
2. Replace the fixed `8000` assumption with a discovered port + handshake flow.
3. Move local data paths behind a Tauri app-data resolver.
4. Decide how Python/uv/runtime dependencies will be bundled for production desktop builds.

## Preconditions before packaging

- Decide whether the legacy `apps/web` Svelte path should remain in the repo or be retired.
- Move local data paths behind a single app-data resolver.
- Add startup health checks and graceful shutdown handling.
- Add a workspace browser so the packaged app opens into persisted data, not only the latest active map.
