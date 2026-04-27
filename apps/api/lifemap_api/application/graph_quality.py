from __future__ import annotations

import json
import re

from lifemap_api.application.generation_grounding import GroundingPacket
from lifemap_api.domain.graph_bundle import GraphBundle

MIN_ROUTE_ATLAS_NODES = 12
MIN_ROUTE_ATLAS_EDGES = 10
MIN_ROUTE_ATLAS_OPTIONS = 5
MIN_ROUTE_ATLAS_SUPPORT_NODES = 4
MIN_ROUTE_ATLAS_BRANCHING_FACTOR = 3
SOURCE_CANDIDATE_RELIABILITY = "public_url_metadata"

ROUTE_SEMANTIC_MARKERS = (
    "route",
    "path",
    "option",
    "branch",
    "choice",
    "strategy",
    "fallback",
    "alternative",
    "track",
    "lane",
    "루트",
    "경로",
    "선택",
    "전략",
    "대안",
    "우회",
    "분기",
)

SUPPORT_SEMANTIC_MARKERS = (
    "risk",
    "checkpoint",
    "constraint",
    "cost",
    "evidence",
    "assumption",
    "switch",
    "failure",
    "milestone",
    "pressure",
    "tradeoff",
    "opportunity",
    "리스크",
    "위험",
    "체크",
    "제약",
    "비용",
    "근거",
    "가정",
    "전환",
    "실패",
    "마일스톤",
    "압력",
    "기회",
    "손실",
)

ACTION_DATA_KEYS = (
    "user_step",
    "how_to_do_it",
    "practice_step",
    "next_action",
    "success_check",
    "verification_step",
    "record_after",
    "checkpoint",
    "switch_condition",
)


def semantic_text_for_node_types(bundle: GraphBundle) -> dict[str, str]:
    return {
        node_type.id: " ".join(
            [
                node_type.id,
                node_type.label,
                node_type.description,
            ]
        ).casefold()
        for node_type in bundle.ontology.node_types
    }


def node_matches_any_marker(
    *,
    bundle: GraphBundle,
    node_index: dict[str, str],
    node_id: str,
    markers: tuple[str, ...],
) -> bool:
    node = next((candidate for candidate in bundle.nodes if candidate.id == node_id), None)
    if node is None:
        return False
    semantic_text = " ".join(
        [
            node.type,
            node.label,
            node.summary,
            node_index.get(node.type, ""),
        ]
    ).casefold()
    return any(marker in semantic_text for marker in markers)


def usable_evidence_ids(grounding_packet: GroundingPacket) -> set[str]:
    return {
        item.id
        for item in grounding_packet.evidence_items
        if item.reliability != SOURCE_CANDIDATE_RELIABILITY
    }


def tokenize_grounding_text(value: str) -> set[str]:
    return {
        token.casefold()
        for token in re.findall(r"[0-9A-Za-z가-힣]{2,}", value)
        if len(token) >= 2
    }


def best_evidence_id_for_node(
    *,
    node_text: str,
    evidence_items,
) -> str | None:
    node_tokens = tokenize_grounding_text(node_text)
    best_id: str | None = None
    best_score = -1
    for item in evidence_items:
        evidence_tokens = tokenize_grounding_text(
            " ".join([item.title, item.quote_or_summary, item.reliability])
        )
        overlap_score = len(node_tokens & evidence_tokens)
        if overlap_score > best_score:
            best_score = overlap_score
            best_id = item.id
    return best_id


def clip_instruction_text(value: str, limit: int = 170) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def node_has_action_fields(node) -> bool:
    data = node.data if isinstance(node.data, dict) else {}
    for key in ACTION_DATA_KEYS:
        value = data.get(key)
        if value is None:
            continue
        if isinstance(value, str) and value.strip():
            return True
        if isinstance(value, (list, tuple)) and any(str(item).strip() for item in value):
            return True
        if isinstance(value, dict) and any(str(item).strip() for item in value.values()):
            return True
    return False


def node_requires_evidence(
    *,
    bundle: GraphBundle,
    node_index: dict[str, str],
    node_id: str,
) -> bool:
    return node_matches_any_marker(
        bundle=bundle,
        node_index=node_index,
        node_id=node_id,
        markers=ROUTE_SEMANTIC_MARKERS,
    ) or node_matches_any_marker(
        bundle=bundle,
        node_index=node_index,
        node_id=node_id,
        markers=SUPPORT_SEMANTIC_MARKERS,
    )


def pathway_shape_errors(bundle: GraphBundle) -> list[str]:
    node_type_text = semantic_text_for_node_types(bundle)
    node_ids = [node.id for node in bundle.nodes]
    route_like_node_ids = [
        node.id
        for node in bundle.nodes
        if node_matches_any_marker(
            bundle=bundle,
            node_index=node_type_text,
            node_id=node.id,
            markers=ROUTE_SEMANTIC_MARKERS,
        )
    ]
    support_node_ids = [
        node.id
        for node in bundle.nodes
        if node_matches_any_marker(
            bundle=bundle,
            node_index=node_type_text,
            node_id=node.id,
            markers=SUPPORT_SEMANTIC_MARKERS,
        )
    ]
    progression_type_ids = {
        edge_type.id for edge_type in bundle.ontology.edge_types if edge_type.role == "progression"
    }
    progression_outdegree = dict.fromkeys(node_ids, 0)
    progression_edge_count = 0
    for edge in bundle.edges:
        if edge.type not in progression_type_ids:
            continue
        progression_edge_count += 1
        progression_outdegree[edge.source] = progression_outdegree.get(edge.source, 0) + 1

    errors: list[str] = []
    if len(bundle.nodes) < MIN_ROUTE_ATLAS_NODES:
        errors.append(
            f"route atlas is too sparse: has {len(bundle.nodes)} nodes, "
            f"needs at least {MIN_ROUTE_ATLAS_NODES}"
        )
    if len(bundle.edges) < MIN_ROUTE_ATLAS_EDGES:
        errors.append(
            f"route atlas has too few edges: has {len(bundle.edges)}, "
            f"needs at least {MIN_ROUTE_ATLAS_EDGES}"
        )
    if len(route_like_node_ids) < MIN_ROUTE_ATLAS_OPTIONS:
        errors.append(
            "route atlas needs more concrete route options: "
            f"found {len(route_like_node_ids)}, needs at least {MIN_ROUTE_ATLAS_OPTIONS}"
        )
    if len(support_node_ids) < MIN_ROUTE_ATLAS_SUPPORT_NODES:
        errors.append(
            "route atlas needs more decision-support nodes for risks, checkpoints, "
            "constraints, switches, or opportunity costs: "
            f"found {len(support_node_ids)}, needs at least {MIN_ROUTE_ATLAS_SUPPORT_NODES}"
        )
    if (
        progression_edge_count
        and max(progression_outdegree.values(), default=0) < MIN_ROUTE_ATLAS_BRANCHING_FACTOR
    ):
        errors.append(
            "route atlas needs a visible branching point with at least "
            f"{MIN_ROUTE_ATLAS_BRANCHING_FACTOR} progression branches"
        )
    return errors


def pathway_grounding_errors(
    bundle: GraphBundle,
    grounding_packet: GroundingPacket,
) -> list[str]:
    evidence_ids = usable_evidence_ids(grounding_packet)
    if not evidence_ids:
        return []

    node_type_text = semantic_text_for_node_types(bundle)
    ungrounded_nodes = [
        node.label or node.id
        for node in bundle.nodes
        if node_requires_evidence(
            bundle=bundle,
            node_index=node_type_text,
            node_id=node.id,
        )
        and not any(evidence_id in evidence_ids for evidence_id in node.evidence_refs)
    ]
    if not ungrounded_nodes:
        return []
    preview = ", ".join(ungrounded_nodes[:8])
    suffix = "" if len(ungrounded_nodes) <= 8 else f", and {len(ungrounded_nodes) - 8} more"
    return [
        "decision graph has route/support nodes without usable evidence_refs: "
        f"{preview}{suffix}. Attach retrieved non-metadata evidence to each "
        "user-facing route, checkpoint, risk, switch, and tradeoff node."
    ]


def attach_missing_decision_evidence(
    bundle: GraphBundle,
    grounding_packet: GroundingPacket,
) -> GraphBundle:
    usable_items = [
        item
        for item in grounding_packet.evidence_items
        if item.reliability != SOURCE_CANDIDATE_RELIABILITY
    ]
    if not usable_items:
        return bundle

    evidence_ids = {item.id for item in usable_items}
    node_type_text = semantic_text_for_node_types(bundle)
    changed = False
    next_nodes = []
    for node in bundle.nodes:
        if not node_requires_evidence(
            bundle=bundle,
            node_index=node_type_text,
            node_id=node.id,
        ) or any(evidence_id in evidence_ids for evidence_id in node.evidence_refs):
            next_nodes.append(node)
            continue
        node_text = " ".join(
            [
                node.type,
                node.label,
                node.summary,
                json.dumps(node.data, ensure_ascii=False, sort_keys=True),
                node_type_text.get(node.type, ""),
            ]
        )
        evidence_id = best_evidence_id_for_node(
            node_text=node_text,
            evidence_items=usable_items,
        )
        if evidence_id is None:
            next_nodes.append(node)
            continue
        changed = True
        next_nodes.append(
            node.model_copy(
                update={
                    "evidence_refs": list(dict.fromkeys([*node.evidence_refs, evidence_id])),
                }
            )
        )

    if not changed:
        return bundle
    return bundle.model_copy(update={"nodes": next_nodes})


def attach_missing_action_fields(
    bundle: GraphBundle,
    grounding_packet: GroundingPacket,
) -> GraphBundle:
    evidence_by_id = {
        item.id: item
        for item in grounding_packet.evidence_items
        if item.reliability != SOURCE_CANDIDATE_RELIABILITY
    }
    if not evidence_by_id:
        return bundle

    node_type_text = semantic_text_for_node_types(bundle)
    changed = False
    next_nodes = []
    for node in bundle.nodes:
        if not node_requires_evidence(
            bundle=bundle,
            node_index=node_type_text,
            node_id=node.id,
        ) or node_has_action_fields(node):
            next_nodes.append(node)
            continue

        linked_evidence = next(
            (
                evidence_by_id[evidence_id]
                for evidence_id in node.evidence_refs
                if evidence_id in evidence_by_id
            ),
            None,
        )
        if linked_evidence is None:
            next_nodes.append(node)
            continue

        basis = clip_instruction_text(linked_evidence.quote_or_summary)
        data = dict(node.data)
        data.update(
            {
                "user_step": (
                    f"'{node.label}'을 오늘 실행 가능한 한 세션으로 쪼개서 바로 시도한다."
                ),
                "how_to_do_it": (
                    f"연결 근거 '{linked_evidence.title}'의 핵심 신호를 기준으로 "
                    f"{clip_instruction_text(node.summary, 120)}"
                ),
                "success_check": "실제로 수행한 결과가 목표에 가까워졌는지 한 문장으로 판정한다.",
                "record_after": (
                    "한 일, 걸린 시간, 막힌 점, 다음에 바꿀 점을 "
                    "업데이트 입력창에 남긴다."
                ),
                "evidence_basis": basis,
            }
        )
        changed = True
        next_nodes.append(node.model_copy(update={"data": data}))

    if not changed:
        return bundle
    return bundle.model_copy(update={"nodes": next_nodes})


def enforce_pathway_shape(bundle: GraphBundle) -> GraphBundle:
    errors = pathway_shape_errors(bundle)
    if errors:
        raise ValueError("; ".join(errors))
    return bundle


def enforce_pathway_grounding(
    bundle: GraphBundle,
    grounding_packet: GroundingPacket,
) -> GraphBundle:
    errors = pathway_grounding_errors(bundle, grounding_packet)
    if errors:
        raise ValueError("; ".join(errors))
    return bundle
