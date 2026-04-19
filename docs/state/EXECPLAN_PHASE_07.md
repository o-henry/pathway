# Execplan Phase 07

## Goal

Let the user record progress, inspect a proposed graph diff, and accept or reject a revised Life Map snapshot.

## Delivered

- Added revision proposal domain models, graph diff models, and persistence for proposal snapshots.
- Added a graph diff builder that summarizes node, edge, and warning changes between snapshots.
- Added a revision generation flow that:
  - reads the current map
  - reads recent check-ins
  - revises the graph through the LLM with grounded evidence
  - validates the revised bundle
  - stores a pending revision proposal
- Added revision API routes for:
  - proposal creation
  - proposal fetch
  - accept into a new `LifeMap` snapshot
  - reject proposal
- Added a check-in + revision panel in the Svelte frontend.
- Surfaced node route status and revision metadata in the mind-map UI.
- Added backend tests for accept and reject flows.

## Verification

- `uv run pytest`
- `uv run ruff check apps/api`
- `UV_CACHE_DIR=.uv-cache pnpm lint`
- `pnpm typecheck`
- `pnpm --filter web build`

## Notes

- Revision proposals are persisted so the accept/reject flow survives beyond the immediate request cycle.
- Accepting a proposal creates a brand new `LifeMap` snapshot instead of mutating the previous map in place.
- Current proposal generation still relies on structured LLM revision rather than a deterministic diff engine.
- The frontend currently focuses on the active generated map on the landing workspace rather than a full historical workspace browser.
