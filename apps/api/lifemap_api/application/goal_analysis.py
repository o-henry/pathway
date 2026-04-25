from __future__ import annotations

import json
from textwrap import dedent

from pydantic import ValidationError

from lifemap_api.application.errors import (
    AppConfigurationError,
    EntityNotFoundError,
    ProviderInvocationError,
)
from lifemap_api.domain.models import (
    Goal,
    GoalAnalysis,
    IntakeQuestion,
    Profile,
    ResearchCollectionTarget,
    ResearchPlan,
)
from lifemap_api.domain.ports import GoalAnalysisRepository, GoalRepository, LLMProvider

SCHEMA_NAME = "pathway_goal_analysis"


def _serialize_goal(goal: Goal) -> str:
    return json.dumps(goal.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _serialize_profile(profile: Profile | None) -> str:
    if profile is None:
        return "No default profile exists yet. Ask compact questions instead of assuming resources."
    return json.dumps(profile.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _fallback_research_plan(goal: Goal) -> ResearchPlan:
    collection_targets = [
        ResearchCollectionTarget(
            id="lived_experience_paths",
            label="비슷한 조건의 실제 달성/실패 수기",
            layer="lived_experience",
            search_intent="비슷한 시간, 비용, 출발점에서 어떤 루트가 유지되거나 무너졌는지 찾는다.",
            example_queries=[
                f"{goal.title} 실제 후기 실패 성공 루틴",
                f"{goal.title} 직장인 독학 튜터 커뮤니티 경험담",
            ],
            preferred_collectors=["scrapling", "crawl4ai"],
            source_examples=["개인 블로그", "공개 커뮤니티 글", "공개 회고"],
            reason="그래프가 현실적인 마찰과 route 전환 조건을 포함하려면 수기가 필요합니다.",
            max_sources=4,
        ),
        ResearchCollectionTarget(
            id="formal_curricula",
            label="구조화된 커리큘럼과 비용 구조",
            layer="formal_program",
            search_intent=(
                "학원, 튜터, 코스, 공식 커리큘럼이 어떤 단계와 "
                "비용을 제시하는지 비교한다."
            ),
            example_queries=[
                f"{goal.title} 커리큘럼 단계 비용",
                f"{goal.title} course curriculum tutor program",
            ],
            preferred_collectors=["crawl4ai", "scrapling"],
            source_examples=["학원 커리큘럼", "튜터링 상품 설명", "공개 강의 계획"],
            reason="유료/무료 route의 비용과 checkpoint를 근거 있게 나눌 수 있습니다.",
            max_sources=4,
        ),
        ResearchCollectionTarget(
            id="open_learning_media",
            label="공개 학습 자료와 실천 루틴",
            layer="open_learning_media",
            search_intent="유튜브, 공개 문서, 튜토리얼에서 반복 가능한 연습 구조와 도구를 찾는다.",
            example_queries=[
                f"{goal.title} YouTube routine practice plan",
                f"{goal.title} 무료 자료 루틴 도구",
            ],
            preferred_collectors=["crawl4ai", "lightpanda_experimental"],
            source_examples=["유튜브 설명/자막", "공개 가이드", "오픈 학습 자료"],
            reason="사용자가 route를 선택했을 때 바로 쓸 수 있는 실행 재료가 필요합니다.",
            max_sources=5,
        ),
        ResearchCollectionTarget(
            id="failure_modes_and_switches",
            label="실패 지점과 전환 조건",
            layer="risk_and_switching",
            search_intent="어떤 상황에서 route를 약화, 축소, 우회, 재활성화해야 하는지 찾는다.",
            example_queries=[
                f"{goal.title} common mistakes plateau burnout",
                f"{goal.title} fallback route switching conditions",
            ],
            preferred_collectors=["scrapling", "crawl4ai"],
            source_examples=["실패 분석 글", "전문가 조언", "장기 후기"],
            reason="Pathway 그래프는 한 줄짜리 계획이 아니라 route switching map이어야 합니다.",
            max_sources=4,
        ),
    ]
    return ResearchPlan(
        summary=(
            "사용자 답변으로 제약을 고정한 뒤 수기, 커리큘럼, "
            "공개 학습 자료, 실패/전환 사례를 분리 수집합니다."
        ),
        collection_targets=collection_targets,
        verification_checks=[
            "수집 자료가 사용자와 비슷한 시간/비용/출발점 조건인지 확인한다.",
            "홍보성 커리큘럼과 실제 수기를 분리해 비교한다.",
            "근거 없는 일반 조언은 assumption으로만 graph에 넣는다.",
            "route마다 전환 조건과 실패 신호가 있는지 확인한다.",
        ],
        expected_graph_complexity="multi_route_with_switching_conditions",
    )


def _build_system_prompt() -> str:
    return dedent(
        """
        You are Pathway's goal analyst and research planner.

        Your job is not to predict the user's future.
        Convert a natural-language goal into:
        - the minimum follow-up questions needed before research
        - resource dimensions that matter for this specific goal
        - a research collection plan for scout agents and collectors

        Rules:
        - Return JSON only.
        - The JSON must satisfy the supplied schema.
        - Do not use a fixed topic taxonomy. Infer what matters from the goal text.
        - Ask only questions that change the route graph or research plan.
        - Prefer 4 to 8 follow-up questions.
        - Include lived experience, formal/structured options, open learning media,
          failure modes, and route-switching evidence when relevant.
        - Name collectors as preferences only; collectors are tools, not autonomous agents.
        - Do not suggest scraping private, logged-in, paywalled, captcha, or forbidden sources.
        """
    ).strip()


def _build_user_prompt(goal: Goal, profile: Profile | None, schema: dict) -> str:
    return dedent(
        f"""
        Analyze this Pathway goal.

        Goal:
        {_serialize_goal(goal)}

        Default profile:
        {_serialize_profile(profile)}

        JSON Schema:
        {json.dumps(schema, ensure_ascii=False, indent=2)}

        Output requirements:
        - `goal_id` must equal `{goal.id}`.
        - `resource_dimensions` and `followup_questions` should be aligned,
          but not necessarily one-to-one.
        - `research_plan.collection_targets` should explain what to collect and why.
        - `research_questions` should be concrete search/retrieval queries derived from the plan.
        - Prefer Korean user-facing copy when the goal is Korean or mixed Korean/English.
        """
    ).strip()


def _normalize_analysis(candidate: GoalAnalysis, goal: Goal) -> GoalAnalysis:
    followups = candidate.followup_questions or [
        IntakeQuestion(
            id=dimension.id,
            label=dimension.label,
            question=dimension.question,
            why_needed=dimension.relevance_reason,
            answer_type=dimension.value_type,
            required=True,
            maps_to=[dimension.id],
        )
        for dimension in candidate.resource_dimensions
    ]
    research_plan = candidate.research_plan or _fallback_research_plan(goal)
    research_questions = candidate.research_questions or [
        query
        for target in (research_plan.collection_targets if research_plan else [])
        for query in target.example_queries
    ]
    return candidate.model_copy(
        update={
            "goal_id": goal.id,
            "followup_questions": followups,
            "research_plan": research_plan,
            "research_questions": research_questions,
        }
    )


def _generate_analysis_with_provider(
    *,
    goal: Goal,
    profile: Profile | None,
    llm_provider: LLMProvider,
) -> GoalAnalysis:
    schema = GoalAnalysis.model_json_schema()
    raw_output = llm_provider.generate_structured_json(
        messages=[
            {"role": "system", "content": _build_system_prompt()},
            {"role": "user", "content": _build_user_prompt(goal, profile, schema)},
        ],
        json_schema=schema,
        schema_name=SCHEMA_NAME,
    )
    return _normalize_analysis(GoalAnalysis.model_validate_json(raw_output), goal)


def analyze_goal(
    *,
    goal_id: str,
    goal_repo: GoalRepository,
    analysis_repo: GoalAnalysisRepository,
    llm_provider: LLMProvider | None = None,
    profile: Profile | None = None,
    force_refresh: bool = False,
) -> GoalAnalysis:
    goal = goal_repo.get(goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", goal_id)

    existing = analysis_repo.get(goal_id)
    if existing is not None and not force_refresh:
        if existing.followup_questions and existing.research_plan:
            return existing

    if llm_provider is None or getattr(llm_provider, "is_deterministic_fallback", False):
        raise AppConfigurationError(
            "Goal intake analysis requires a real structured LLM provider. "
            "Set LIFEMAP_LLM_PROVIDER=openai and OPENAI_MODEL=gpt-5.5."
        )

    try:
        return analysis_repo.upsert(
            _generate_analysis_with_provider(
                goal=goal,
                profile=profile,
                llm_provider=llm_provider,
            )
        )
    except (ProviderInvocationError, ValidationError, ValueError) as exc:
        raise ProviderInvocationError(
            "Goal intake analysis failed before producing schema-valid follow-up questions."
        ) from exc
