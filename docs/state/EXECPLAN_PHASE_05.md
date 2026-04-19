# Execplan Phase 05

## Goal

Add a local source library and retrieval pipeline that prepares the app for grounded generation in the next phase.

## Completed

- Added manual source ingestion pipeline with:
  - duplicate content-hash detection,
  - chunk generation,
  - Ollama embedding requests,
  - LanceDB indexing.
- Added `SourceChunk` persistence in SQLite.
- Added source retrieval endpoint backed by embeddings + LanceDB search.
- Added URL preview policy skeleton that:
  - blocks localhost/private-network URLs,
  - returns metadata-only policy for public URLs,
  - does not fetch remote content yet.
- Added lightweight frontend source library panel with:
  - manual note save,
  - semantic search,
  - URL preview policy check.
- Added tests for:
  - ingestion and retrieval,
  - duplicate-content handling,
  - blocked URL preview.

## Verification

- `UV_CACHE_DIR=.uv-cache uv sync`
- `UV_CACHE_DIR=.uv-cache uv run pytest`
- `UV_CACHE_DIR=.uv-cache uv run ruff check apps/api`
- `UV_CACHE_DIR=.uv-cache pnpm lint`
- `pnpm typecheck`
- `pnpm --filter web build`

## Notes

- Retrieval is local-only and uses fake embeddings in tests to avoid network reliance.
- This phase deliberately stops before RAG-grounded map generation.
- The frontend still loads a large main bundle because the graph workspace is eager-loaded; chunk splitting is deferred.
