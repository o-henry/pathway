# ExecPlan: Japanese Conversation Pathway Run

## Goal

Run one bounded Pathway generation pass for the goal of learning Japanese to the point of holding conversations with native speakers, then save the generated artifacts into the user's Obsidian `pathway` archive.

## Context

- The user asked for a real Pathway graph generation run, not a mock UI-only change.
- A local Pathway API is already available on `http://127.0.0.1:8000`.
- The repo already has an Obsidian archive convention under `/Users/henry/Documents/obsidian_ai/pathway/requests/<topic-slug>/<YYYY-MM-DD>/`.
- Writing into the Obsidian vault requires access outside the repo workspace sandbox.

## Non-goals

- Do not refactor the generator or UI in this pass.
- Do not invent unsupported source citations if the run is completed without source ingestion.
- Do not change the user's existing Obsidian archive structure beyond adding this one new request entry.

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
- `docs/state/CURRENT_STATE.md`
- `docs/state/EXECPLAN_ENGLISH_RAG_VALIDATION.md`

## Planned steps

1. Create a local Pathway goal for Japanese conversation fluency and run goal analysis plus graph generation through the API.
2. Export the resulting artifacts as JSON/Markdown and assemble a concise archive note bundle.
3. Copy the artifacts into `/Users/henry/Documents/obsidian_ai/pathway/requests/japanese-conversation-native-level/2026-04-22/`.

## Validation

Commands to run:

```bash
curl -sS http://127.0.0.1:8000/health
python3 <inline pathway run against http://127.0.0.1:8000>
```

Expected results:

- A new goal, analysis record, and map are created successfully.
- Exported `map_export.json` and `map_export.md` are saved.
- The Obsidian archive receives a new request folder with `data/`, `exports/`, and `reports/`.

## Risks

- The currently active backend may still be a stub or partially grounded provider depending on the local runtime configuration.
- If the Obsidian vault path changes, the final copy step will fail until the target path is corrected.

## Rollback

- Delete the generated request folder from the Obsidian archive if the run should be discarded.
- Leave repo source code untouched except for state/plan documentation.

## Completion notes

- Completed:
  - Re-ran the Japanese conversation Pathway request after the dynamic stub-graph update.
  - Generated a refreshed local goal/map pair and synced the new exports back into the existing Obsidian request folder.
- Tests run:
  - `curl -sS http://127.0.0.1:8000/health`
  - `python3 <inline regeneration runner against http://127.0.0.1:8000>`
- Known gaps:
  - The refreshed run now has goal-sensitive topology, but it still uses the repo's `stub` provider rather than a full Ollama/OpenAI graph builder.
