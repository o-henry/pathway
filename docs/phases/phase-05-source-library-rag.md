# Phase 5 — Source Library and Local RAG

## Goal

Create a local source library and retrieval pipeline.

## Non-goals

- No broad web crawling.
- No anti-bot or paywall bypass.
- No RAG-grounded map generation yet.

## Deliverables

- Manual source ingestion UI/API.
- URL preview/ingest policy skeleton.
- Chunking service.
- Deterministic embedding fallback.
- LanceDB vector store.
- Source search endpoint.
- Tests using local fixture text.

## Acceptance criteria

- User can save a note/source.
- Source is chunked and embedded.
- Retrieval returns relevant chunks.
- Duplicate content hash is handled.
- Blocked policy does not fetch content.
