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
        if "Current graph bundle:" in content:
            payload = self._build_revision_bundle(content)
        else:
            payload = self._build_generation_bundle(content)
        return json.dumps(payload, ensure_ascii=False)

    def _build_generation_bundle(self, content: str) -> dict[str, Any]:
        goal = _extract_json_block(content, "Goal:", "Default profile:") or {}
        title = str(goal.get("title") or "새 목표").strip()
        success_criteria = str(goal.get("success_criteria") or "목표 달성에 필요한 조건을 명확히 정의합니다.").strip()
        goal_id = str(goal.get("id") or "stub-goal").strip()
        evidence_ids = _extract_evidence_ids(content)
        evidence = [
            {
                "id": evidence_id,
                "source_id": f"source-{index}",
                "title": f"로컬 근거 {index}",
                "quote_or_summary": "현재는 로컬 스텁 생성 경로이므로 실제 검색 근거 대신 확인용 근거 슬롯을 노출합니다.",
                "url": None,
                "reliability": "stub_preview",
            }
            for index, evidence_id in enumerate(evidence_ids[:2], start=1)
        ]
        bundle_id = f"stub-{goal_id}"

        return {
            "schema_version": "1.0.0",
            "bundle_id": bundle_id,
            "map": {
                "title": f"{title} 경로 초안",
                "goal_id": goal_id,
                "summary": "로컬 스텁 생성 경로입니다. 실제 모델이 연결되면 이 자리에 근거 기반 그래프가 생성됩니다.",
            },
            "ontology": {
                "node_types": [
                    {
                        "id": "goal",
                        "label": "목표",
                        "description": "사용자가 도달하려는 상태",
                        "default_style": {"tone": "mist", "shape": "rounded_card"},
                        "fields": [{"key": "success_criteria", "label": "성공 기준", "value_type": "markdown", "required": True}],
                    },
                    {
                        "id": "route",
                        "label": "루트",
                        "description": "달성 경로",
                        "default_style": {"tone": "iris", "shape": "rounded_card"},
                        "fields": [{"key": "fit_reason", "label": "적합 이유", "value_type": "markdown", "required": False}],
                    },
                    {
                        "id": "checkpoint",
                        "label": "체크포인트",
                        "description": "경로 검증 지점",
                        "default_style": {"tone": "sky", "shape": "rounded_card"},
                        "fields": [{"key": "checkpoint", "label": "검증 기준", "value_type": "markdown", "required": False}],
                    },
                    {
                        "id": "pressure",
                        "label": "압력",
                        "description": "진행을 약화시키는 제약",
                        "default_style": {"tone": "mist", "shape": "rounded_card"},
                        "fields": [{"key": "impact", "label": "영향", "value_type": "markdown", "required": False}],
                    },
                    {
                        "id": "switch",
                        "label": "전환 루트",
                        "description": "기존 경로가 약해질 때의 대안",
                        "default_style": {"tone": "sky", "shape": "rounded_card"},
                        "fields": [{"key": "trigger", "label": "전환 조건", "value_type": "markdown", "required": False}],
                    },
                ],
                "edge_types": [
                    {"id": "progresses_to", "label": "진행", "role": "progression", "default_style": {"line": "curved"}},
                    {"id": "supported_by", "label": "근거", "role": "reference", "default_style": {"line": "dotted"}},
                ],
            },
            "nodes": [
                {
                    "id": "goal",
                    "type": "goal",
                    "label": title,
                    "summary": "현재 목표를 기준으로 실행 가능한 루트 후보를 정렬합니다.",
                    "data": {"success_criteria": success_criteria},
                    "scores": {"time_load": 0.42, "money_load": 0.31, "uncertainty": 0.38},
                    "evidence_refs": [],
                    "assumption_refs": ["assumption_capacity"],
                },
                {
                    "id": "route_direct",
                    "type": "route",
                    "label": "직행 루트",
                    "summary": "속도는 빠르지만 현재 제약이 흔들리면 바로 리스크가 드러납니다.",
                    "data": {"fit_reason": "시간과 집중을 안정적으로 확보할 수 있을 때 유리합니다."},
                    "scores": {"time_load": 0.71, "money_load": 0.28, "uncertainty": 0.44},
                    "evidence_refs": evidence_ids[:1],
                    "assumption_refs": [],
                },
                {
                    "id": "route_guided",
                    "type": "route",
                    "label": "가이드 루트",
                    "summary": "교정 비용이 있지만 시행착오를 줄일 수 있습니다.",
                    "data": {"fit_reason": "혼자 밀어붙일 때 이탈 가능성이 높다면 초기 안정성이 더 좋습니다."},
                    "scores": {"time_load": 0.56, "money_load": 0.52, "uncertainty": 0.29},
                    "evidence_refs": evidence_ids[1:2],
                    "assumption_refs": [],
                },
                {
                    "id": "checkpoint",
                    "type": "checkpoint",
                    "label": "첫 검증 시점",
                    "summary": "지금 선택한 루트가 유지 가능한지 가장 먼저 확인합니다.",
                    "data": {"checkpoint": "이번 주 실제 투입 시간과 반복 가능성을 함께 확인합니다."},
                    "scores": {"uncertainty": 0.21},
                    "evidence_refs": [],
                    "assumption_refs": [],
                },
                {
                    "id": "pressure",
                    "type": "pressure",
                    "label": "가용 자원 축소",
                    "summary": "시간, 예산, 에너지 중 하나라도 줄면 직행 루트가 먼저 약해집니다.",
                    "data": {"impact": "경로 전환 신호를 늦게 보면 전체 계획이 무너질 수 있습니다."},
                    "scores": {"uncertainty": 0.47},
                    "evidence_refs": [],
                    "assumption_refs": [],
                },
                {
                    "id": "switch",
                    "type": "switch",
                    "label": "범위 축소 루트",
                    "summary": "목표 전체를 버리지 않고 더 작은 범위로 우회합니다.",
                    "data": {"trigger": "2회 이상 연속으로 계획 시간을 못 채우면 이 루트를 검토합니다."},
                    "scores": {"time_load": 0.33, "money_load": 0.19, "uncertainty": 0.24},
                    "evidence_refs": [],
                    "assumption_refs": [],
                },
            ],
            "edges": [
                {"id": "e1", "type": "progresses_to", "source": "goal", "target": "route_direct", "label": "빠른 시작"},
                {"id": "e2", "type": "progresses_to", "source": "goal", "target": "route_guided", "label": "안정적 시작"},
                {"id": "e3", "type": "progresses_to", "source": "route_direct", "target": "checkpoint"},
                {"id": "e4", "type": "progresses_to", "source": "route_direct", "target": "pressure"},
                {"id": "e5", "type": "progresses_to", "source": "pressure", "target": "switch"},
            ],
            "evidence": evidence,
            "assumptions": [
                {
                    "id": "assumption_capacity",
                    "text": "사용자는 매주 최소 한 번은 목표에 집중할 블록을 확보할 수 있습니다.",
                    "risk_if_false": "직행 루트보다 범위 축소 루트가 더 현실적이 됩니다.",
                }
            ],
            "warnings": [
                "이 그래프는 예측이 아니라 로컬 스텁 기반 시나리오 지도입니다.",
                "실제 Codex 기반 생성 경로가 연결되면 근거와 노드 의미가 더 구체화됩니다.",
            ],
        }

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
