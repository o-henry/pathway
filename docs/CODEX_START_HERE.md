# Codex Start Here

You are building **Life Map / Life Guide**, a local-first personal scenario-mapping application.

## Product summary

The user wants a local web service that turns life goals into a dynamic, playful mind-map.
The app should accept profile/goal/constraints, retrieve optional supporting sources through local RAG, generate a dynamic graph, and render it as a hand-drawn map of choices, risks, outcomes, checkpoints, and route changes.

Important distinction:

- Do not build a generic todo app.
- Do not build a fixed-node mind-map toy.
- Do not claim to predict the future.
- Build a local scenario mapping system where the graph schema is generated per goal.

## First implementation instruction

Start with Phase 0 in `docs/phases/phase-00-repo-bootstrap.md`.

Do not implement all phases in one pass. Complete one phase, run checks, update `docs/state/CURRENT_STATE.md`, then proceed.

## Initial prompt to use with Codex

Use this when starting from an empty repo:

```text
Read AGENTS.md and docs/CODEX_START_HERE.md first.
Then execute docs/phases/phase-00-repo-bootstrap.md only.
Do not implement later phases yet.
Create the repository skeleton, config files, package managers, lint/test scaffolding, .env.example, .gitignore, and documentation updates required by Phase 0.
After implementing, run the available checks and update docs/state/CURRENT_STATE.md.
```

## Visual style

Reference images are located under `assets/references/`.
The target visual feel is:

- mind-map, not spreadsheet
- rounded pastel blocks
- playful but readable
- hand-drawn/sketchy connector accents
- dynamic branching and route comparison

## Most important technical rule

The node definitions must be dynamic.

The app must not rely on a hardcoded global list such as `Goal | Choice | Risk | Outcome` only.
Those can exist as default examples, but each generated graph must carry its own ontology describing node/edge types and fields.
