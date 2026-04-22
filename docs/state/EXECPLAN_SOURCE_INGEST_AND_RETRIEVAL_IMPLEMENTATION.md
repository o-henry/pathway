# ExecPlan: Source Ingest And Retrieval Implementation

## Goal

Implement a real Pathway URL ingestion path plus better retrieval ranking so deeper, fresher, and lived-experience-heavy sources have a better chance of shaping generated graphs.

## Context

- The previous validation showed that deep notes could be stored but were not reliably surfaced in the final evidence packet.
- The desktop UI exposed collector status, but the Pathway API still lacked a real `/sources/url/ingest` flow.
- The user explicitly asked to implement:
  - retrieval improvements
  - actual collector usage in Pathway
  - richer experience aggregation

## Non-goals

- Do not build a broad crawling system.
- Do not claim fully grounded graph semantics while the active LLM backend is still `stub`.
- Do not bypass robots.txt or site restrictions.

## Files to read

- `AGENTS.md`
- `docs/RAG_AND_CRAWLING_SPEC.md`
- `docs/phases/phase-05-source-library-rag.md`
- `docs/phases/phase-06-rag-grounded-generation.md`
- `apps/api/lifemap_api/application/source_pipeline.py`
- `apps/api/lifemap_api/application/sources.py`
- `apps/api/lifemap_api/application/generation_grounding.py`
- `apps/api/lifemap_api/application/generation.py`
- `apps/api/lifemap_api/api/routes_sources.py`
- `apps/api/tests/test_source_library.py`

## Planned changes

1. Add an explicit `/sources/url/ingest` API path that fetches and extracts permitted public pages.
2. Persist fetched source metadata so retrieval can rank by richer signals than vector similarity alone.
3. Feed goal-analysis research questions into retrieval and re-rank hits using lexical overlap, metadata layer, and freshness.
4. Verify the new path with an isolated collector-backed end-to-end run.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run pytest apps/api/tests/test_source_library.py apps/api/tests/test_map_generation.py
UV_CACHE_DIR=.uv-cache uv run ruff check apps/api/lifemap_api/application/source_pipeline.py apps/api/lifemap_api/application/sources.py apps/api/lifemap_api/application/generation.py apps/api/lifemap_api/application/generation_grounding.py apps/api/lifemap_api/api/routes_sources.py apps/api/lifemap_api/api/routes_goals.py apps/api/lifemap_api/infrastructure/vector_store.py apps/api/lifemap_api/domain/models.py apps/api/tests/test_source_library.py
SOURCE_FETCH_ENABLED=true LIFEMAP_SQLITE_URL=sqlite:///./output/collector-e2e.db LIFEMAP_LANCEDB_URI=./output/collector-e2e-lancedb LIFEMAP_DATA_DIR=./output/collector-e2e-data UV_CACHE_DIR=.uv-cache uv run fastapi dev apps/api/lifemap_api/main.py --host 127.0.0.1 --port 8000
```

Expected results:

- Unit tests pass for source ingestion and map generation.
- The changed API files lint clean.
- A collector-backed isolated run persists fetched URLs and surfaces at least one collector-fetched source in the final graph evidence.

## Risks

- robots.txt can block many lived-experience sources such as Reddit.
- Retrieval quality can still be bounded by the simplistic embedding backend and the `stub` generator.
- Existing LanceDB tables may need schema recreation when new metadata fields are added.

## Rollback

- Remove `output/collector-e2e-*` and `output/experience-sample-stats/` artifacts if the verification run should be discarded.
- Revert the API changes if collector-backed ingestion should be postponed again.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
