# Tauri Packaging Note

## Why Tauri is still a good fit

- The product is explicitly local-first.
- SQLite, LanceDB, and local file backup all map well to desktop packaging.
- A native shell would make export/import and backup flows more discoverable for long-term personal use.

## What is already compatible

- Frontend is a self-contained SvelteKit app.
- Backend is a local FastAPI service with filesystem-backed state.
- No hard dependency on cloud auth, remote database, or server-side session storage.

## Packaging options

### Option A: Sidecar backend

- Bundle the Svelte frontend in Tauri.
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

## Recommended next step

Use **Option A** first:

1. Keep current FastAPI app.
2. Add a small launcher that picks a free localhost port.
3. Point the frontend to that discovered port.
4. Store app data in a Tauri-managed app data directory.

## Preconditions before packaging

- Decide a production SvelteKit adapter strategy.
- Move local data paths behind a single app-data resolver.
- Add startup health checks and graceful shutdown handling.
- Add a workspace browser so the packaged app opens into persisted data, not only the latest active map.
