# Phase 6 — RAG-Grounded Map Generation

## Goal

Use retrieved evidence to generate better graph bundles.

## Non-goals

- No automatic large-scale crawling.

## Deliverables

- Query planner from profile/goal.
- Retrieval packet builder.
- Prompt using evidence IDs.
- Generated graph with evidence refs and assumptions.
- Evidence drawer in UI.
- Grounding tests.

## Acceptance criteria

- Nodes can reference evidence IDs.
- Unknown claims are marked as assumptions.
- UI shows evidence details.
- Tests catch nonexistent evidence refs.
