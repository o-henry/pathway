# Dynamic Graph Specification

## 1. Goal

The graph must be dynamically defined by algorithm and RAG context.
The application must not depend on a single hardcoded node taxonomy.

A graph is stored and exchanged as a `GraphBundle`.

## 2. Design principle

Separate:

1. **Stable envelope**: fields every node/edge needs for storage, validation, rendering, and interaction.
2. **Dynamic ontology**: per-map definitions of node types, edge types, fields, icons, colors, and semantics.
3. **Dynamic node data**: node-specific fields defined by that map's ontology.

## 3. GraphBundle schema

Conceptual JSON:

```json
{
  "schema_version": "1.0.0",
  "bundle_id": "gb_01",
  "map": {
    "title": "일본어 여행 회화를 위한 Pathway",
    "goal_id": "goal_01",
    "summary": "6개월 동안 여행 회화 수준에 도달하기 위한 선택 경로"
  },
  "ontology": {
    "node_types": [
      {
        "id": "route_choice",
        "label": "루트 선택",
        "description": "서로 다른 전략적 선택지",
        "default_style": {
          "tone": "peach",
          "shape": "rounded_card",
          "accent": "sketch_border"
        },
        "fields": [
          {"key": "time_cost", "label": "시간 비용", "value_type": "duration_range", "required": false},
          {"key": "money_cost", "label": "돈 비용", "value_type": "money_range", "required": false},
          {"key": "fit_reason", "label": "나에게 맞는 이유", "value_type": "markdown", "required": false}
        ]
      }
    ],
    "edge_types": [
      {
        "id": "progresses_to",
        "label": "진행",
        "role": "progression",
        "default_style": {"line": "curved", "accent": "sketch_arrow"}
      },
      {
        "id": "supported_by",
        "label": "근거",
        "role": "reference",
        "default_style": {"line": "dotted"}
      }
    ]
  },
  "nodes": [
    {
      "id": "node_001",
      "type": "route_choice",
      "label": "저비용 독학 + 6주차 회화 보완",
      "summary": "앱과 교재로 시작하되 말하기 부족 리스크를 6주차에 보완한다.",
      "data": {
        "time_cost": {"min_hours_per_week": 4, "max_hours_per_week": 6},
        "money_cost": {"min": 10000, "max": 80000, "currency": "KRW", "period": "month"},
        "fit_reason": "예산 제약이 있고 혼자 공부가 가능하지만 쉽게 질리는 사용자에게 중간 전환점이 필요하다."
      },
      "scores": {
        "time_load": 0.55,
        "money_load": 0.25,
        "energy_load": 0.45,
        "uncertainty": 0.45
      },
      "evidence_refs": ["ev_001"],
      "assumption_refs": ["as_001"],
      "position": {"x": 0, "y": 0},
      "style_overrides": {}
    }
  ],
  "edges": [
    {
      "id": "edge_001",
      "type": "progresses_to",
      "source": "node_001",
      "target": "node_002",
      "label": "4주 지속 성공 시",
      "condition": "4주 동안 주 4시간 이상 유지"
    }
  ],
  "evidence": [
    {
      "id": "ev_001",
      "source_id": "src_001",
      "title": "사용자 저장 자료 요약",
      "quote_or_summary": "비슷한 조건의 학습 후기에서 6~8주차 말하기 출력 부족이 자주 언급됨.",
      "url": null,
      "reliability": "user_saved_note"
    }
  ],
  "assumptions": [
    {
      "id": "as_001",
      "text": "사용자는 주 4~6시간을 6개월 동안 평균적으로 유지할 수 있다.",
      "risk_if_false": "계획 속도를 낮춰야 한다."
    }
  ],
  "warnings": [
    "이 지도는 예측이 아니라 시나리오 비교 도구입니다."
  ]
}
```

## 4. Stable envelope

### Node

Required:

- `id`: stable unique ID
- `type`: must match one `ontology.node_types[].id`
- `label`: short visible label
- `summary`: human-readable explanation
- `data`: dynamic object
- `evidence_refs`: list of evidence IDs
- `assumption_refs`: list of assumption IDs
- `position`: optional layout position

Optional:

- `scores`
- `style_overrides`
- `status`
- `created_from`
- `revision_meta`

### Edge

Required:

- `id`
- `type`: must match one `ontology.edge_types[].id`
- `source`
- `target`

Optional:

- `label`
- `condition`
- `weight`
- `style_overrides`

## 5. Dynamic ontology rules

The LLM or algorithm may create node types such as:

- `route_choice`
- `skill_gate`
- `burnout_risk`
- `budget_constraint`
- `identity_conflict`
- `checkpoint_4w`
- `evidence_note`
- `fallback_route`
- `habit_loop`
- `environment_design`

These are examples only. Do not bake them into the app as the only allowed set.

The UI must render any node type with:

- generic card fallback
- style derived from ontology
- dynamic field renderer
- evidence and assumption badges

## 6. Validation

Backend validator must check:

1. `schema_version` supported.
2. Unique IDs for nodes, edges, evidence, assumptions.
3. Every node type exists in ontology.
4. Every edge type exists in ontology.
5. Every edge source/target exists.
6. Evidence refs exist.
7. Assumption refs exist.
8. Required fields declared in the node type exist in `node.data`.
9. Progression edges form a DAG.
10. Reference/cross-link edges may form cycles only if their edge type role is not `progression`.
11. Score values are between 0 and 1.
12. External claims either have evidence refs or are marked as assumptions.

## 7. DAG rule

Only edges whose edge type has `role: progression` participate in the progression DAG.
This lets the map contain cross-links, evidence links, and similarity links without breaking the route tree.

Pseudo-logic:

```python
progression_edges = [
    edge for edge in bundle.edges
    if ontology.edge_type(edge.type).role == "progression"
]
assert is_directed_acyclic_graph(nodes, progression_edges)
```

Use NetworkX or a small local topological-sort implementation.

## 7.1 Preservation rule

Revisions, task-completion updates, and learning-route updates must preserve existing graph material by default.

Do not remove prior nodes, edges, evidence, assumptions, or route history unless the user explicitly asks for deletion or invokes a clear delete control for those exact graph elements.

Prefer appending new personal-route nodes, adding updated evidence, marking older routes as weakened/superseded, or connecting new branches to the preserved graph.

## 8. LLM generation contract

The generator must output only JSON matching the schema.

Generation steps:

1. Normalize user profile and goal.
2. Build constraints:
   - time
   - money
   - energy
   - deadline
   - preference tags
   - hard exclusions
3. Retrieve RAG evidence if available.
4. Ask LLM to propose a map-specific ontology.
5. Ask LLM to create nodes and edges using that ontology.
6. Validate.
7. Repair if invalid.
8. Layout.
9. Persist.

## 9. Repair strategy

If validation fails:

- First apply deterministic repairs for trivial issues:
  - missing empty lists
  - duplicate labels but unique generated IDs
  - absent optional style fields
- Then ask LLM to repair only the invalid JSON with validation errors.
- Reject after max repair attempts.
- Return user-facing error with partial debug summary, not raw prompt/private data.

## 10. Frontend rendering strategy

The renderer maps ontology style fields to UI:

```text
node_type.default_style.tone       -> pastel color token
node_type.default_style.shape      -> component variant
node_type.default_style.accent     -> sketch border / icon / pin
edge_type.default_style.line       -> bezier / straight / dotted
edge_type.default_style.accent     -> rough arrow / soft arrow
```

If unknown style token:

- use default pastel node
- no crash
- log developer warning only in dev mode

## 11. Versioning

`schema_version` starts at `1.0.0`.

Breaking changes must include a migration function:

```text
migrations/
  graph_bundle_1_0_to_1_1.py
```

Since this is local-first, never silently destroy old map data.
