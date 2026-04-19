# Codex Start Here

You are building **Pathway**, a local-first personal decision-graph workspace.

## Product summary

The user wants a local web service that turns goals into a living, expandable graph of choices, routes, risks, trade-offs, opportunity cost, and evolving current-state constraints.
The app should accept a goal first, infer which resource dimensions matter, retrieve supporting sources through local RAG and permitted public research, generate a dynamic graph, and render it as the primary workspace.

Important distinction:

- Do not build a generic todo app.
- Do not build a fixed-node mind-map toy.
- Do not claim to predict the future.
- Do not bury the graph below a pile of generic forms.
- Build a local scenario mapping system where the graph schema is generated per goal and revised per current state.

## Mandatory companion docs

Read these early, because they define the desired direction more accurately than the older phase docs:

- `docs/PATHWAY_REFRAME.md`
- `docs/DESIGN_RESEARCH_PLAYBOOK.md`

## First implementation instruction

Start with the smallest relevant phase or sub-phase for the current task.

Do not implement all phases in one pass. Complete one bounded objective, run checks, update `docs/state/CURRENT_STATE.md`, then proceed.

## Initial prompt to use with Codex

Use this when starting from an empty repo:

```text
Read AGENTS.md, docs/CODEX_START_HERE.md, docs/PATHWAY_REFRAME.md, and docs/DESIGN_RESEARCH_PLAYBOOK.md first.
Then execute docs/phases/phase-00-repo-bootstrap.md only.
Do not implement later phases yet.
Create the repository skeleton, config files, package managers, lint/test scaffolding, .env.example, .gitignore, and documentation updates required by Phase 0.
After implementing, run the available checks and update docs/state/CURRENT_STATE.md.
```

## Visual style

Reference images are located under `assets/references/`.
The target visual feel is:

- graph-first, not landing-page-first
- expandable branching workspace
- low-radius, deliberate surfaces
- restrained sketch/annotation accents
- dynamic route comparison, evidence visibility, and current-state overlays

## Most important technical rule

The node definitions must be dynamic.

The app must not rely on a hardcoded global list such as `Goal | Choice | Risk | Outcome` only.
Those can exist as default examples, but each generated graph must carry its own ontology describing node/edge types and fields.

## Most important product rule

The user's present state must be able to mutate the graph.

If the user's available time, money, motivation, distance, skill, or commitments change, the graph should be able to:

- add branches
- disable branches
- surface what was lost
- recalculate viable routes
- show why the pathway changed
