# Design Research Playbook

This document turns prompt/design research into concrete instructions for Codex work inside Pathway.

## 1. High-level takeaways

Across OpenAI, Anthropic, and Google guidance, the same patterns show up:

- define success criteria before iterating
- use explicit structure in prompts
- break complex workflows into chained subtasks
- use examples when output shape matters
- ground claims in retrieved evidence
- iterate with critique instead of trusting the first draft
- separate objective, instructions, context, and evaluation criteria
- keep the model aware of anti-goals, not just desired goals

For Pathway, this means UI work should not be "generate a prettier page" in one shot.
It should follow a repeatable loop.

## 2. Pathway UI iteration loop

When changing the interface:

1. Define the job of the screen.
2. Define what should be dominant, secondary, and tertiary.
3. Define visual anti-goals.
4. Implement a first pass.
5. Critique that pass against the anti-goals.
6. Refine once more.

## 3. Prompt structure guidance

Based on OpenAI and Anthropic guidance, prompts for substantial design work should include:

- identity / role
- task objective
- explicit constraints
- anti-goals
- examples or references
- output contract
- critique rubric
- evaluation criteria for whether the screen functions as product, not just looks stylish

Recommended structure:

```text
<identity>
You are a product designer and front-end implementer working on Pathway.
</identity>

<objective>
Make the graph workspace the primary surface for route exploration and state changes.
</objective>

<constraints>
- low-radius surfaces
- graph-first layout
- no generic SaaS hero stack
- preserve readability under high node density
</constraints>

<anti_goals>
- giant rounded pills
- candy pastel dashboard tone
- forms dominating the screen
</anti_goals>

<references>
- attached screenshots
- docs/PATHWAY_REFRAME.md
- docs/ARCHITECTURE.md
</references>

<output_contract>
- explain the layout hierarchy first
- then implement
- then self-critique once
</output_contract>
```

## 4. Claude-derived practices worth adopting

From Anthropic's official docs:

- use XML-style structure for complex prompts
- split multi-step work into prompt chains
- for long context, place documents early and the task later
- ask the model to quote or ground relevant evidence before synthesis
- define success before prompting and critique output against that success definition

How to apply inside Pathway:

- keep research prompts structured with machine-readable sections
- split research into analysis -> retrieval -> critique -> synthesis
- do not ask one prompt to both crawl, verify, synthesize, and render final graph

## 5. Gemini-derived practices worth adopting

From Google's official prompt guides:

- prompt engineering is iterative and test-driven
- objective, instructions, system instructions, examples, and context should be separated clearly
- prompts should avoid ambiguity, conflicting instructions, and missing output format
- prompt optimization can be systematic, not purely intuitive
- preference notes and negative examples improve iteration quality

How to apply inside Pathway:

- define measurable screen goals before UI refactors
- define machine-readable graph output requirements before generation changes
- keep task prompts narrow and explicit

## 6. Research/paper-derived practices worth adopting

### Self-Refine

Use a critique-and-revise loop instead of trusting first-pass output.

### Reflexion

Keep a textual memory of failures and lessons from earlier attempts so the next attempt improves.

### DSPy

Treat the system as a modular program with optimizable subparts, not one giant brittle prompt.

### Automatic Prompt Optimization

Prompt quality can be improved by explicit feedback and targeted rewriting rather than vague iteration.

## 7. Pathway-specific design evaluation

OpenAI's UI mockup evaluation guidance maps well to this project:

- component fidelity: controls should clearly look interactive
- layout realization: the graph must read as the primary surface at a glance
- text clarity: labels, state markers, warnings, and route signals must stay legible

For Pathway, evaluate every major UI pass with these questions:

- Is the graph visually dominant without hiding the operator workflow?
- Can the user tell what is a route, what is pressure, what is loss, and what is evidence?
- Does the page look like a decision room rather than a generic SaaS dashboard?
- If the graph did not render, would the remaining surface still communicate the system model clearly?

## 8. Open-source stack mapping

Use each tool for its strongest role instead of forcing one crawler to do everything:

- `Crawl4AI`: primary LLM-ready extraction path for permitted pages
- `Scrapy`: bounded breadth-first orchestration when a domain-level crawl is justified
- `Scrapling`: parser resilience for difficult but permitted HTML, without stealth or bypass features
- `Lightpanda`: lower-overhead JS rendering when a page needs execution before extraction

Codex should not default to broad crawling. The order is:

1. user-owned notes
2. user-pasted excerpts
3. explicitly approved URLs
4. bounded permitted crawling

## 9. Concrete rules for Codex in this repo

- When doing major UI work, write a one-paragraph design intent before editing.
- After the first implementation pass, perform one critique pass against anti-goals.
- If the screen is graph-centric, ensure the graph occupies the most important spatial region.
- If a component adds softness without information value, remove or reduce it.
- Prefer a smaller set of stronger visual moves.
- Do not accept a design pass until it is checked against a screenshot or browser snapshot.
- When implementing research workflows, separate scout, skeptic, synthesizer, and graph-builder responsibilities.

## 10. Source links

- OpenAI Prompting: https://platform.openai.com/docs/guides/prompting
- OpenAI Prompt Generation: https://platform.openai.com/docs/guides/prompt-generation/prompt-generation
- OpenAI Frontend Coding with GPT-5: https://cookbook.openai.com/examples/gpt-5/gpt-5_frontend
- Anthropic Prompt Engineering Overview: https://docs.anthropic.com/en/docs/prompt-engineering
- Anthropic XML Tags: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/use-xml-tags
- Anthropic Prompt Chaining: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-prompts
- Anthropic Long Context Tips: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/long-context-tips
- Anthropic Define Success: https://docs.anthropic.com/en/docs/test-and-evaluate/define-success
- Gemini Prompt Best Practices: https://ai.google.dev/guide/prompt_best_practices
- Vertex Prompt Design Strategies: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies
- Gemini 3 Prompting Guide: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide
- Self-Refine: https://arxiv.org/abs/2303.17651
- Reflexion: https://arxiv.org/abs/2303.11366
- DSPy: https://arxiv.org/abs/2310.03714
- Automatic Prompt Optimization: https://arxiv.org/abs/2305.03495
