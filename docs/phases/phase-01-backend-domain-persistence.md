# Phase 1 — Backend Domain and Persistence

## Goal

Implement backend domain models, SQLite persistence, and CRUD APIs for core objects.

## Non-goals

- No LLM.
- No RAG.
- No graph visualization.

## Deliverables

- Domain models:
  - Profile
  - Goal
  - LifeMap
  - SourceDocument
  - SourceChunk
  - CheckIn
  - Decision
- SQLite DB setup.
- Repository interfaces and SQLite implementations.
- API routers for profile, goals, maps, sources, checkins.
- Unit tests for models and repositories.

## Acceptance criteria

- Can create a profile.
- Can create/list/update/delete goals.
- Can store and retrieve a graph bundle JSON snapshot.
- Can create manual source records.
- Can create check-ins.
- Tests pass.
