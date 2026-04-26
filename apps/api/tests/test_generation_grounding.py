from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

from lifemap_api.application.generation_grounding import (
    build_grounding_packet,
    plan_retrieval_queries,
)
from lifemap_api.domain.models import (
    CurrentStateSnapshot,
    Goal,
    Profile,
    SourceSearchHit,
)

from .fake_embeddings import FakeEmbeddingProvider


class StaticSearchIndex:
    def __init__(self, hits: Sequence[SourceSearchHit]) -> None:
        self._hits = list(hits)

    def search(self, *, query_embedding: list[float], limit: int) -> list[SourceSearchHit]:
        del query_embedding
        return list(self._hits[:limit])


def _goal() -> Goal:
    now = datetime.now(UTC)
    return Goal(
        id="goal_japanese",
        profile_id="default",
        title="일본어를 원어민과 대화할 수준까지 학습",
        description="실전 회화와 복구 능력을 함께 키우고 싶다.",
        category="language",
        success_criteria="원어민과 30분 동안 막혀도 일본어로 복구하며 대화를 이어간다.",
        status="active",
        created_at=now,
        updated_at=now,
    )


def _profile() -> Profile:
    now = datetime.now(UTC)
    return Profile(
        id="default",
        display_name="Henry",
        weekly_free_hours=5,
        monthly_budget_amount=80000,
        monthly_budget_currency="KRW",
        energy_level="medium",
        preference_tags=["solo", "easily_bored"],
        constraints={"schedule": "weeknights"},
        created_at=now,
        updated_at=now,
    )


def _current_state() -> CurrentStateSnapshot:
    now = datetime.now(UTC)
    return CurrentStateSnapshot(
        id="state_1",
        goal_id="goal_japanese",
        interview_answers={},
        resource_values={"weekly_hours": 5, "money": "tight"},
        active_constraints=["야근 때문에 주 3회 이상 긴 학습이 어렵다."],
        state_summary="지금은 출퇴근 시간 짧은 복습은 가능하지만 긴 회화 세션은 자주 어렵다.",
        derived_from_update_ids=[],
        created_at=now,
        updated_at=now,
    )


def _hit(
    *,
    chunk_id: str,
    source_id: str,
    title: str,
    snippet: str,
    similarity: float,
    layer: str,
) -> SourceSearchHit:
    return SourceSearchHit(
        chunk_id=chunk_id,
        source_id=source_id,
        title=title,
        url=None,
        snippet=snippet,
        similarity_score=similarity,
        reliability=layer,
        source_type=(
            "manual_note"
            if layer in {"lived_experience", "personal_story"}
            else "public_url_allowed"
        ),
        metadata={"layer": layer},
        source_created_at=datetime.now(UTC),
    )


def test_plan_retrieval_queries_expands_into_experience_and_switching_families() -> None:
    queries = plan_retrieval_queries(
        goal=_goal(),
        profile=_profile(),
        current_state=_current_state(),
        limit=6,
        extra_query_texts=(),
    )

    labels = [query.label for query in queries]

    assert "goal_core" in labels
    assert "route_patterns" in labels
    assert "lived_experience" in labels
    assert "failure_modes" in labels
    assert "switching_conditions" in labels


def test_plan_retrieval_queries_reserves_slots_for_analysis_queries() -> None:
    queries = plan_retrieval_queries(
        goal=_goal(),
        profile=_profile(),
        current_state=_current_state(),
        limit=6,
        extra_query_texts=(
            "language exchange route failure stories",
            "one on one tutor conversation cost comparison",
            "language learner diary switching from self study",
        ),
    )

    labels = [query.label for query in queries]
    texts = [query.text for query in queries]

    assert len(queries) == 6
    assert "goal_core" in labels
    assert "route_patterns" in labels
    assert "analysis_1" in labels
    assert "analysis_2" in labels
    assert any("language exchange route failure stories" in text for text in texts)
    assert any("one on one tutor conversation cost comparison" in text for text in texts)


def test_build_grounding_packet_prefers_diverse_evidence_layers() -> None:
    search_index = StaticSearchIndex(
        [
            _hit(
                chunk_id="official_1",
                source_id="src_official",
                title="JLPT speaking guidance",
                snippet="공식 학습 가이드는 단계별 speaking loop를 권장한다.",
                similarity=0.96,
                layer="official",
            ),
            _hit(
                chunk_id="official_2",
                source_id="src_official",
                title="Conversation rubric",
                snippet="공식 평가 기준은 복구 능력과 지속 대화를 같이 본다.",
                similarity=0.95,
                layer="official",
            ),
            _hit(
                chunk_id="lived_1",
                source_id="src_lived",
                title="원어민 대화 후기",
                snippet="주 5시간 학습자는 짧은 회화 루프가 없으면 실제 대화에서 얼어붙기 쉽다.",
                similarity=0.89,
                layer="lived_experience",
            ),
            _hit(
                chunk_id="story_1",
                source_id="src_story",
                title="개인 시행착오 기록",
                snippet="문법만 오래 붙잡으면 말문이 막혀서 중간에 루트를 바꿨다.",
                similarity=0.87,
                layer="personal_story",
            ),
            _hit(
                chunk_id="research_1",
                source_id="src_research",
                title="피드백 루프 연구",
                snippet="교정 피드백이 있을 때 오류 고착이 줄어든다.",
                similarity=0.9,
                layer="research",
            ),
        ]
    )

    packet = build_grounding_packet(
        goal=_goal(),
        profile=_profile(),
        current_state=_current_state(),
        embedding_provider=FakeEmbeddingProvider(),
        search_index=search_index,
        query_limit=6,
        hits_per_query=5,
        evidence_limit=4,
        extra_query_texts=(),
    )

    titles = {item.title for item in packet.evidence_items}

    assert "JLPT speaking guidance" in titles
    assert "원어민 대화 후기" in titles
    assert "개인 시행착오 기록" in titles or "피드백 루프 연구" in titles
    assert len(packet.evidence_items) == 4
    assert all(item.id.startswith("ev_rag_") for item in packet.evidence_items)
    assert not any(
        "does not yet include lived-experience" in warning for warning in packet.warnings
    )
