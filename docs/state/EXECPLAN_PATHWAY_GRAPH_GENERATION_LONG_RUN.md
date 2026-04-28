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
10. Add stale vector-index recovery so LanceDB is rebuilt from SQLite source chunks before search when it falls behind the source library.

## Success Criteria

- GraphBundle generation still calls `codex exec --search`.
- GraphBundle generation passes `timeout=None` to the Codex subprocess by default.
- The graph-generation prompt includes the grounding packet but not a second embedded JSON schema copy.
- A real local API request creates a graph map instead of returning a 180-second timeout.
- Generated route/support nodes can carry concrete `node.data` action guidance fields.
- Route/support nodes without action guidance fail validation and enter the repair loop.
- Terminal GOAL rendering preserves the original graph goal and only route-like terminal leaves connect to the display goal.
- Content-backed source-library evidence is used when available; metadata-only URL candidates do not become the only referenced evidence for route/support nodes.

## Current Verification Note

- Verified outside the sandbox through the local API with Codex `--search` enabled.
- `map_f287296233a74d4fb9992c3159a1180d` proved graph generation completes after the timeout/schema fixes, but exposed stale LanceDB evidence: SQLite had 112 chunks while LanceDB had only metadata rows.
- After adding index recovery, LanceDB rebuilt to 112 rows and grounding selected manual/public allowed evidence.
- `map_47981c38c6664b79968d9617803c9b14` was generated in 929.2s with 23 nodes, 32 edges, 14 content-backed evidence items, zero metadata evidence refs, and no missing route/support action fields.
