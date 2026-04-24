# ExecPlan: Collector Fetch Bridge

## Goal

Turn the research-plan targets from goal analysis into bounded local collection jobs, and implement the missing Tauri `dashboard_crawl_provider_fetch_url` command so allowed public URLs can be collected through configured collectors and inserted into the local source library.

## Context

The prior pass taught Pathway to ask follow-up questions and produce `research_plan.collection_targets`, but it stopped before invoking Crawl4AI/Scrapling/Lightpanda. The desktop role-knowledge runtime already expected a `dashboard_crawl_provider_fetch_url` command. Source library ingestion is already available through the local API `/sources/manual`, which chunks content and upserts into LanceDB.

## Non-goals

- Do not implement broad autonomous crawling or search-result expansion.
- Do not bypass robots.txt, auth walls, paywalls, captchas, or private networks.
- Do not commit local collector artifacts, databases, vector indexes, or installed packages.
- Do not delete or overwrite existing graph/source history.

## Files to read

- `AGENTS.md`
- `docs/phases/phase-05-source-library-rag.md`
- `docs/phases/phase-06-rag-grounded-generation.md`
- `docs/RAG_AND_CRAWLING_SPEC.md`
- `docs/state/CURRENT_STATE.md`
- `src-tauri/src/main.rs`
- `apps/desktop/src/app/MainAppImpl.tsx`
- `apps/desktop/src/app/main/runtime/roleKnowledgeProviders.ts`

## Planned changes

1. Add the Tauri fetch command with safe URL validation, robots.txt checks, collector-specific fetch paths, local artifact writing, and source-library upsert.
2. Ignore collector artifacts under `data/collector_artifacts/`.
3. Build desktop research-plan collector jobs from explicit URLs and limited search-probe URLs, bounded by `max_sources` and an overall first-pass cap.
4. Add a workflow sidebar action that runs those jobs one at a time through the Tauri command and reports source-library successes/failures.

## Validation

Commands to run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
pnpm --filter desktop exec tsc --noEmit
env UV_CACHE_DIR=.uv-cache uv run python3 -m py_compile /tmp/pathway_collector_fetch_script.py
git diff --check
```

Expected results:

- Rust command compiles.
- Desktop TypeScript typecheck passes.
- Embedded Python collector script parses.
- Diff has no whitespace errors.

## Risks

- Current research-plan targets are collection intents, not full source discovery results; without explicit URLs, this pass can only collect bounded search probes until the next discovery layer exists.
- Collector runtimes may require `uv` dependency sync on first use.
- Some sites may be blocked by robots.txt or return unreadable content; those should become failed jobs, not bypass attempts.

## Rollback

- Remove `dashboard_crawl_provider_fetch_url` and its handler registration.
- Remove `researchPlanCollectorJobs.ts` and the workflow sidebar collection action.
- Remove the `data/collector_artifacts/` ignore entry if no collector artifacts are produced.

## Completion notes

- Completed:
  - Implemented local collector fetch bridge and research-plan job execution from the workflow sidebar.
- Tests run:
  - `cargo fmt --manifest-path src-tauri/Cargo.toml`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `pnpm --filter desktop exec tsc --noEmit`
  - `env UV_CACHE_DIR=.uv-cache uv run python3 -m py_compile /tmp/pathway_collector_fetch_script.py`
  - `git diff --check`
  - `env UV_CACHE_DIR=.uv-cache uv run pre-commit run gitleaks --all-files`
- Known gaps:
  - Broad source discovery and result-page expansion remain the next phase.
