from __future__ import annotations

import json
from collections import defaultdict
from typing import Any

from lifemap_api.application.generation_grounding import GroundingPacket
from lifemap_api.application.graph_quality import (
    node_requires_evidence,
    semantic_text_for_node_types,
)
from lifemap_api.domain.graph_bundle import EvidenceItem, GraphBundle, GraphEdgeRecord
from lifemap_api.domain.models import CurrentStateSnapshot, Profile

TRACE_DATA_KEYS = (
    "source_ranking_basis",
    "user_state_basis",
    "curriculum_order_basis",
)


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, (list, tuple, set)):
        return ", ".join(_clean_text(item) for item in value if _clean_text(item))
    if isinstance(value, dict):
        return ", ".join(
            f"{key}: {_clean_text(item)}" for key, item in value.items() if _clean_text(item)
        )
    return " ".join(str(value).split())


def _clip(value: str, limit: int = 240) -> str:
    normalized = _clean_text(value)
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def _profile_state_fragments(
    *,
    profile: Profile | None,
    current_state: CurrentStateSnapshot | None,
) -> list[str]:
    fragments: list[str] = []
    if current_state is not None:
        if current_state.state_summary:
            fragments.append(f"현재 상태: {_clip(current_state.state_summary, 110)}")
        if current_state.active_constraints:
            fragments.append(
                "현재 제약: "
                + ", ".join(_clip(item, 60) for item in current_state.active_constraints[:4])
            )
        if current_state.resource_values:
            compact_resources = ", ".join(
                f"{key}: {_clip(_clean_text(value), 45)}"
                for key, value in list(current_state.resource_values.items())[:5]
                if _clean_text(value)
            )
            if compact_resources:
                fragments.append(f"현재 자원: {compact_resources}")

    if profile is not None:
        if profile.weekly_free_hours is not None:
            fragments.append(f"주당 가능 시간: {profile.weekly_free_hours:g}시간")
        if profile.monthly_budget_amount is not None:
            currency = profile.monthly_budget_currency or ""
            fragments.append(f"월 예산: {profile.monthly_budget_amount:g} {currency}".strip())
        if profile.energy_level:
            fragments.append(f"에너지: {profile.energy_level}")
        if profile.preference_tags:
            fragments.append("선호: " + ", ".join(profile.preference_tags[:5]))
        if profile.constraints:
            compact_constraints = ", ".join(
                f"{key}: {_clip(_clean_text(value), 45)}"
                for key, value in list(profile.constraints.items())[:5]
                if _clean_text(value)
            )
            if compact_constraints:
                fragments.append(f"프로필 제약: {compact_constraints}")

    return fragments


def _user_state_basis(
    *,
    profile: Profile | None,
    current_state: CurrentStateSnapshot | None,
) -> str:
    fragments = _profile_state_fragments(profile=profile, current_state=current_state)
    if not fragments:
        return (
            "저장된 프로필/현재 상태가 아직 부족해서 목표와 명시 가정을 기준으로 "
            "작은 검증 단계부터 배치했습니다."
        )
    return _clip("; ".join(fragments), 520)


def _source_ranking_basis(items: list[EvidenceItem]) -> str:
    if not items:
        return (
            "이 노드에 연결된 원문 근거가 아직 없습니다. 현재 배치는 사용자 상태와 "
            "명시 가정을 기준으로 한 임시 순서입니다."
        )
    parts = []
    for item in items[:3]:
        labels = ", ".join(item.query_labels) if item.query_labels else "retrieval"
        layer = item.source_layer or item.reliability
        score = f", rank {item.rank_score:.3f}" if item.rank_score is not None else ""
        reason = item.ranking_reason or f"matched {labels} from {layer}{score}"
        parts.append(f"{item.id} '{item.title}' - {reason}")
    suffix = "" if len(items) <= 3 else f" 외 {len(items) - 3}개"
    return _clip(" / ".join(parts) + suffix, 620)


def _edge_text(edge: GraphEdgeRecord) -> str:
    label = _clean_text(edge.label)
    condition = _clean_text(edge.condition)
    if label and condition:
        return f"{label} ({condition})"
    return label or condition or edge.id


def _curriculum_order_basis(
    *,
    node_label: str,
    linked_items: list[EvidenceItem],
    user_basis: str,
    incoming_edges: list[GraphEdgeRecord],
    outgoing_edges: list[GraphEdgeRecord],
) -> str:
    source_hint = (
        f"우선 연결 근거 {linked_items[0].id} '{linked_items[0].title}'"
        if linked_items
        else "수집 근거 부족"
    )
    incoming = ", ".join(_edge_text(edge) for edge in incoming_edges[:3])
    outgoing = ", ".join(_edge_text(edge) for edge in outgoing_edges[:3])
    if incoming:
        placement = f"이전 조건({incoming})을 지나 '{node_label}' 단계에 둡니다"
    else:
        placement = f"'{node_label}'은 시작부 검증 또는 분기 선택 단계로 둡니다"
    if outgoing:
        next_rule = f"다음 전환/진행 조건은 {outgoing}입니다"
    else:
        next_rule = "다음 단계는 실행 기록을 받은 뒤 새 리비전에서 정합니다"
    return _clip(
        f"{placement}. {source_hint}와 사용자 상태({user_basis})를 함께 보아 "
        f"부담이 낮은 검증에서 더 큰 진행으로 넘어가도록 순서를 잡았습니다. {next_rule}.",
        720,
    )


def attach_curriculum_trace(
    *,
    bundle: GraphBundle,
    grounding_packet: GroundingPacket,
    profile: Profile | None,
    current_state: CurrentStateSnapshot | None,
) -> GraphBundle:
    evidence_by_id = {item.id: item for item in grounding_packet.evidence_items}
    evidence_order = {item.id: index for index, item in enumerate(grounding_packet.evidence_items)}
    node_type_text = semantic_text_for_node_types(bundle)
    progression_type_ids = {
        edge_type.id for edge_type in bundle.ontology.edge_types if edge_type.role == "progression"
    }
    incoming_edges_by_node: dict[str, list[GraphEdgeRecord]] = defaultdict(list)
    outgoing_edges_by_node: dict[str, list[GraphEdgeRecord]] = defaultdict(list)
    for edge in bundle.edges:
        if edge.type not in progression_type_ids:
            continue
        incoming_edges_by_node[edge.target].append(edge)
        outgoing_edges_by_node[edge.source].append(edge)

    user_basis = _user_state_basis(profile=profile, current_state=current_state)
    changed = False
    next_nodes = []
    for node in bundle.nodes:
        if not node_requires_evidence(
            bundle=bundle,
            node_index=node_type_text,
            node_id=node.id,
        ):
            next_nodes.append(node)
            continue

        linked_items = sorted(
            (
                evidence_by_id[item_id]
                for item_id in node.evidence_refs
                if item_id in evidence_by_id
            ),
            key=lambda item: evidence_order[item.id],
        )
        data = dict(node.data)
        if not _clean_text(data.get("source_ranking_basis")):
            data["source_ranking_basis"] = _source_ranking_basis(linked_items)
        if not _clean_text(data.get("user_state_basis")):
            data["user_state_basis"] = user_basis
        if not _clean_text(data.get("curriculum_order_basis")):
            data["curriculum_order_basis"] = _curriculum_order_basis(
                node_label=node.label,
                linked_items=linked_items,
                user_basis=user_basis,
                incoming_edges=incoming_edges_by_node.get(node.id, []),
                outgoing_edges=outgoing_edges_by_node.get(node.id, []),
            )
        if data != node.data:
            changed = True
            next_nodes.append(node.model_copy(update={"data": data}))
        else:
            next_nodes.append(node)

    if not changed:
        return bundle
    return bundle.model_copy(update={"nodes": next_nodes})


def serialize_curriculum_trace_fields(node_data: dict[str, Any]) -> str:
    return json.dumps(
        {key: node_data.get(key) for key in TRACE_DATA_KEYS if _clean_text(node_data.get(key))},
        ensure_ascii=False,
        sort_keys=True,
    )
