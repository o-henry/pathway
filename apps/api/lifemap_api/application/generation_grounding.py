from __future__ import annotations

import json
from dataclasses import dataclass

from lifemap_api.application.sources import search_sources
from lifemap_api.domain.graph_bundle import EvidenceItem, GraphBundle
from lifemap_api.domain.models import CurrentStateSnapshot, Goal, Profile, SourceSearchHit
from lifemap_api.domain.ports import EmbeddingProvider, SourceSearchIndex


@dataclass(frozen=True)
class RetrievalQuery:
    label: str
    text: str


@dataclass(frozen=True)
class RankedGroundingHit:
    score: float
    query_labels: tuple[str, ...]
    hit: SourceSearchHit


@dataclass(frozen=True)
class GroundingPacket:
    queries: tuple[RetrievalQuery, ...]
    evidence_items: tuple[EvidenceItem, ...]
    warnings: tuple[str, ...]


def _clean_fragment(value: object | None) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split()).strip()


def _profile_fragments(profile: Profile | None) -> list[str]:
    if profile is None:
        return []

    fragments: list[str] = []

    if profile.weekly_free_hours is not None:
        fragments.append(f"주당 가능 시간 {profile.weekly_free_hours}시간")
    if profile.monthly_budget_amount is not None:
        currency = profile.monthly_budget_currency or ""
        fragments.append(
            f"월 예산 {profile.monthly_budget_amount:g} {currency}".strip()
        )
    if profile.energy_level:
        fragments.append(f"에너지 수준 {profile.energy_level}")
    if profile.preference_tags:
        fragments.append("선호 태그 " + ", ".join(profile.preference_tags[:6]))
    if profile.constraints:
        compact_constraints = ", ".join(
            f"{key}: {_clean_fragment(value)}"
            for key, value in list(profile.constraints.items())[:6]
            if _clean_fragment(value)
        )
        if compact_constraints:
            fragments.append("제약 " + compact_constraints)

    return fragments


def _current_state_fragments(current_state: CurrentStateSnapshot | None) -> list[str]:
    if current_state is None:
        return []

    fragments: list[str] = []
    if current_state.state_summary:
        fragments.append(current_state.state_summary)
    if current_state.active_constraints:
        fragments.append("현재 제약 " + ", ".join(current_state.active_constraints[:5]))
    if current_state.resource_values:
        compact_resource_values = ", ".join(
            f"{key}: {_clean_fragment(value)}"
            for key, value in list(current_state.resource_values.items())[:5]
            if _clean_fragment(value)
        )
        if compact_resource_values:
            fragments.append("현재 자원 상태 " + compact_resource_values)

    return fragments


def _goal_focus_fragments(goal: Goal) -> list[str]:
    lowered = " ".join(
        [goal.title, goal.description, goal.category, goal.success_criteria]
    ).lower()
    if goal.category == "language" or any(
        token in lowered
        for token in ["일본어", "영어", "회화", "원어민", "fluency", "conversation", "speaking"]
    ):
        return [
            "실제 대화 루프",
            "원어민 노출",
            "교정 피드백",
            "말문 막힘 복구",
        ]
    if goal.category == "career":
        return [
            "직접 지원 루트",
            "포트폴리오 보강",
            "면접 대응",
            "전환 비용",
        ]
    if goal.category == "fitness":
        return [
            "부상 리스크",
            "주간 루틴 유지",
            "회복 패턴",
            "강도 조절",
        ]
    return [
        "핵심 루트 구조",
        "막히는 지점",
        "우회 경로",
        "전환 조건",
    ]


def plan_retrieval_queries(
    *,
    goal: Goal,
    profile: Profile | None,
    current_state: CurrentStateSnapshot | None,
    limit: int,
    extra_query_texts: tuple[str, ...] = (),
) -> tuple[RetrievalQuery, ...]:
    profile_context = _profile_fragments(profile)
    state_context = _current_state_fragments(current_state)
    focus_context = _goal_focus_fragments(goal)
    candidates = [
        (
            "goal_core",
            [
                goal.title,
                goal.success_criteria,
            ],
        ),
        (
            "route_patterns",
            [
                goal.title,
                goal.description,
                goal.success_criteria,
                "어떤 route structures와 practice systems가 실제로 작동하는가",
                *focus_context[:2],
            ],
        ),
        (
            "lived_experience",
            [
                goal.title,
                goal.success_criteria,
                "경험담 개인 사례 what worked what failed",
                *focus_context[1:3],
            ],
        ),
        (
            "failure_modes",
            [
                goal.title,
                goal.success_criteria,
                "common failure patterns blockers drop off mistakes",
                *state_context[:2],
                *profile_context[:2],
            ],
        ),
        (
            "switching_conditions",
            [
                goal.title,
                "fallback routes switching conditions tradeoffs",
                *profile_context[:3],
                *state_context[:3],
                *focus_context[2:4],
            ],
        ),
        (
            "goal_profile_fit",
            [
                goal.title,
                goal.success_criteria,
                *profile_context[:4],
            ],
        ),
        (
            "goal_constraints",
            [
                goal.description,
                goal.success_criteria,
                *state_context[:4],
                *profile_context[3:],
            ],
        ),
        (
            "alternative_routes",
            [
                goal.title,
                goal.description,
                "alternative routes opportunity cost adjacent strategies",
                *focus_context[:3],
            ],
        ),
    ]

    queries: list[RetrievalQuery] = []
    seen_texts: set[str] = set()

    for label, fragments in candidates:
        cleaned = [_clean_fragment(fragment) for fragment in fragments]
        compact = " | ".join(fragment for fragment in cleaned if fragment)
        if not compact or compact in seen_texts:
            continue
        seen_texts.add(compact)
        queries.append(RetrievalQuery(label=label, text=compact))
        if len(queries) >= limit:
            break

    for index, extra_query in enumerate(extra_query_texts, start=1):
        compact = _clean_fragment(extra_query)
        if not compact or compact in seen_texts:
            continue
        seen_texts.add(compact)
        queries.append(RetrievalQuery(label=f"analysis_{index}", text=compact))
        if len(queries) >= limit:
            break

    return tuple(queries)


def _query_label_bonus(query_label: str) -> float:
    weights = {
        "lived_experience": 0.06,
        "failure_modes": 0.05,
        "switching_conditions": 0.05,
        "alternative_routes": 0.04,
        "route_patterns": 0.03,
    }
    return weights.get(query_label, 0.0)


def _aggregate_hits(
    *,
    queries: tuple[RetrievalQuery, ...],
    hits_per_query: int,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
) -> list[RankedGroundingHit]:
    scored_hits: dict[str, tuple[float, SourceSearchHit, set[str]]] = {}

    for query_index, query in enumerate(queries):
        hits = search_sources(
            query=query.text,
            limit=hits_per_query,
            embedding_provider=embedding_provider,
            search_index=search_index,
        )
        for hit_index, hit in enumerate(hits):
            score = (
                hit.similarity_score
                + _query_label_bonus(query.label)
                - (query_index * 0.015)
                - (hit_index * 0.01)
            )
            existing = scored_hits.get(hit.chunk_id)
            if existing is None:
                scored_hits[hit.chunk_id] = (score, hit, {query.label})
                continue
            if score > existing[0]:
                labels = set(existing[2])
                labels.add(query.label)
                scored_hits[hit.chunk_id] = (score, hit, labels)
                continue
            existing[2].add(query.label)

    ranked_hits = sorted(
        scored_hits.values(),
        key=lambda entry: (
            -entry[0],
            entry[1].title.casefold(),
            entry[1].chunk_id,
        ),
    )
    return [
        RankedGroundingHit(
            score=score,
            query_labels=tuple(sorted(labels)),
            hit=hit,
        )
        for score, hit, labels in ranked_hits
    ]


def _layer_key(hit: SourceSearchHit) -> str:
    layer = str(hit.metadata.get("layer", "")).strip().lower()
    if layer:
        return layer
    if hit.source_type == "manual_note":
        return "manual_note"
    return str(hit.source_type).strip().lower() or "unknown"


def _layer_priority(layer: str) -> int:
    order = {
        "official": 0,
        "research": 1,
        "expert-interpretation": 2,
        "lived_experience": 3,
        "personal_story": 4,
        "manual_note": 5,
        "public_url_allowed": 6,
        "public_url_metadata": 7,
        "unknown": 8,
    }
    return order.get(layer, 50)


def _layer_best_score(layer: str, ranked_hits: list[RankedGroundingHit]) -> float:
    for candidate in ranked_hits:
        if _layer_key(candidate.hit) == layer:
            return candidate.score
    return 0.0


def _select_diverse_hits(
    *,
    ranked_hits: list[RankedGroundingHit],
    limit: int,
) -> list[RankedGroundingHit]:
    if limit <= 0 or not ranked_hits:
        return []

    selected: list[RankedGroundingHit] = []
    selected_chunk_ids: set[str] = set()
    selected_source_counts: dict[str, int] = {}
    represented_layers: set[str] = set()
    represented_query_labels: set[str] = set()

    layer_order = sorted(
        {_layer_key(candidate.hit) for candidate in ranked_hits},
        key=lambda layer: (-_layer_best_score(layer, ranked_hits), _layer_priority(layer), layer),
    )

    for layer in layer_order:
        candidate = next(
            (
                item
                for item in ranked_hits
                if _layer_key(item.hit) == layer
                and item.hit.chunk_id not in selected_chunk_ids
                and selected_source_counts.get(item.hit.source_id, 0) == 0
            ),
            None,
        )
        if candidate is None:
            continue
        selected.append(candidate)
        selected_chunk_ids.add(candidate.hit.chunk_id)
        selected_source_counts[candidate.hit.source_id] = 1
        represented_layers.add(layer)
        represented_query_labels.update(candidate.query_labels)
        if len(selected) >= limit:
            return selected

    remaining = [item for item in ranked_hits if item.hit.chunk_id not in selected_chunk_ids]

    def remaining_score(item: RankedGroundingHit) -> tuple[float, float, float, str, str]:
        layer = _layer_key(item.hit)
        new_query_bonus = (
            0.04
            if any(label not in represented_query_labels for label in item.query_labels)
            else 0.0
        )
        new_layer_bonus = 0.03 if layer not in represented_layers else 0.0
        source_penalty = 0.05 * selected_source_counts.get(item.hit.source_id, 0)
        blended = item.score + new_query_bonus + new_layer_bonus - source_penalty
        return (
            blended,
            new_query_bonus,
            new_layer_bonus,
            item.hit.title.casefold(),
            item.hit.chunk_id,
        )

    for candidate in sorted(remaining, key=remaining_score, reverse=True):
        if len(selected) >= limit:
            break
        if selected_source_counts.get(candidate.hit.source_id, 0) >= 2:
            continue
        selected.append(candidate)
        selected_chunk_ids.add(candidate.hit.chunk_id)
        selected_source_counts[candidate.hit.source_id] = (
            selected_source_counts.get(candidate.hit.source_id, 0) + 1
        )
        represented_layers.add(_layer_key(candidate.hit))
        represented_query_labels.update(candidate.query_labels)

    return selected


def _diversity_warning(selected_hits: list[RankedGroundingHit]) -> str | None:
    if not selected_hits:
        return None

    represented_layers = {_layer_key(item.hit) for item in selected_hits}
    if represented_layers == {"public_url_metadata"}:
        return (
            "Retrieved sources are metadata-only discovery candidates, not content-backed "
            "evidence. Use them only to mark review needs or candidate source availability."
        )
    if len(represented_layers) < 2:
        return (
            "Retrieved evidence is still narrow and may underrepresent alternative routes, "
            "failure modes, or lived experience."
        )
    if not represented_layers & {"lived_experience", "personal_story"}:
        return (
            "Retrieved evidence does not yet include lived-experience material, "
            "so the map may miss "
            "real-world friction and route-switching signals."
        )
    return None


def build_grounding_packet(
    *,
    goal: Goal,
    profile: Profile | None,
    current_state: CurrentStateSnapshot | None,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    query_limit: int,
    hits_per_query: int,
    evidence_limit: int,
    extra_query_texts: tuple[str, ...] = (),
) -> GroundingPacket:
    queries = plan_retrieval_queries(
        goal=goal,
        profile=profile,
        current_state=current_state,
        limit=query_limit,
        extra_query_texts=extra_query_texts,
    )
    ranked_hits = _aggregate_hits(
        queries=queries,
        hits_per_query=hits_per_query,
        embedding_provider=embedding_provider,
        search_index=search_index,
    )
    selected_hits = _select_diverse_hits(ranked_hits=ranked_hits, limit=evidence_limit)

    evidence_items = tuple(
        EvidenceItem(
            id=f"ev_rag_{index:03d}",
            source_id=hit.source_id,
            title=hit.title,
            quote_or_summary=hit.snippet,
            url=hit.url,
            reliability=hit.reliability,
        )
        for index, hit in enumerate((item.hit for item in selected_hits), start=1)
    )

    warnings: list[str] = []
    if not evidence_items:
        warnings.append(
            "No source evidence matched this goal yet; the map should lean on explicit assumptions."
        )
    diversity_warning = _diversity_warning(selected_hits)
    if diversity_warning:
        warnings.append(diversity_warning)

    return GroundingPacket(
        queries=queries,
        evidence_items=evidence_items,
        warnings=tuple(warnings),
    )


def serialize_grounding_packet(packet: GroundingPacket) -> str:
    if not packet.evidence_items:
        return (
            "Retrieved evidence packet: none available. Do not invent evidence. "
            "Use assumptions for unsupported claims."
        )

    payload = {
        "queries": [
            {
                "label": query.label,
                "text": query.text,
            }
            for query in packet.queries
        ],
        "evidence_items": [
            item.model_dump(mode="json")
            for item in packet.evidence_items
        ],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def validate_bundle_grounding(
    bundle: GraphBundle,
    grounding_packet: GroundingPacket,
) -> GraphBundle:
    allowed_by_id = {item.id: item for item in grounding_packet.evidence_items}
    bundle_evidence_ids = [item.id for item in bundle.evidence]
    invalid_ids = sorted(item_id for item_id in bundle_evidence_ids if item_id not in allowed_by_id)
    if invalid_ids:
        raise ValueError(
            "bundle includes evidence ids outside the retrieved evidence packet: "
            + ", ".join(invalid_ids)
        )

    referenced_ids: list[str] = []
    seen_references: set[str] = set()
    for node in bundle.nodes:
        for evidence_id in node.evidence_refs:
            if evidence_id in seen_references:
                continue
            seen_references.add(evidence_id)
            referenced_ids.append(evidence_id)

    if grounding_packet.evidence_items and not referenced_ids:
        raise ValueError(
            "bundle did not reference any retrieved evidence ids "
            "despite a non-empty evidence packet"
        )

    canonical_evidence = [
        allowed_by_id[evidence_id]
        for evidence_id in referenced_ids
        if evidence_id in allowed_by_id
    ]

    merged_warnings = list(dict.fromkeys([*bundle.warnings, *grounding_packet.warnings]))

    return bundle.model_copy(
        update={
            "evidence": canonical_evidence,
            "warnings": merged_warnings,
        }
    )
