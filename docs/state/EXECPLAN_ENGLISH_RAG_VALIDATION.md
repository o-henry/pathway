# ExecPlan: English Conversation RAG Validation

## Goal

Run one bounded Pathway validation pass for the goal of reaching conversational English with native speakers, using real public research notes, local source ingestion, and graph generation/export.

## Context

- The repo instructions require a bounded objective, short ExecPlan, and end-of-run state notes for non-trivial work.
- The current API supports manual source ingestion and RAG-grounded map generation.
- In this environment, the default LLM provider is still the local `stub` generator unless Ollama or OpenAI is configured.
- The user requested that generated documents be saved under `obsidian_ai/pathway`.

## Non-goals

- Do not implement broad crawling or anti-bot collection.
- Do not refactor the generator in this pass.
- Do not claim that the current stub graph is equivalent to a fully grounded production graph.

## Files to read

- `AGENTS.md`
- `docs/CODEX_START_HERE.md`
- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/DYNAMIC_GRAPH_SPEC.md`
- `docs/RAG_AND_CRAWLING_SPEC.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/phases/phase-05-source-library-rag.md`
- `docs/phases/phase-06-rag-grounded-generation.md`
- `docs/state/CURRENT_STATE.md`

## Planned changes

1. Gather a small public evidence packet for the English conversation goal from permitted sources.
2. Ingest those notes through the local Pathway source library and run goal analysis plus map generation.
3. Export the resulting artifacts and save a concise validation report for the user.

## Validation

Commands to run:

```bash
UV_CACHE_DIR=.uv-cache uv run fastapi dev apps/api/lifemap_api/main.py --host 127.0.0.1 --port 8000
python3 <validation runner inline via exec>
```

Expected results:

- Goal analysis returns resource dimensions and research questions.
- Manual source ingestion stores the public research notes.
- Generated map contains schema-valid nodes and at least some evidence refs from retrieved sources.
- Exported JSON/Markdown artifacts are written for later user review.

## Risks

- Without a configured real LLM backend, graph semantics will still come from the stub generator.
- Retrieval can surface only the strongest local-note matches, not every ingested source.
- Saving into the Obsidian vault requires write access outside the repo sandbox.

## Rollback

- Leave repo source code untouched except for documentation/state notes.
- Delete the generated `output/pathway-verification/` artifacts if this validation run should be discarded.

## Completion notes

- Completed:
- Tests run:
- Known gaps:
