# ExecPlan: Pathway Graph Generation Long Run

## Objective

Make `pnpm dev` graph generation complete through the real Codex CLI graph path without downgrading research quality, disabling web search, or substituting a deterministic fallback graph.

## Scope

- Keep Codex `--search` enabled for GraphBundle generation.
- Keep structured output schema validation enabled.
- Remove the local 180-second cutoff for GraphBundle generation only.
- Avoid changing graph semantics, route synthesis rules, or evidence requirements.

## Steps

1. Reproduce the current failure through the local API launched by `pnpm dev`.
2. Split Codex subprocess timeouts by schema so intake analysis keeps a bounded timeout while GraphBundle generation can run to completion.
3. Remove duplicated full GraphBundle schema text from the user prompt because Codex already receives it through `--output-schema`.
4. Add focused tests for graph timeout behavior and prompt size.
5. Re-run the local `pnpm dev` graph generation path until it creates a map or exposes a new non-timeout failure.
6. Fix exposed structured-output gaps that blocked meaningful graph content:
   - `ontology.node_types[].semantic_role` was required by backend validation but missing from the Codex output schema.
   - `nodes[].data` was previously an empty object, preventing generated execution guidance from being stored.
7. Fix evidence selection so metadata-only public URL candidates do not crowd out usable source-library evidence.
8. Fix graph rendering so the original generated goal node is not reused as the terminal GOAL display node.
9. Add subprocess PATH hardening so API-spawned Codex runs can find NVM-installed `codex`.

## Success Criteria

- GraphBundle generation still calls `codex exec --search`.
- GraphBundle generation passes `timeout=None` to the Codex subprocess by default.
- The graph-generation prompt includes the grounding packet but not a second embedded JSON schema copy.
- A real local API request creates a graph map instead of returning a 180-second timeout.
- Generated route/support nodes can carry concrete `node.data` action guidance fields.
- Route/support nodes without action guidance fail validation and enter the repair loop.
- Terminal GOAL rendering preserves the original graph goal and only route-like terminal leaves connect to the display goal.

## Current Verification Note

- A live API run after removing the timeout produced a map, then exposed missing action data and metadata-only evidence crowd-out; those issues are now fixed in schema, grounding, and validation.
- A later post-fix live API run from the Codex sandbox reached Codex invocation but failed because the sandbox cannot access `/Users/henry/.codex/sessions`. Re-run from a normal user terminal is still required to verify the final live generation path.
