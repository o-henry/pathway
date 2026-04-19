from __future__ import annotations

import json
from dataclasses import dataclass

from lifemap_api.application.sources import search_sources
from lifemap_api.domain.graph_bundle import EvidenceItem, GraphBundle
from lifemap_api.domain.models import Goal, Profile, SourceSearchHit
from lifemap_api.domain.ports import EmbeddingProvider, SourceSearchIndex


@dataclass(frozen=True)
class RetrievalQuery:
    label: str
    text: str


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


def plan_retrieval_queries(
    *,
    goal: Goal,
    profile: Profile | None,
    limit: int,
) -> tuple[RetrievalQuery, ...]:
    profile_context = _profile_fragments(profile)
    candidates = [
        (
            "goal_core",
            [
                goal.title,
                goal.success_criteria,
            ],
        ),
        (
            "goal_context",
            [
                goal.title,
                goal.description,
                goal.category if goal.category != "general" else "",
            ],
        ),
        (
            "goal_profile_fit",
            [
                goal.title,
                goal.success_criteria,
                *profile_context[:3],
            ],
        ),
        (
            "goal_constraints",
            [
                goal.description,
                goal.success_criteria,
                *profile_context[3:],
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

    return tuple(queries)


def _aggregate_hits(
    *,
    queries: tuple[RetrievalQuery, ...],
    hits_per_query: int,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
) -> list[SourceSearchHit]:
    scored_hits: dict[str, tuple[float, SourceSearchHit]] = {}

    for query_index, query in enumerate(queries):
        hits = search_sources(
            query=query.text,
            limit=hits_per_query,
            embedding_provider=embedding_provider,
            search_index=search_index,
        )
        for hit_index, hit in enumerate(hits):
            score = hit.similarity_score - (query_index * 0.015) - (hit_index * 0.01)
            existing = scored_hits.get(hit.chunk_id)
            if existing is None or score > existing[0]:
                scored_hits[hit.chunk_id] = (score, hit)

    ranked_hits = sorted(
        scored_hits.values(),
        key=lambda entry: (
            -entry[0],
            entry[1].title.casefold(),
            entry[1].chunk_id,
        ),
    )
    return [hit for _, hit in ranked_hits]


def build_grounding_packet(
    *,
    goal: Goal,
    profile: Profile | None,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    query_limit: int,
    hits_per_query: int,
    evidence_limit: int,
) -> GroundingPacket:
    queries = plan_retrieval_queries(goal=goal, profile=profile, limit=query_limit)
    hits = _aggregate_hits(
        queries=queries,
        hits_per_query=hits_per_query,
        embedding_provider=embedding_provider,
        search_index=search_index,
    )

    evidence_items = tuple(
        EvidenceItem(
            id=f"ev_rag_{index:03d}",
            source_id=hit.source_id,
            title=hit.title,
            quote_or_summary=hit.snippet,
            url=hit.url,
            reliability=hit.reliability,
        )
        for index, hit in enumerate(hits[:evidence_limit], start=1)
    )

    warnings: list[str] = []
    if not evidence_items:
        warnings.append(
            "No source evidence matched this goal yet; the map should lean on explicit assumptions."
        )

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
