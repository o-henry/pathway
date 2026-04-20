from __future__ import annotations

from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.domain.models import Goal, GoalAnalysis, ResourceDimension
from lifemap_api.domain.ports import GoalAnalysisRepository, GoalRepository


BASE_DIMENSIONS = {
    "time": ResourceDimension(
        id="time_budget",
        label="Time budget",
        kind="time",
        value_type="hours_per_week",
        question="이 goal에 꾸준히 쓸 수 있는 현실적인 주간 시간은 어느 정도인가요?",
        relevance_reason="속도와 루트 유지 가능성을 판단하려면 실제 시간 예산이 필요합니다.",
    ),
    "money": ResourceDimension(
        id="money_budget",
        label="Money budget",
        kind="money",
        value_type="currency_per_month",
        question="이 goal에 매달 투입 가능한 예산은 어느 정도인가요?",
        relevance_reason="강의, 장비, 이동, 도구 선택지의 분기를 가르는 핵심 자원입니다.",
    ),
    "energy": ResourceDimension(
        id="energy_pattern",
        label="Energy pattern",
        kind="energy",
        value_type="qualitative",
        question="하루나 일주일 기준으로 집중력이 살아있는 시간대와 쉽게 무너지는 시간대가 언제인가요?",
        relevance_reason="좋은 계획도 에너지 패턴과 어긋나면 실제 경로로 유지되지 않습니다.",
    ),
    "motivation": ResourceDimension(
        id="motivation_pattern",
        label="Motivation pattern",
        kind="motivation",
        value_type="qualitative",
        question="이 goal을 밀어붙이게 하는 이유와 쉽게 흔들리는 지점은 무엇인가요?",
        relevance_reason="지속성 리스크와 fallback 설계를 위해 동기 패턴을 알아야 합니다.",
    ),
    "practice": ResourceDimension(
        id="practice_environment",
        label="Practice environment",
        kind="practice",
        value_type="qualitative",
        question="이 goal을 실제로 연습하거나 실행할 수 있는 환경이 지금 있나요?",
        relevance_reason="실행 환경이 있어야 계획이 실제 route로 연결됩니다.",
    ),
    "skill": ResourceDimension(
        id="starting_skill",
        label="Starting skill",
        kind="skill",
        value_type="qualitative",
        question="지금 이 goal과 관련해 이미 할 줄 아는 것과 완전히 비어 있는 부분은 무엇인가요?",
        relevance_reason="출발점에 따라 초기 trunk와 checkpoint가 달라집니다.",
    ),
    "support": ResourceDimension(
        id="support_network",
        label="Support network",
        kind="support",
        value_type="qualitative",
        question="도움을 주거나 피드백을 줄 사람, 커뮤니티, 파트너가 있나요?",
        relevance_reason="혼자 갈 수 있는 route와 도움을 전제로 하는 route가 다릅니다.",
    ),
}


CATEGORY_DIMENSIONS = {
    "language": ["time", "money", "energy", "motivation", "practice", "skill", "support"],
    "career": ["time", "money", "energy", "motivation", "skill", "support"],
    "fitness": ["time", "money", "energy", "motivation", "practice", "support"],
    "relocation": ["time", "money", "energy", "support"],
    "general": ["time", "money", "energy", "motivation", "skill"],
}


def _build_summary(goal: Goal, dimension_keys: list[str]) -> str:
    labels = [BASE_DIMENSIONS[key].label.lower() for key in dimension_keys]
    focus = ", ".join(labels[:4])
    return (
        f'"{goal.title}" pathway는 {focus} 축이 실제 경로를 크게 좌우합니다. '
        "초기 인터뷰에서 이 자원을 먼저 고정해야 이후 연구와 revision이 현실을 반영할 수 있습니다."
    )


def _build_research_questions(goal: Goal, dimension_keys: list[str]) -> list[str]:
    questions = [
        f'What route structures usually work for the goal "{goal.title}" under constrained {BASE_DIMENSIONS[key].label.lower()}?'
        for key in dimension_keys[:3]
    ]
    questions.append(
        f'What common failure patterns, fallback routes, and switching conditions appear for "{goal.title}"?'
    )
    return questions


def analyze_goal(
    *,
    goal_id: str,
    goal_repo: GoalRepository,
    analysis_repo: GoalAnalysisRepository,
) -> GoalAnalysis:
    goal = goal_repo.get(goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", goal_id)

    existing = analysis_repo.get(goal_id)
    if existing is not None:
        return existing

    dimension_keys = CATEGORY_DIMENSIONS.get(goal.category, CATEGORY_DIMENSIONS["general"])
    analysis = GoalAnalysis(
        goal_id=goal.id,
        analysis_summary=_build_summary(goal, dimension_keys),
        resource_dimensions=[BASE_DIMENSIONS[key] for key in dimension_keys],
        research_questions=_build_research_questions(goal, dimension_keys),
    )
    return analysis_repo.upsert(analysis)
