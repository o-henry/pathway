# Pathway Reframe

## 1. What Pathway is

Pathway is a local-first decision graph workspace.
It should help the user move from:

- a live goal
- a changing present state
- incomplete information

to:

- a graph of viable routes
- explicit trade-offs
- evidence-backed observations
- visible uncertainty
- revisable decisions

## 2. What changed from the earlier framing

The older framing leaned too hard toward:

- a static "life map"
- a playful pastel concept map
- a form-first page with a graph below it

The intended Pathway direction is different:

- graph-first, not form-first
- present-state aware, not snapshot-only
- research-backed, not one-shot generation only
- expandable and revisable, not decorative

## 3. Core user experience

1. The user states a goal in natural language.
2. The system analyzes the goal and determines which resource dimensions matter.
3. The system asks only the necessary follow-up questions.
4. The system runs research using user-owned context plus permitted public sources.
5. The system builds a graph that can branch outward and update later.
6. The user navigates routes, chooses actions, and records reality.
7. The graph mutates as the user's current situation changes.

## 3.1 Personal curriculum contract

Pathway should not merely draw possible routes. For each live goal, it should
produce an evolving, personalized curriculum that the user can actually read,
follow, check, and revise.

That curriculum must be:

- personal: adapted to the user's goal, current state, constraints, budget,
  energy, preferences, history, and selected route
- practical: written as concrete next actions, session cadence, resources to
  use, success checks, switch conditions, and what to record afterward
- grounded: based on user-provided facts, collected source evidence, lived
  experience signals, or explicit assumptions
- honest: unsupported claims must be labeled as assumptions or suggestions, not
  presented as evidence-backed truth
- evolving: reality updates should alter the curriculum by appending,
  annotating, weakening, or superseding routes while preserving prior graph
  history

Personalized does not mean hallucinated. If the system does not have enough
evidence or user context to make a strong recommendation, it should say what is
unknown, use a smaller validation step, and ask for or collect better evidence.

## 4. Required graph behaviors

The graph should support:

- multiple route branches
- route switching
- checkpoints
- risk nodes
- evidence markers
- assumption markers
- invalidated branches
- opportunity-cost visibility
- "you did not do this, so this branch weakened" style feedback

The graph should not be locked to a single happy path.

## 5. Dynamic intake contract

The intake must be goal-led.

The user should not always see the same static list of fields.
Instead, the system should infer which dimensions matter.

Examples:

- language learning might emphasize time, money, practice environment, and motivation
- relocation might emphasize distance, transport, budget, paperwork, and support network
- fitness might emphasize current body state, injury risk, access, schedule, and adherence risk

## 6. Multi-agent research contract

The research flow should be decomposed into bounded roles:

- goal analyst
- query planner
- scout
- verifier / skeptic
- synthesizer
- graph builder

This is meant to reduce:

- blind spots
- duplicated evidence
- overconfident synthesis
- stale or weak claims

## 7. UI direction

Pathway should feel closer to:

- a plotting wall
- a decision room
- a graph workspace
- an evidence table attached to a live route map

Pathway should feel less like:

- a cute landing page
- a pastel productivity app
- a generic SaaS dashboard

## 8. Design rules

- Keep the graph center-stage.
- Use low-radius or near-square cards by default.
- Use restrained annotation/sketch accents only where they reinforce spatial meaning.
- Prefer strong hierarchy over decorative softness.
- Make evidence, assumptions, risks, and route state visually legible.
- Do not force every node into the same decorative style.

## 9. Engineering implications

- Do not hardcode route semantics with regex-heavy branching.
- Keep graph ontology dynamic.
- Preserve full graph snapshots for revision history.
- Keep research outputs traceable.
- Make space for broader contextual research, not only narrow topic retrieval.
