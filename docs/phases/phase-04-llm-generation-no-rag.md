# Phase 4 — LLM Generation Without RAG

## Goal

Generate a valid dynamic graph bundle from user profile and goal without external sources.

## Non-goals

- No source retrieval.
- No crawling.

## Deliverables

- `LLMProvider` protocol.
- Codex GPT-5.5 desktop default; backend OpenAI optional.
- optional `OpenAIProvider` through env vars.
- prompt templates.
- JSON schema instruction.
- validate-repair-validate loop.
- `POST /goals/{goal_id}/maps/generate`.
- frontend generate button.

## Acceptance criteria

- With a configured provider, a goal can generate a valid graph bundle.
- Invalid JSON is handled with repair or a clear error.
- Desktop Codex uses the logged-in Codex session; backend OpenAI remains env-driven.
- OpenAI key is never hardcoded.
