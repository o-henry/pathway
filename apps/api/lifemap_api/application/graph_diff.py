from __future__ import annotations

from typing import Any

from lifemap_api.domain.graph_bundle import GraphBundle, GraphEdgeRecord, GraphNodeRecord
from lifemap_api.domain.models import (
    GraphDiff,
    GraphEdgeChange,
    GraphNodeChange,
    GraphWarningChange,
)


def _changed_fields(previous: dict[str, Any], current: dict[str, Any]) -> list[str]:
    keys = set(previous) | set(current)
    return sorted(key for key in keys if previous.get(key) != current.get(key))


def _node_change_reason(node: GraphNodeRecord) -> str:
    return node.revision_meta.get("change_note", "Route state changed after a new check-in.")


def _edge_change_reason(edge: GraphEdgeRecord) -> str:
    metadata = edge.style_overrides if isinstance(edge.style_overrides, dict) else {}
    change_note = metadata.get("change_note")
    if isinstance(change_note, str) and change_note.strip():
        return change_note.strip()
    return "Connection changed after the latest check-in."


def build_graph_diff(previous: GraphBundle, current: GraphBundle) -> GraphDiff:
    previous_nodes = {node.id: node for node in previous.nodes}
    current_nodes = {node.id: node for node in current.nodes}
    previous_edges = {edge.id: edge for edge in previous.edges}
    current_edges = {edge.id: edge for edge in current.edges}

    node_changes: list[GraphNodeChange] = []
    edge_changes: list[GraphEdgeChange] = []
    warning_changes: list[GraphWarningChange] = []
    summary: list[str] = []

    for node_id, node in current_nodes.items():
        before = previous_nodes.get(node_id)
        if before is None:
            node_changes.append(
                GraphNodeChange(
                    node_id=node.id,
                    change_type="added",
                    label=node.label,
                    reason=_node_change_reason(node),
                    next_status=node.status,
                )
            )
            continue

        data_changes = _changed_fields(before.data, node.data)
        status_changed = before.status != node.status and (before.status or node.status)
        summary_changed = before.summary != node.summary

        if status_changed:
            node_changes.append(
                GraphNodeChange(
                    node_id=node.id,
                    change_type="status_changed",
                    label=node.label,
                    reason=_node_change_reason(node),
                    previous_status=before.status,
                    next_status=node.status,
                    fields_changed=data_changes,
                )
            )
        elif data_changes or summary_changed:
            changed_fields = list(data_changes)
            if summary_changed:
                changed_fields.append("summary")
            node_changes.append(
                GraphNodeChange(
                    node_id=node.id,
                    change_type="updated",
                    label=node.label,
                    reason=_node_change_reason(node),
                    previous_status=before.status,
                    next_status=node.status,
                    fields_changed=sorted(set(changed_fields)),
                )
            )

    for node_id, node in previous_nodes.items():
        if node_id in current_nodes:
            continue
        node_changes.append(
            GraphNodeChange(
                node_id=node.id,
                change_type="removed",
                label=node.label,
                reason="This route is no longer part of the recommended snapshot.",
                previous_status=node.status,
            )
        )

    for edge_id, edge in current_edges.items():
        before = previous_edges.get(edge_id)
        if before is None:
            edge_changes.append(
                GraphEdgeChange(
                    edge_id=edge.id,
                    change_type="added",
                    source=edge.source,
                    target=edge.target,
                    label=edge.label,
                    reason=_edge_change_reason(edge),
                )
            )
            continue
        if (
            before.source != edge.source
            or before.target != edge.target
            or before.label != edge.label
            or before.condition != edge.condition
            or before.type != edge.type
        ):
            edge_changes.append(
                GraphEdgeChange(
                    edge_id=edge.id,
                    change_type="updated",
                    source=edge.source,
                    target=edge.target,
                    label=edge.label,
                    reason=_edge_change_reason(edge),
                )
            )

    for edge_id, edge in previous_edges.items():
        if edge_id in current_edges:
            continue
        edge_changes.append(
            GraphEdgeChange(
                edge_id=edge.id,
                change_type="removed",
                source=edge.source,
                target=edge.target,
                label=edge.label,
                reason="This connection is no longer recommended in the revised route.",
            )
        )

    previous_warning_set = set(previous.warnings)
    current_warning_set = set(current.warnings)
    for warning in sorted(current_warning_set - previous_warning_set):
        warning_changes.append(GraphWarningChange(change_type="added", warning=warning))
    for warning in sorted(previous_warning_set - current_warning_set):
        warning_changes.append(GraphWarningChange(change_type="removed", warning=warning))

    if node_changes:
        summary.append(f"{len(node_changes)} node changes proposed")
    if edge_changes:
        summary.append(f"{len(edge_changes)} edge changes proposed")
    if warning_changes:
        summary.append(f"{len(warning_changes)} warning updates proposed")
    if not summary:
        summary.append("No material graph changes were proposed.")

    return GraphDiff(
        summary=summary,
        node_changes=node_changes,
        edge_changes=edge_changes,
        warning_changes=warning_changes,
    )
