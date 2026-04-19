from __future__ import annotations

from collections import Counter, defaultdict, deque
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

SUPPORTED_GRAPH_SCHEMA_VERSIONS = {"1.0.0"}


class GraphDomainModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GraphMapMeta(GraphDomainModel):
    title: str = Field(min_length=1, max_length=200)
    goal_id: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1)


class GraphFieldDefinition(GraphDomainModel):
    key: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=120)
    value_type: str = Field(min_length=1, max_length=80)
    required: bool = False


class GraphNodeTypeStyle(GraphDomainModel):
    tone: str | None = Field(default=None, min_length=1, max_length=40)
    shape: str | None = Field(default=None, min_length=1, max_length=40)
    accent: str | None = Field(default=None, min_length=1, max_length=80)


class GraphNodeTypeDefinition(GraphDomainModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1)
    default_style: GraphNodeTypeStyle | None = None
    fields: list[GraphFieldDefinition] = Field(default_factory=list)


class GraphEdgeTypeStyle(GraphDomainModel):
    line: str | None = Field(default=None, min_length=1, max_length=40)
    accent: str | None = Field(default=None, min_length=1, max_length=80)


class GraphEdgeTypeDefinition(GraphDomainModel):
    id: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=120)
    role: str = Field(min_length=1, max_length=80)
    default_style: GraphEdgeTypeStyle | None = None


class GraphOntology(GraphDomainModel):
    node_types: list[GraphNodeTypeDefinition] = Field(default_factory=list)
    edge_types: list[GraphEdgeTypeDefinition] = Field(default_factory=list)


class GraphNodePosition(GraphDomainModel):
    x: float
    y: float


class GraphNodeRecord(GraphDomainModel):
    id: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=120)
    label: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1)
    data: dict[str, Any] = Field(default_factory=dict)
    scores: dict[str, float] = Field(default_factory=dict)
    evidence_refs: list[str] = Field(default_factory=list)
    assumption_refs: list[str] = Field(default_factory=list)
    position: GraphNodePosition | None = None
    style_overrides: dict[str, Any] = Field(default_factory=dict)
    status: str | None = Field(default=None, min_length=1, max_length=80)
    created_from: str | None = Field(default=None, min_length=1, max_length=200)
    revision_meta: dict[str, Any] = Field(default_factory=dict)

    @field_validator("scores")
    @classmethod
    def validate_scores(cls, value: dict[str, float]) -> dict[str, float]:
        invalid_keys = [key for key, score in value.items() if score < 0 or score > 1]
        if invalid_keys:
            joined = ", ".join(sorted(invalid_keys))
            raise ValueError(f"node score values must be between 0 and 1: {joined}")
        return value


class GraphEdgeRecord(GraphDomainModel):
    id: str = Field(min_length=1, max_length=120)
    type: str = Field(min_length=1, max_length=120)
    source: str = Field(min_length=1, max_length=120)
    target: str = Field(min_length=1, max_length=120)
    label: str | None = None
    condition: str | None = None
    weight: float | None = None
    style_overrides: dict[str, Any] = Field(default_factory=dict)


class EvidenceItem(GraphDomainModel):
    id: str = Field(min_length=1, max_length=120)
    source_id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    quote_or_summary: str = Field(min_length=1)
    url: str | None = None
    reliability: str = Field(min_length=1, max_length=80)


class AssumptionItem(GraphDomainModel):
    id: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1)
    risk_if_false: str = Field(min_length=1)


def _format_duplicate_ids(label: str, ids: list[str]) -> str:
    duplicates = sorted(item_id for item_id, count in Counter(ids).items() if count > 1)
    if not duplicates:
        return ""
    return f"duplicate {label} ids: {', '.join(duplicates)}"


def _collect_progression_cycle(
    nodes: list[GraphNodeRecord], edges: list[GraphEdgeRecord], progression_type_ids: set[str]
) -> str | None:
    node_ids = {node.id for node in nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)
    indegree = {node_id: 0 for node_id in node_ids}

    for edge in edges:
        if edge.type not in progression_type_ids:
            continue
        if edge.source not in indegree or edge.target not in indegree:
            continue
        adjacency[edge.source].append(edge.target)
        indegree[edge.target] += 1

    queue = deque(node_id for node_id, degree in indegree.items() if degree == 0)
    visited_count = 0

    while queue:
        current = queue.popleft()
        visited_count += 1
        for target in adjacency.get(current, []):
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)

    if visited_count == len(node_ids):
        return None

    cyclic_nodes = sorted(node_id for node_id, degree in indegree.items() if degree > 0)
    return f"progression edges must form a DAG; cycle detected involving: {', '.join(cyclic_nodes)}"


class GraphBundle(GraphDomainModel):
    schema_version: str = Field(min_length=1, max_length=20)
    bundle_id: str = Field(min_length=1, max_length=200)
    map: GraphMapMeta
    ontology: GraphOntology
    nodes: list[GraphNodeRecord] = Field(default_factory=list)
    edges: list[GraphEdgeRecord] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    assumptions: list[AssumptionItem] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_graph_rules(self) -> GraphBundle:
        errors: list[str] = []

        if self.schema_version not in SUPPORTED_GRAPH_SCHEMA_VERSIONS:
            supported = ", ".join(sorted(SUPPORTED_GRAPH_SCHEMA_VERSIONS))
            errors.append(
                f"unsupported schema_version '{self.schema_version}'; supported: {supported}"
            )

        for label, ids in (
            ("node", [node.id for node in self.nodes]),
            ("edge", [edge.id for edge in self.edges]),
            ("evidence", [item.id for item in self.evidence]),
            ("assumption", [item.id for item in self.assumptions]),
            ("node type", [item.id for item in self.ontology.node_types]),
            ("edge type", [item.id for item in self.ontology.edge_types]),
        ):
            duplicate_error = _format_duplicate_ids(label, ids)
            if duplicate_error:
                errors.append(duplicate_error)

        node_type_ids = {node_type.id for node_type in self.ontology.node_types}
        edge_types_by_id = {edge_type.id: edge_type for edge_type in self.ontology.edge_types}
        node_ids = {node.id for node in self.nodes}
        evidence_ids = {item.id for item in self.evidence}
        assumption_ids = {item.id for item in self.assumptions}

        for edge in self.edges:
            edge_type = edge_types_by_id.get(edge.type)
            if edge_type is None:
                errors.append(
                    f"edge '{edge.id}' references unknown edge type '{edge.type}'"
                )
            if edge.source not in node_ids:
                errors.append(
                    f"edge '{edge.id}' references missing source node '{edge.source}'"
                )
            if edge.target not in node_ids:
                errors.append(
                    f"edge '{edge.id}' references missing target node '{edge.target}'"
                )

        node_types_by_id = {node_type.id: node_type for node_type in self.ontology.node_types}

        for node in self.nodes:
            if node.type not in node_type_ids:
                errors.append(
                    f"node '{node.id}' references unknown node type '{node.type}'"
                )
                continue

            node_type = node_types_by_id[node.type]
            required_fields = {field.key for field in node_type.fields if field.required}
            missing_fields = sorted(field for field in required_fields if field not in node.data)
            if missing_fields:
                errors.append(
                    f"node '{node.id}' is missing required fields for type '{node.type}': "
                    + ", ".join(missing_fields)
                )

            missing_evidence = sorted(ref for ref in node.evidence_refs if ref not in evidence_ids)
            if missing_evidence:
                errors.append(
                    f"node '{node.id}' references missing evidence ids: "
                    + ", ".join(missing_evidence)
                )

            missing_assumptions = sorted(
                ref for ref in node.assumption_refs if ref not in assumption_ids
            )
            if missing_assumptions:
                errors.append(
                    f"node '{node.id}' references missing assumption ids: "
                    + ", ".join(missing_assumptions)
                )

        progression_type_ids = {
            edge_type.id
            for edge_type in self.ontology.edge_types
            if edge_type.role == "progression"
        }
        cycle_error = _collect_progression_cycle(self.nodes, self.edges, progression_type_ids)
        if cycle_error:
            errors.append(cycle_error)

        if errors:
            raise ValueError("; ".join(errors))

        return self


def validate_graph_bundle(bundle: GraphBundle | dict[str, Any]) -> GraphBundle:
    if isinstance(bundle, GraphBundle):
        return bundle

    try:
        return GraphBundle.model_validate(bundle)
    except ValidationError:
        raise
