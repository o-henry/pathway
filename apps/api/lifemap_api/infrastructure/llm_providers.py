from __future__ import annotations

from collections.abc import Sequence
import json
import re
from typing import Any

import httpx

from lifemap_api.application.errors import AppConfigurationError, ProviderInvocationError
from lifemap_api.config import Settings


def _build_structured_output_payload(
    schema_name: str, json_schema: dict[str, Any]
) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "name": schema_name,
        "strict": True,
        "schema": json_schema,
    }


class OllamaProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def generate_structured_json(
        self,
        *,
        messages: Sequence[dict[str, str]],
        json_schema: dict[str, Any],
        schema_name: str,
    ) -> str:
        payload = {
            "model": self._settings.ollama_llm_model,
            "messages": list(messages),
            "stream": False,
            "format": json_schema,
            "options": {"temperature": 0},
        }

        try:
            with httpx.Client(
                base_url=self._settings.ollama_base_url,
                timeout=self._settings.llm_request_timeout_seconds,
            ) as client:
                response = client.post("/api/chat", json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderInvocationError(f"Ollama request failed: {exc}") from exc

        body = response.json()
        message = body.get("message")
        if not isinstance(message, dict):
            raise ProviderInvocationError("Ollama response did not include a message object")

        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise ProviderInvocationError("Ollama response content was empty")

        return content


class OpenAIProvider:
    def __init__(self, settings: Settings) -> None:
        if not settings.openai_api_key:
            raise AppConfigurationError(
                "OPENAI_API_KEY is required when LIFEMAP_LLM_PROVIDER=openai"
            )
        if not settings.openai_model:
            raise AppConfigurationError(
                "OPENAI_MODEL is required when LIFEMAP_LLM_PROVIDER=openai"
            )

        self._settings = settings

    def generate_structured_json(
        self,
        *,
        messages: Sequence[dict[str, str]],
        json_schema: dict[str, Any],
        schema_name: str,
    ) -> str:
        payload = {
            "model": self._settings.openai_model,
            "input": list(messages),
            "text": {"format": _build_structured_output_payload(schema_name, json_schema)},
        }
        headers = {
            "Authorization": f"Bearer {self._settings.openai_api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(
                base_url=self._settings.openai_base_url,
                timeout=self._settings.llm_request_timeout_seconds,
                headers=headers,
            ) as client:
                response = client.post("/responses", json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderInvocationError(f"OpenAI Responses request failed: {exc}") from exc

        body = response.json()
        output_items = body.get("output")
        if not isinstance(output_items, list):
            raise ProviderInvocationError("OpenAI response did not include an output array")

        refusal_messages: list[str] = []
        output_texts: list[str] = []

        for output in output_items:
            if not isinstance(output, dict) or output.get("type") != "message":
                continue

            content_items = output.get("content", [])
            if not isinstance(content_items, list):
                continue

            for item in content_items:
                if not isinstance(item, dict):
                    continue
                item_type = item.get("type")
                if item_type == "refusal":
                    refusal_text = item.get("refusal")
                    if isinstance(refusal_text, str) and refusal_text.strip():
                        refusal_messages.append(refusal_text)
                if item_type == "output_text":
                    text = item.get("text")
                    if isinstance(text, str) and text.strip():
                        output_texts.append(text)

        if refusal_messages:
            raise ProviderInvocationError(
                f"OpenAI model refused the request: {refusal_messages[0]}"
            )

        if not output_texts:
            raise ProviderInvocationError("OpenAI response did not include structured text output")

        return "\n".join(output_texts)


def _extract_json_block(content: str, start_marker: str, end_marker: str | None = None) -> dict[str, Any] | None:
    if start_marker not in content:
        return None

    segment = content.split(start_marker, 1)[1]
    if end_marker and end_marker in segment:
        segment = segment.split(end_marker, 1)[0]
    segment = segment.strip()
    if not segment:
        return None

    decoder = json.JSONDecoder()
    try:
        payload, _ = decoder.raw_decode(segment)
    except json.JSONDecodeError:
        return None

    return payload if isinstance(payload, dict) else None


def _extract_evidence_ids(content: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r'"id"\s*:\s*"(ev_[^"]+)"', content)))


def _extract_grounding_packet(content: str) -> dict[str, Any]:
    return _extract_json_block(content, "Retrieved evidence packet:", "JSON Schema:") or {}


def _extract_profile(content: str) -> dict[str, Any]:
    return _extract_json_block(content, "Default profile:", "Current state snapshot:") or {}


def _extract_current_state(content: str) -> dict[str, Any]:
    return _extract_json_block(content, "Current state snapshot:", "Retrieved evidence packet:") or {}


def _normalize_text(value: object | None) -> str:
    return " ".join(str(value or "").split()).strip()


def _goal_family(goal: dict[str, Any]) -> str:
    text = " ".join(
        [
            _normalize_text(goal.get("title")),
            _normalize_text(goal.get("description")),
            _normalize_text(goal.get("category")),
            _normalize_text(goal.get("success_criteria")),
        ]
    ).lower()
    if any(token in text for token in ["일본어", "영어", "회화", "conversation", "language", "speak", "speaking", "fluency", "native speaker", "원어민"]):
        return "language"
    if any(token in text for token in ["workspace", "product", "build", "planning", "app", "service", "saas", "tool"]):
        return "product"
    if any(token in text for token in ["fitness", "diet", "weight", "muscle", "injury", "workout", "run"]):
        return "fitness"
    if any(token in text for token in ["career", "job", "interview", "resume", "portfolio", "hiring"]):
        return "career"
    if any(token in text for token in ["move", "relocation", "visa", "city", "country", "immigration"]):
        return "relocation"
    return "general"


def _build_stub_evidence(content: str) -> list[dict[str, Any]]:
    grounding_packet = _extract_grounding_packet(content)
    evidence_items = grounding_packet.get("evidence_items")
    if isinstance(evidence_items, list) and evidence_items:
        normalized: list[dict[str, Any]] = []
        for item in evidence_items:
            if not isinstance(item, dict):
                continue
            evidence_id = _normalize_text(item.get("id"))
            if not evidence_id:
                continue
            normalized.append(
                {
                    "id": evidence_id,
                    "source_id": _normalize_text(item.get("source_id")) or evidence_id.replace("ev_", "src_"),
                    "title": _normalize_text(item.get("title")) or evidence_id,
                    "quote_or_summary": _normalize_text(item.get("quote_or_summary")) or "검색된 근거가 요약 없이 연결되었습니다.",
                    "url": item.get("url"),
                    "reliability": _normalize_text(item.get("reliability")) or "retrieved_note",
                }
            )
        if normalized:
            return normalized

    evidence_ids = _extract_evidence_ids(content)
    return [
        {
            "id": evidence_id,
            "source_id": f"source-{index}",
            "title": f"로컬 근거 {index}",
            "quote_or_summary": "현재는 로컬 스텁 생성 경로이므로 실제 검색 근거 대신 확인용 근거 슬롯을 노출합니다.",
            "url": None,
            "reliability": "stub_preview",
        }
        for index, evidence_id in enumerate(evidence_ids[:4], start=1)
    ]


def _build_stub_goal_analysis(content: str) -> dict[str, Any]:
    goal = _extract_json_block(content, "Goal:", "Default profile:") or {}
    title = _normalize_text(goal.get("title")) or "새 목표"
    goal_id = _normalize_text(goal.get("id")) or "stub-goal"
    dimensions = [
        {
            "id": "available_time",
            "label": "Available time",
            "kind": "time",
            "value_type": "hours_per_week",
            "question": "이 목표에 현실적으로 매주 몇 시간을 쓸 수 있나요?",
            "relevance_reason": "목표 속도, route 폭, checkpoint 간격을 정하려면 지속 가능한 시간 예산이 필요합니다.",
        },
        {
            "id": "monthly_budget",
            "label": "Monthly budget",
            "kind": "money",
            "value_type": "currency_per_month",
            "question": "매달 투입 가능한 비용 범위는 어느 정도인가요?",
            "relevance_reason": "유료 코칭, 학원, 도구, 무료 독학 route의 분기 조건이 됩니다.",
        },
        {
            "id": "current_level",
            "label": "Current level",
            "kind": "skill",
            "value_type": "qualitative",
            "question": "지금 출발점은 어디인가요? 이미 할 수 있는 것과 막히는 것을 나눠주세요.",
            "relevance_reason": "출발점이 달라지면 첫 노드와 첫 검증 지점이 달라집니다.",
        },
        {
            "id": "preferred_mode",
            "label": "Preferred mode",
            "kind": "practice",
            "value_type": "qualitative",
            "question": "혼자 학습, 튜터/학원, 커뮤니티, 콘텐츠 기반 학습 중 어떤 방식이 잘 맞나요?",
            "relevance_reason": "계획이 사용자 성향과 맞아야 route 선택 후 이탈 가능성이 낮아집니다.",
        },
        {
            "id": "feedback_access",
            "label": "Feedback access",
            "kind": "support",
            "value_type": "qualitative",
            "question": "피드백을 받을 사람, 커뮤니티, 튜터, 동료가 있나요?",
            "relevance_reason": "피드백 가능성은 독학 route와 교정 route를 가르는 중요한 차이입니다.",
        },
    ]
    followups = [
        {
            "id": item["id"],
            "label": item["label"],
            "question": item["question"],
            "why_needed": item["relevance_reason"],
            "answer_type": item["value_type"],
            "required": index < 4,
            "maps_to": [item["id"]],
        }
        for index, item in enumerate(dimensions)
    ]
    collection_targets = [
        {
            "id": "lived_experience_paths",
            "label": "비슷한 조건의 실제 달성/실패 수기",
            "layer": "lived_experience",
            "search_intent": "비슷한 시간, 비용, 출발점에서 어떤 루트가 유지되거나 무너졌는지 찾는다.",
            "example_queries": [
                f"{title} 실제 후기 실패 성공 루틴",
                f"{title} 직장인 독학 튜터 커뮤니티 경험담",
            ],
            "preferred_collectors": ["scrapling", "crawl4ai"],
            "source_examples": ["개인 블로그", "공개 커뮤니티 글", "공개 회고"],
            "reason": "그래프가 현실적인 마찰과 route 전환 조건을 포함하려면 수기가 필요합니다.",
            "max_sources": 4,
        },
        {
            "id": "formal_curricula",
            "label": "구조화된 커리큘럼과 비용 구조",
            "layer": "formal_program",
            "search_intent": "학원, 튜터, 코스, 공식 커리큘럼이 어떤 단계와 비용을 제시하는지 비교한다.",
            "example_queries": [
                f"{title} 커리큘럼 단계 비용",
                f"{title} course curriculum tutor program",
            ],
            "preferred_collectors": ["crawl4ai", "scrapling"],
            "source_examples": ["학원 커리큘럼", "튜터링 상품 설명", "공개 강의 계획"],
            "reason": "유료/무료 route의 비용과 checkpoint를 근거 있게 나눌 수 있습니다.",
            "max_sources": 4,
        },
        {
            "id": "failure_modes_and_switches",
            "label": "실패 지점과 전환 조건",
            "layer": "risk_and_switching",
            "search_intent": "어떤 상황에서 route를 약화, 축소, 우회, 재활성화해야 하는지 찾는다.",
            "example_queries": [
                f"{title} common mistakes plateau burnout",
                f"{title} fallback route switching conditions",
            ],
            "preferred_collectors": ["scrapling", "crawl4ai"],
            "source_examples": ["실패 분석 글", "전문가 조언", "장기 후기"],
            "reason": "Pathway 그래프는 한 줄짜리 계획이 아니라 route switching map이어야 합니다.",
            "max_sources": 4,
        },
    ]
    return {
        "goal_id": goal_id,
        "analysis_summary": (
            f'"{title}" 목표는 시간, 비용, 출발점, 선호 방식, 피드백 접근성을 먼저 확인한 뒤 '
            "수기/커리큘럼/실패 사례를 나눠 조사해야 합니다."
        ),
        "resource_dimensions": dimensions,
        "research_questions": [
            query
            for target in collection_targets
            for query in target["example_queries"]
        ],
        "followup_questions": followups,
        "research_plan": {
            "summary": "답변으로 제약을 고정한 뒤 수기, 구조화 커리큘럼, 실패/전환 사례를 분리 수집합니다.",
            "collection_targets": collection_targets,
            "verification_checks": [
                "사용자와 비슷한 조건인지 확인한다.",
                "홍보성 자료와 실제 수기를 분리한다.",
                "근거 없는 조언은 assumption으로만 사용한다.",
            ],
            "expected_graph_complexity": "multi_route_with_switching_conditions",
        },
    }


def _base_node_types() -> dict[str, dict[str, Any]]:
    return {
        "goal": {
            "id": "goal",
            "label": "목표",
            "description": "사용자가 도달하려는 상태",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [{"key": "success_criteria", "label": "성공 기준", "value_type": "markdown", "required": True}],
        },
        "route": {
            "id": "route",
            "label": "루트",
            "description": "달성 경로",
            "default_style": {"tone": "iris", "shape": "rounded_card"},
            "fields": [{"key": "fit_reason", "label": "적합 이유", "value_type": "markdown", "required": False}],
        },
        "practice_system": {
            "id": "practice_system",
            "label": "연습 시스템",
            "description": "반복 구조와 실천 루프",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [{"key": "cadence", "label": "반복 리듬", "value_type": "markdown", "required": False}],
        },
        "checkpoint": {
            "id": "checkpoint",
            "label": "체크포인트",
            "description": "경로 검증 지점",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [{"key": "checkpoint", "label": "검증 기준", "value_type": "markdown", "required": False}],
        },
        "constraint": {
            "id": "constraint",
            "label": "제약",
            "description": "진행을 약화시키는 압력",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [{"key": "impact", "label": "영향", "value_type": "markdown", "required": False}],
        },
        "fallback_route": {
            "id": "fallback_route",
            "label": "전환 루트",
            "description": "기존 경로가 약해질 때의 대안",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [{"key": "trigger", "label": "전환 조건", "value_type": "markdown", "required": False}],
        },
        "milestone": {
            "id": "milestone",
            "label": "마일스톤",
            "description": "중간 성취 지점",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [{"key": "exit_test", "label": "통과 기준", "value_type": "markdown", "required": False}],
        },
        "environment": {
            "id": "environment",
            "label": "환경 설계",
            "description": "실행 환경과 노출 구조",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [{"key": "setup", "label": "환경 세팅", "value_type": "markdown", "required": False}],
        },
    }


def _language_stub_bundle(goal: dict[str, Any], profile: dict[str, Any], current_state: dict[str, Any], evidence: list[dict[str, Any]]) -> dict[str, Any]:
    title = _normalize_text(goal.get("title")) or "새 목표"
    success_criteria = _normalize_text(goal.get("success_criteria")) or "목표 달성 조건을 정의합니다."
    goal_id = _normalize_text(goal.get("id")) or "stub-goal"
    evidence_ids = [item["id"] for item in evidence]
    weekly_hours = profile.get("weekly_free_hours")
    budget = profile.get("monthly_budget_amount")
    energy = _normalize_text(profile.get("energy_level")) or "unknown"
    constraints = current_state.get("active_constraints") if isinstance(current_state.get("active_constraints"), list) else []

    use_guided_route = isinstance(budget, (int, float)) and budget >= 80000
    route_direct_label = "회화 직행 루트"
    route_support_label = "교정 루트" if use_guided_route else "입력 보강 루트"
    fallback_label = "범위 축소 루트" if (isinstance(weekly_hours, (int, float)) and weekly_hours < 6) else "출력 유지 루트"
    constraint_label = "에너지 변동 압력" if energy in {"low", "medium"} else "일정 충돌 압력"

    nodes = [
        {
            "id": "goal",
            "type": "goal",
            "label": title,
            "summary": "원어민과의 실제 대화를 감당할 수 있을 만큼 출력·이해·복구 능력을 함께 키우는 지도를 만듭니다.",
            "data": {"success_criteria": success_criteria},
            "scores": {"time_load": 0.52, "money_load": 0.34, "uncertainty": 0.41},
            "evidence_refs": [],
            "assumption_refs": ["assumption_consistency"],
        },
        {
            "id": "route_output",
            "type": "route",
            "label": route_direct_label,
            "summary": "초반부터 말하기 비중을 올려 회화 감각을 빠르게 붙이는 루트입니다.",
            "data": {"fit_reason": "대화 가능 수준이 목표라면 출력 루프를 뒤로 미루지 않는 편이 유리합니다."},
            "scores": {"time_load": 0.72, "money_load": 0.28, "uncertainty": 0.46},
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "route_support",
            "type": "route",
            "label": route_support_label,
            "summary": "직행 루트의 이탈 위험을 줄이기 위해 입력 보강이나 교정을 붙이는 안정화 루트입니다.",
            "data": {"fit_reason": "혼자 공부하다 막히는 구간을 줄여 지속성을 확보합니다."},
            "scores": {"time_load": 0.58, "money_load": 0.48 if use_guided_route else 0.22, "uncertainty": 0.31},
            "evidence_refs": evidence_ids[1:2],
            "assumption_refs": [],
        },
        {
            "id": "practice_loop",
            "type": "practice_system",
            "label": "주간 회화 루프",
            "summary": "암기·입력·출력을 한 주 안에서 순환시키는 실전 루프입니다.",
            "data": {"cadence": "어휘/패턴 누적 → 짧은 독백 → 실제 대화/모의 대화 → 복기"},
            "scores": {"time_load": 0.63, "money_load": 0.18, "uncertainty": 0.27},
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "environment",
            "type": "environment",
            "label": "원어민 노출 환경",
            "summary": "실제 원어민 반응을 주기적으로 받아야 회화 복구력이 붙습니다.",
            "data": {"setup": "주 1회 이상 원어민 대화, 언어교환, 튜터링, 혹은 음성 피드백 경로를 확보합니다."},
            "scores": {"time_load": 0.34, "money_load": 0.39 if use_guided_route else 0.16, "uncertainty": 0.33},
            "evidence_refs": evidence_ids[2:3],
            "assumption_refs": [],
        },
        {
            "id": "checkpoint",
            "type": "checkpoint",
            "label": "원어민 15분 점검",
            "summary": "실제 대화를 15분 이상 이어가며 막히는 지점을 수집하는 첫 검증 지점입니다.",
            "data": {"checkpoint": "모르는 표현이 나와도 일본어로 우회 설명하며 대화를 끊지 않는지 확인합니다."},
            "scores": {"uncertainty": 0.19},
            "evidence_refs": evidence_ids[3:4],
            "assumption_refs": [],
        },
        {
            "id": "constraint",
            "type": "constraint",
            "label": constraint_label,
            "summary": "회화형 목표는 집중 시간이 흔들리면 먼저 출력 루프가 무너지는 경향이 있습니다.",
            "data": {"impact": "복습만 남고 실제 말하기가 밀리면 체감 성장이 느려져 동기 저하가 커집니다."},
            "scores": {"uncertainty": 0.44},
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "fallback",
            "type": "fallback_route",
            "label": fallback_label,
            "summary": "목표를 버리지 않고 대화 범위를 줄여서 출력 감각만은 유지하는 우회 루트입니다.",
            "data": {"trigger": "주 2회 이상 출력 세션이 깨지면 자유회화 대신 짧은 주제 회화나 스크립트 회화로 축소합니다."},
            "scores": {"time_load": 0.29, "money_load": 0.15, "uncertainty": 0.24},
            "evidence_refs": [],
            "assumption_refs": [],
        },
    ]

    if isinstance(weekly_hours, (int, float)) and weekly_hours >= 8:
        nodes.append(
            {
                "id": "milestone",
                "type": "milestone",
                "label": "30분 대화 마일스톤",
                "summary": "짧은 대화가 아니라 체력과 복구력이 필요한 중간 길이 회화를 통과시키는 구간입니다.",
                "data": {"exit_test": "원어민과 30분 동안 일상·흥미·계획 주제를 오가며 대화합니다."},
                "scores": {"uncertainty": 0.22},
                "evidence_refs": evidence_ids[1:2],
                "assumption_refs": [],
            }
        )

    edges = [
        {"id": "e1", "type": "progresses_to", "source": "goal", "target": "route_output", "label": "출력 우선"},
        {"id": "e2", "type": "progresses_to", "source": "goal", "target": "route_support", "label": "안정화 보조"},
        {"id": "e3", "type": "progresses_to", "source": "route_output", "target": "practice_loop"},
        {"id": "e4", "type": "progresses_to", "source": "route_support", "target": "environment"},
        {"id": "e5", "type": "progresses_to", "source": "practice_loop", "target": "checkpoint"},
        {"id": "e6", "type": "progresses_to", "source": "practice_loop", "target": "constraint"},
        {"id": "e7", "type": "progresses_to", "source": "constraint", "target": "fallback"},
        {"id": "e8", "type": "progresses_to", "source": "environment", "target": "checkpoint"},
    ]

    if any(node["id"] == "milestone" for node in nodes):
        edges.append({"id": "e9", "type": "progresses_to", "source": "checkpoint", "target": "milestone", "label": "유지 성공"})

    assumptions = [
        {
            "id": "assumption_consistency",
            "text": "사용자는 주간 루프를 최소 몇 주 이상 유지할 수 있고, 일본어 출력 시간을 완전히 0으로 만들지는 않습니다.",
            "risk_if_false": "회화형 목표보다 범위 축소 루트나 입력 중심 유지 전략이 더 현실적이 됩니다.",
        }
    ]
    if constraints:
        assumptions.append(
            {
                "id": "assumption_constraints",
                "text": "현재 활성 제약이 고정된 영구 조건이 아니라 조정 가능한 운영 제약입니다.",
                "risk_if_false": "목표 시점을 늦추거나 회화 목표를 더 작은 대화 범위로 다시 정의해야 합니다.",
            }
        )

    type_defs = _base_node_types()
    used_types = []
    for node in nodes:
        node_type = node["type"]
        if node_type not in used_types:
            used_types.append(node_type)

    return {
        "schema_version": "1.0.0",
        "bundle_id": f"stub-{goal_id}",
        "map": {
            "title": f"{title} 경로 초안",
            "goal_id": goal_id,
            "summary": "언어 학습 목표용 로컬 스텁 그래프입니다. 회화 루프, 노출 환경, 제약 압력, fallback을 함께 드러냅니다.",
        },
        "ontology": {
            "node_types": [type_defs[node_type] for node_type in used_types],
            "edge_types": [
                {"id": "progresses_to", "label": "진행", "role": "progression", "default_style": {"line": "curved"}},
                {"id": "supported_by", "label": "근거", "role": "reference", "default_style": {"line": "dotted"}},
            ],
        },
        "nodes": nodes,
        "edges": edges,
        "evidence": evidence,
        "assumptions": assumptions,
        "warnings": [
            "이 그래프는 예측이 아니라 로컬 스텁 기반 시나리오 지도입니다.",
            "실제 Codex 기반 생성 경로가 연결되면 회화 루프와 전환 조건이 더 근거 중심으로 세분화됩니다.",
        ],
    }


def _generic_stub_bundle(goal: dict[str, Any], evidence: list[dict[str, Any]], family: str) -> dict[str, Any]:
    title = _normalize_text(goal.get("title")) or "새 목표"
    success_criteria = _normalize_text(goal.get("success_criteria")) or "목표 달성 조건을 명확히 정의합니다."
    goal_id = _normalize_text(goal.get("id")) or "stub-goal"
    evidence_ids = [item["id"] for item in evidence]
    route_labels_by_family = {
        "product": ("핵심 구조 루트", "검증 루트", "스코프 축소 루트"),
        "fitness": ("적응 루트", "회복 루트", "부하 축소 루트"),
        "career": ("직접 도전 루트", "포트폴리오 보강 루트", "범위 재설계 루트"),
        "relocation": ("준비 루트", "행정 보강 루트", "우회 정착 루트"),
        "general": ("직행 루트", "가이드 루트", "범위 축소 루트"),
    }
    route_primary, route_secondary, route_fallback = route_labels_by_family.get(family, route_labels_by_family["general"])

    nodes = [
        {
            "id": "goal",
            "type": "goal",
            "label": title,
            "summary": "현재 목표를 기준으로 실행 가능한 루트 후보를 정렬합니다.",
            "data": {"success_criteria": success_criteria},
            "scores": {"time_load": 0.45, "money_load": 0.33, "uncertainty": 0.39},
            "evidence_refs": [],
            "assumption_refs": ["assumption_capacity"],
        },
        {
            "id": "route_primary",
            "type": "route",
            "label": route_primary,
            "summary": "목표를 정면으로 밀어붙이는 주 경로입니다.",
            "data": {"fit_reason": "핵심 진전을 가장 빨리 만들지만 유지 조건이 흔들리면 리스크가 커집니다."},
            "scores": {"time_load": 0.67, "money_load": 0.31, "uncertainty": 0.43},
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "route_secondary",
            "type": "route",
            "label": route_secondary,
            "summary": "직행 경로의 실패 확률을 낮추기 위한 안정화 경로입니다.",
            "data": {"fit_reason": "속도보다 유지 가능성과 시행착오 축소를 우선할 때 유리합니다."},
            "scores": {"time_load": 0.54, "money_load": 0.42, "uncertainty": 0.29},
            "evidence_refs": evidence_ids[1:2],
            "assumption_refs": [],
        },
        {
            "id": "checkpoint",
            "type": "checkpoint",
            "label": "첫 검증 시점",
            "summary": "지금 선택한 루트가 유지 가능한지 확인하는 첫 지점입니다.",
            "data": {"checkpoint": "실제 투입량과 반복 가능성을 함께 확인합니다."},
            "scores": {"uncertainty": 0.2},
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "constraint",
            "type": "constraint",
            "label": "핵심 제약 압력",
            "summary": "시간, 예산, 에너지, 맥락 중 하나가 줄면 주 경로가 먼저 흔들립니다.",
            "data": {"impact": "전환 신호를 늦게 보면 전체 계획이 무너질 수 있습니다."},
            "scores": {"uncertainty": 0.46},
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "fallback",
            "type": "fallback_route",
            "label": route_fallback,
            "summary": "목표 전체를 버리지 않고 범위나 속도를 조정하는 우회 경로입니다.",
            "data": {"trigger": "두 차례 이상 계획 리듬이 깨지면 이 전환 루트를 검토합니다."},
            "scores": {"time_load": 0.32, "money_load": 0.18, "uncertainty": 0.25},
            "evidence_refs": [],
            "assumption_refs": [],
        },
    ]

    if evidence_ids[2:3]:
        nodes.append(
            {
                "id": "milestone",
                "type": "milestone",
                "label": "중간 마일스톤",
                "summary": "목표가 계속 유효한지 판단하는 중간 성취 지점입니다.",
                "data": {"exit_test": "실제 사용 환경에서 한 단계 더 긴 검증을 통과합니다."},
                "scores": {"uncertainty": 0.24},
                "evidence_refs": evidence_ids[2:3],
                "assumption_refs": [],
            }
        )

    edges = [
        {"id": "e1", "type": "progresses_to", "source": "goal", "target": "route_primary", "label": "빠른 시작"},
        {"id": "e2", "type": "progresses_to", "source": "goal", "target": "route_secondary", "label": "안정적 시작"},
        {"id": "e3", "type": "progresses_to", "source": "route_primary", "target": "checkpoint"},
        {"id": "e4", "type": "progresses_to", "source": "route_primary", "target": "constraint"},
        {"id": "e5", "type": "progresses_to", "source": "constraint", "target": "fallback"},
    ]
    if any(node["id"] == "milestone" for node in nodes):
        edges.append({"id": "e6", "type": "progresses_to", "source": "checkpoint", "target": "milestone", "label": "중간 통과"})

    type_defs = _base_node_types()
    used_types = []
    for node in nodes:
        if node["type"] not in used_types:
            used_types.append(node["type"])

    return {
        "schema_version": "1.0.0",
        "bundle_id": f"stub-{goal_id}",
        "map": {
            "title": f"{title} 경로 초안",
            "goal_id": goal_id,
            "summary": "고정 6노드 템플릿 대신 목표 가족과 근거 수에 따라 달라지는 로컬 스텁 그래프입니다.",
        },
        "ontology": {
            "node_types": [type_defs[node_type] for node_type in used_types],
            "edge_types": [
                {"id": "progresses_to", "label": "진행", "role": "progression", "default_style": {"line": "curved"}},
                {"id": "supported_by", "label": "근거", "role": "reference", "default_style": {"line": "dotted"}},
            ],
        },
        "nodes": nodes,
        "edges": edges,
        "evidence": evidence,
        "assumptions": [
            {
                "id": "assumption_capacity",
                "text": "사용자는 이 목표를 유지할 최소한의 반복 블록을 계속 확보할 수 있습니다.",
                "risk_if_false": "직행 루트보다 범위 조정 루트가 먼저 현실화됩니다.",
            }
        ],
        "warnings": [
            "이 그래프는 예측이 아니라 로컬 스텁 기반 시나리오 지도입니다.",
            "실제 Codex 기반 생성 경로가 연결되면 노드 의미와 근거 연결이 더 정교해집니다.",
        ],
    }


class StubPathwayProvider:
    """Local deterministic fallback until a real model backend is wired in."""

    def generate_structured_json(
        self,
        *,
        messages: Sequence[dict[str, str]],
        json_schema: dict[str, Any],
        schema_name: str,
    ) -> str:
        content = "\n\n".join(
            message.get("content", "")
            for message in messages
            if isinstance(message, dict) and isinstance(message.get("content"), str)
        )
        if schema_name == "pathway_goal_analysis":
            payload = _build_stub_goal_analysis(content)
        elif "Current graph bundle:" in content:
            payload = self._build_revision_bundle(content)
        else:
            payload = self._build_generation_bundle(content)
        return json.dumps(payload, ensure_ascii=False)

    def _build_generation_bundle(self, content: str) -> dict[str, Any]:
        goal = _extract_json_block(content, "Goal:", "Default profile:") or {}
        profile = _extract_profile(content)
        current_state = _extract_current_state(content)
        evidence = _build_stub_evidence(content)
        family = _goal_family(goal)

        if family == "language":
            return _language_stub_bundle(goal, profile, current_state, evidence)

        return _generic_stub_bundle(goal, evidence, family)

    def _build_revision_bundle(self, content: str) -> dict[str, Any]:
        current_bundle = _extract_json_block(content, "Current graph bundle:", "Recent state updates:") or {}
        goal = _extract_json_block(content, "Goal:", "Default profile:") or {}
        goal_id = str(goal.get("id") or current_bundle.get("map", {}).get("goal_id") or "stub-goal").strip()
        nodes = list(current_bundle.get("nodes") or [])
        edges = list(current_bundle.get("edges") or [])
        ontology = dict(current_bundle.get("ontology") or {})
        node_types = list(ontology.get("node_types") or [])
        assumptions = list(current_bundle.get("assumptions") or [])
        warnings = list(current_bundle.get("warnings") or [])

        if not any(item.get("id") == "recovery_route" for item in node_types):
            node_types.append(
                {
                    "id": "recovery_route",
                    "label": "회복 루트",
                    "description": "기존 루트가 약해졌을 때 붙는 보정 경로",
                    "default_style": {"tone": "sky", "shape": "rounded_card"},
                    "fields": [{"key": "trigger", "label": "발화 조건", "value_type": "markdown", "required": False}],
                }
            )

        route_node = next((node for node in nodes if node.get("type") == "route"), None)
        if route_node is not None:
            route_node["status"] = "at_risk"
            route_node["revision_meta"] = {
                **dict(route_node.get("revision_meta") or {}),
                "change_note": "최근 현실 업데이트 기준으로 이 루트의 유지 비용이 상승했습니다.",
            }

        pressure_node = next((node for node in nodes if node.get("type") == "pressure"), None)
        recovery_node_id = "recovery_route"
        if not any(node.get("id") == recovery_node_id for node in nodes):
            nodes.append(
                {
                    "id": recovery_node_id,
                    "type": "recovery_route",
                    "label": "회복 루트 추가",
                    "summary": "기존 경로를 버리지 않고 목표 범위를 조정해 진행률을 회복합니다.",
                    "data": {"trigger": "최근 변경으로 불가능해진 지점부터 작은 단위로 다시 연결합니다."},
                    "scores": {"time_load": 0.29, "money_load": 0.18, "uncertainty": 0.34},
                    "evidence_refs": [],
                    "assumption_refs": [],
                    "status": "proposed",
                    "revision_meta": {"change_note": "현실 변경 요청으로 새 브랜치가 추가되었습니다."},
                }
            )

        if pressure_node is not None and not any(edge.get("target") == recovery_node_id for edge in edges):
            edges.append(
                {
                    "id": "e_recovery",
                    "type": "progresses_to",
                    "source": str(pressure_node.get("id")),
                    "target": recovery_node_id,
                    "label": "보정 분기",
                }
            )

        assumptions.append(
            {
                "id": "assumption_revision",
                "text": "최근 변경은 임시 제약일 수 있으므로 완전 폐기보다 보정 루트가 우선입니다.",
                "risk_if_false": "더 강한 축소 또는 완전한 루트 전환이 필요할 수 있습니다.",
            }
        )
        warnings = list(dict.fromkeys([*warnings, "최근 현실 업데이트를 반영한 스텁 리비전 미리보기입니다."]))

        current_bundle["map"] = {
            **dict(current_bundle.get("map") or {}),
            "goal_id": goal_id,
            "summary": "최근 현실 업데이트를 반영한 로컬 스텁 리비전 미리보기입니다.",
        }
        current_bundle["ontology"] = {
            **ontology,
            "node_types": node_types,
            "edge_types": list(ontology.get("edge_types") or []),
        }
        current_bundle["nodes"] = nodes
        current_bundle["edges"] = edges
        current_bundle["assumptions"] = assumptions
        current_bundle["warnings"] = warnings
        return current_bundle


def build_llm_provider(settings: Settings) -> OllamaProvider | OpenAIProvider | StubPathwayProvider:
    provider_name = settings.llm_provider.strip().lower()
    if provider_name == "stub":
        return StubPathwayProvider()
    if provider_name == "ollama":
        return OllamaProvider(settings)
    if provider_name == "openai":
        return OpenAIProvider(settings)
    raise AppConfigurationError(
        f"Unsupported LLM provider '{settings.llm_provider}'. Use 'stub', 'ollama', or 'openai'."
    )
