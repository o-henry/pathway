# ExecPlan: Deep Research And Collector Audit

## Goal

Run a deeper Pathway validation pass for the English conversation goal using richer source layers, then determine whether collector backends are actually participating in the Pathway graph-generation flow.

## Context

- The previous validation proved manual-note ingestion and evidence linking, but not deep research quality.
- The user explicitly asked for more depth and asked whether collectors are actually being used.
- The current repo still defaults to the local `stub` map generator unless an external LLM backend is configured.

## Non-goals

- Do not implement live collector ingestion in this pass.
- Do not refactor the retrieval stack yet.
- Do not claim that the current collector doctor UI equals end-to-end Pathway collector usage.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/RAG_AND_CRAWLING_SPEC.md`
- `docs/phases/phase-05-source-library-rag.md`
- `docs/phases/phase-06-rag-grounded-generation.md`
- `docs/state/CURRENT_STATE.md`
- `apps/api/lifemap_api/api/routes_sources.py`
- `apps/api/lifemap_api/application/source_pipeline.py`
- `apps/desktop/src/app/MainAppImpl.tsx`

## Planned changes

1. Build a deeper evidence packet with official, research, lived-experience, and personal-story layers.
2. Ingest that packet through the Pathway source library and re-run graph generation/export.
3. Audit the collector-related codepaths and compare them with the actual Pathway ingestion flow.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run fastapi dev apps/api/lifemap_api/main.py --host 127.0.0.1 --port 8000
python3 <inline deep-research validation runner>
rg -n "dashboard_crawl_provider_health|/sources/manual|/sources/url-preview|fetch_allowed=False" ...
```

Expected results:

- Deeper sources are stored in the local source library.
- Exported artifacts document the richer packet and the generated map.
- Collector audit clearly states whether collectors are actually used by the Pathway graph-generation flow.

## Risks

- The stub generator can still mask semantic improvements in the evidence packet.
- Retrieval ranking may still surface older or shallower notes from the shared local database.
- Collector runtime commands may exist only in a different runtime layer, not in the Pathway API itself.

## Rollback

- Remove `output/pathway-deep-research/` artifacts if this run should be discarded.
- Remove copied vault artifacts from `/Users/henry/Documents/obsidian_ai/pathway` if needed.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
