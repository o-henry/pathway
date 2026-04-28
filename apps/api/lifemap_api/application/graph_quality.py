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
    "success_check",
    "record_after",
    "switch_condition",
    "fit_reason",
    "evidence_basis",
    "personalization_basis",
    "resource_plan",
    "session_cadence",
    "progression_rule",
)

OPTIONAL_ACTION_DATA_KEYS = (
    "practice_step",
    "next_action",
    "verification_step",
    "checkpoint",
    "assumption_basis",
)

ROUTE_EVIDENCE_ROLES = {
    "route",
    "route_choice",
    "fallback_route",
}

SUPPORT_EVIDENCE_ROLES = {
    "checkpoint",
    "constraint",
    "cost",
    "evidence",
    "milestone",
    "opportunity_cost",
    "practice",
    "resource",
    "risk",
    "switch_condition",
    "tradeoff",
}


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


def semantic_role_for_node_type(bundle: GraphBundle, node_type_id: str) -> str:
    node_type = next(
        (candidate for candidate in bundle.ontology.node_types if candidate.id == node_type_id),
        None,
    )
    return str(node_type.semantic_role or "").strip().casefold() if node_type else ""


def node_has_route_role(bundle: GraphBundle, node_id: str) -> bool:
    node = next((candidate for candidate in bundle.nodes if candidate.id == node_id), None)
    semantic_role = semantic_role_for_node_type(bundle, node.type) if node is not None else ""
    if semantic_role:
        return semantic_role in ROUTE_EVIDENCE_ROLES
    node_index = semantic_text_for_node_types(bundle)
    return node_matches_any_marker(
        bundle=bundle,
        node_index=node_index,
        node_id=node_id,
        markers=ROUTE_SEMANTIC_MARKERS,
    )


def node_has_support_role(bundle: GraphBundle, node_id: str) -> bool:
    node = next((candidate for candidate in bundle.nodes if candidate.id == node_id), None)
    semantic_role = semantic_role_for_node_type(bundle, node.type) if node is not None else ""
    if semantic_role:
        return semantic_role in SUPPORT_EVIDENCE_ROLES
    node_index = semantic_text_for_node_types(bundle)
    return node_matches_any_marker(
        bundle=bundle,
        node_index=node_index,
        node_id=node_id,
        markers=SUPPORT_SEMANTIC_MARKERS,
    )


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


def _clean_data_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return " ".join(value.split())
    if isinstance(value, (list, tuple)):
        return " ".join(_clean_data_text(item) for item in value).strip()
    if isinstance(value, dict):
        return " ".join(_clean_data_text(item) for item in value.values()).strip()
    return " ".join(str(value).split())


def missing_curriculum_action_keys(node) -> list[str]:
    data = node.data if isinstance(node.data, dict) else {}
    return [key for key in ACTION_DATA_KEYS if not _clean_data_text(data.get(key))]


def node_has_action_fields(node) -> bool:
    return not missing_curriculum_action_keys(node)


def node_requires_evidence(
    *,
    bundle: GraphBundle,
    node_index: dict[str, str],
    node_id: str,
) -> bool:
    node = next((candidate for candidate in bundle.nodes if candidate.id == node_id), None)
    semantic_role = semantic_role_for_node_type(bundle, node.type) if node is not None else ""
    if semantic_role:
        return semantic_role in ROUTE_EVIDENCE_ROLES or semantic_role in SUPPORT_EVIDENCE_ROLES
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
    node_ids = [node.id for node in bundle.nodes]
    route_like_node_ids = [
        node.id
        for node in bundle.nodes
        if node_has_route_role(bundle, node.id)
    ]
    support_node_ids = [
        node.id
        for node in bundle.nodes
        if node_has_support_role(bundle, node.id)
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


def semantic_role_errors(bundle: GraphBundle) -> list[str]:
    missing_type_ids = [
        node_type.id
        for node_type in bundle.ontology.node_types
        if not str(node_type.semantic_role or "").strip()
    ]
    if not missing_type_ids:
        return []
    preview = ", ".join(missing_type_ids[:8])
    suffix = "" if len(missing_type_ids) <= 8 else f", and {len(missing_type_ids) - 8} more"
    return [
        "ontology node types must include semantic_role for generated Pathway maps: "
        f"{preview}{suffix}"
    ]


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


def pathway_action_errors(bundle: GraphBundle) -> list[str]:
    node_type_text = semantic_text_for_node_types(bundle)
    missing_action_nodes = [
        node.label or node.id
        for node in bundle.nodes
        if node_requires_evidence(
            bundle=bundle,
            node_index=node_type_text,
            node_id=node.id,
        )
        and not node_has_action_fields(node)
    ]
    if not missing_action_nodes:
        return []
    preview = ", ".join(missing_action_nodes[:8])
    suffix = (
        ""
        if len(missing_action_nodes) <= 8
        else f", and {len(missing_action_nodes) - 8} more"
    )
    return [
        "decision graph has route/support nodes without complete personalized "
        "curriculum fields: "
        f"{preview}{suffix}. Fill node.data.user_step, how_to_do_it, "
        "success_check, record_after, switch_condition, fit_reason, "
        "evidence_basis, personalization_basis, resource_plan, session_cadence, "
        "and progression_rule with concrete instructions for the user."
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
        ):
            next_nodes.append(node)
            continue
        if node_has_action_fields(node):
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
        if not _clean_data_text(data.get("user_step")):
            data["user_step"] = (
                f"'{node.label}'을 오늘 20~30분짜리 한 세션으로 쪼개서 바로 실행한다."
            )
        if not _clean_data_text(data.get("how_to_do_it")):
            data["how_to_do_it"] = (
                f"1) 필요한 자료를 하나만 연다. 2) {clip_instruction_text(node.summary, 130)} "
                "3) 결과물을 작게 남긴다. 4) 막힌 지점을 다음 리비전 입력에 쓸 수 있게 적는다."
            )
        if not _clean_data_text(data.get("success_check")):
            data["success_check"] = (
                "세션 끝에 실제 산출물이나 시도 기록이 1개 이상 남고, 다음에 무엇을 바꿀지 "
                "한 문장으로 말할 수 있으면 통과로 본다."
            )
        if not _clean_data_text(data.get("record_after")):
            data["record_after"] = (
                "한 일, 사용한 자료, 걸린 시간, 막힌 점, 다음 조정을 각각 한 줄로 업데이트 입력창에 남긴다."
            )
        if not _clean_data_text(data.get("switch_condition")):
            data["switch_condition"] = (
                "같은 막힘이 2회 반복되거나 세션을 시작하지 못하면 이 노드를 약화하고 더 작은 루트로 전환한다."
            )
        if not _clean_data_text(data.get("fit_reason")):
            data["fit_reason"] = (
                f"이 노드는 '{node.label}'이 현재 목표에 직접 닿는지 작은 실행 데이터로 검증하기 위해 둔다."
            )
        if not _clean_data_text(data.get("evidence_basis")):
            data["evidence_basis"] = f"{linked_evidence.title}: {basis}"
        if not _clean_data_text(data.get("personalization_basis")):
            data["personalization_basis"] = (
                "현재 저장된 목표, 제약, 선호를 기준으로 부담을 작은 실행 단위로 낮춘 보수적 안내다."
            )
        if not _clean_data_text(data.get("resource_plan")):
            data["resource_plan"] = (
                f"우선 연결 근거 '{linked_evidence.title}'와 현재 노드 요약만 사용한다. "
                "추가 자료는 실행 후 부족한 지점을 알게 된 뒤 붙인다."
            )
        if not _clean_data_text(data.get("session_cadence")):
            data["session_cadence"] = (
                "첫 주에는 20~30분 세션 2회로 시작하고, 실제 부담이 낮으면 다음 주에 1회를 추가한다."
            )
        if not _clean_data_text(data.get("progression_rule")):
            data["progression_rule"] = (
                "2회 연속 성공하면 다음 체크포인트로 올리고, 2회 연속 실패하면 범위나 자료 난도를 낮춘다."
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


def enforce_semantic_roles(bundle: GraphBundle) -> GraphBundle:
    errors = semantic_role_errors(bundle)
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


def enforce_pathway_actions(bundle: GraphBundle) -> GraphBundle:
    errors = pathway_action_errors(bundle)
    if errors:
        raise ValueError("; ".join(errors))
    return bundle
