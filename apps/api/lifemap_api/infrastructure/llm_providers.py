from __future__ import annotations

# This file carries large structured-output schemas and Korean stub graph copy.
# Keep E501 suppressed locally so the content remains readable as authored data.
# ruff: noqa: E501
import json
import re
import subprocess
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from lifemap_api.application.errors import AppConfigurationError, ProviderInvocationError
from lifemap_api.config import Settings


def _to_codex_output_schema(schema: dict[str, Any]) -> dict[str, Any]:
    if schema.get("title") == "GoalAnalysis":
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "goal_id": {"type": "string"},
                "analysis_summary": {"type": "string"},
                "resource_dimensions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "label": {"type": "string"},
                            "kind": {
                                "type": "string",
                                "enum": [
                                    "time",
                                    "money",
                                    "energy",
                                    "motivation",
                                    "skill",
                                    "environment",
                                    "schedule",
                                    "support",
                                    "location",
                                    "tooling",
                                    "practice",
                                ],
                            },
                            "value_type": {"type": "string"},
                            "question": {"type": "string"},
                            "relevance_reason": {"type": "string"},
                        },
                        "required": [
                            "id",
                            "label",
                            "kind",
                            "value_type",
                            "question",
                            "relevance_reason",
                        ],
                    },
                },
                "research_questions": {"type": "array", "items": {"type": "string"}},
                "followup_questions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "label": {"type": "string"},
                            "question": {"type": "string"},
                            "why_needed": {"type": "string"},
                            "answer_type": {"type": "string"},
                            "required": {"type": "boolean"},
                            "maps_to": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": [
                            "id",
                            "label",
                            "question",
                            "why_needed",
                            "answer_type",
                            "required",
                            "maps_to",
                        ],
                    },
                },
                "research_plan": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "summary": {"type": "string"},
                        "collection_targets": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "id": {"type": "string"},
                                    "label": {"type": "string"},
                                    "layer": {"type": "string"},
                                    "search_intent": {"type": "string"},
                                    "example_queries": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "preferred_collectors": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "source_examples": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "reason": {"type": "string"},
                                    "max_sources": {"type": "integer"},
                                },
                                "required": [
                                    "id",
                                    "label",
                                    "layer",
                                    "search_intent",
                                    "example_queries",
                                    "preferred_collectors",
                                    "source_examples",
                                    "reason",
                                    "max_sources",
                                ],
                            },
                        },
                        "verification_checks": {"type": "array", "items": {"type": "string"}},
                        "expected_graph_complexity": {
                            "type": "string",
                            "enum": ["low", "moderate", "high"],
                        },
                    },
                    "required": [
                        "summary",
                        "collection_targets",
                        "verification_checks",
                        "expected_graph_complexity",
                    ],
                },
            },
            "required": [
                "goal_id",
                "analysis_summary",
                "resource_dimensions",
                "research_questions",
                "followup_questions",
                "research_plan",
            ],
        }

    if schema.get("title") == "GraphBundle":
        empty_object = {
            "type": "object",
            "additionalProperties": False,
            "properties": {},
            "required": [],
        }
        nullable_string = {"type": ["string", "null"]}
        nullable_number = {"type": ["number", "null"]}
        return {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "schema_version": {"type": "string"},
                "bundle_id": {"type": "string"},
                "map": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "title": {"type": "string"},
                        "goal_id": {"type": "string"},
                        "summary": {"type": "string"},
                    },
                    "required": ["title", "goal_id", "summary"],
                },
                "ontology": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "node_types": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "id": {"type": "string"},
                                    "label": {"type": "string"},
                                    "description": {"type": "string"},
                                    "default_style": {
                                        "type": ["object", "null"],
                                        "additionalProperties": False,
                                        "properties": {
                                            "tone": nullable_string,
                                            "shape": nullable_string,
                                            "accent": nullable_string,
                                        },
                                        "required": ["tone", "shape", "accent"],
                                    },
                                    "fields": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "additionalProperties": False,
                                            "properties": {
                                                "key": {"type": "string"},
                                                "label": {"type": "string"},
                                                "value_type": {"type": "string"},
                                                "required": {"type": "boolean"},
                                            },
                                            "required": ["key", "label", "value_type", "required"],
                                        },
                                    },
                                },
                                "required": [
                                    "id",
                                    "label",
                                    "description",
                                    "default_style",
                                    "fields",
                                ],
                            },
                        },
                        "edge_types": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "id": {"type": "string"},
                                    "label": {"type": "string"},
                                    "role": {
                                        "type": "string",
                                        "enum": ["progression", "reference"],
                                    },
                                    "default_style": {
                                        "type": ["object", "null"],
                                        "additionalProperties": False,
                                        "properties": {
                                            "line": nullable_string,
                                            "accent": nullable_string,
                                        },
                                        "required": ["line", "accent"],
                                    },
                                },
                                "required": ["id", "label", "role", "default_style"],
                            },
                        },
                    },
                    "required": ["node_types", "edge_types"],
                },
                "nodes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "type": {"type": "string"},
                            "label": {"type": "string"},
                            "summary": {"type": "string"},
                            "data": empty_object,
                            "scores": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "time_load": {"type": "number", "minimum": 0, "maximum": 1},
                                    "money_load": {"type": "number", "minimum": 0, "maximum": 1},
                                    "energy_load": {"type": "number", "minimum": 0, "maximum": 1},
                                    "uncertainty": {"type": "number", "minimum": 0, "maximum": 1},
                                },
                                "required": [
                                    "time_load",
                                    "money_load",
                                    "energy_load",
                                    "uncertainty",
                                ],
                            },
                            "evidence_refs": {"type": "array", "items": {"type": "string"}},
                            "assumption_refs": {"type": "array", "items": {"type": "string"}},
                            "position": {
                                "type": ["object", "null"],
                                "additionalProperties": False,
                                "properties": {
                                    "x": {"type": "number"},
                                    "y": {"type": "number"},
                                },
                                "required": ["x", "y"],
                            },
                            "style_overrides": empty_object,
                            "status": nullable_string,
                            "created_from": nullable_string,
                            "revision_meta": empty_object,
                        },
                        "required": [
                            "id",
                            "type",
                            "label",
                            "summary",
                            "data",
                            "scores",
                            "evidence_refs",
                            "assumption_refs",
                            "position",
                            "style_overrides",
                            "status",
                            "created_from",
                            "revision_meta",
                        ],
                    },
                },
                "edges": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "type": {"type": "string"},
                            "source": {"type": "string"},
                            "target": {"type": "string"},
                            "label": nullable_string,
                            "condition": nullable_string,
                            "weight": nullable_number,
                            "style_overrides": empty_object,
                        },
                        "required": [
                            "id",
                            "type",
                            "source",
                            "target",
                            "label",
                            "condition",
                            "weight",
                            "style_overrides",
                        ],
                    },
                },
                "evidence": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "source_id": {"type": "string"},
                            "title": {"type": "string"},
                            "quote_or_summary": {"type": "string"},
                            "url": nullable_string,
                            "reliability": {"type": "string"},
                        },
                        "required": [
                            "id",
                            "source_id",
                            "title",
                            "quote_or_summary",
                            "url",
                            "reliability",
                        ],
                    },
                },
                "assumptions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "id": {"type": "string"},
                            "text": {"type": "string"},
                            "risk_if_false": {"type": "string"},
                        },
                        "required": ["id", "text", "risk_if_false"],
                    },
                },
                "warnings": {"type": "array", "items": {"type": "string"}},
            },
            "required": [
                "schema_version",
                "bundle_id",
                "map",
                "ontology",
                "nodes",
                "edges",
                "evidence",
                "assumptions",
                "warnings",
            ],
        }

    def convert(value: Any) -> Any:
        if isinstance(value, list):
            return [convert(item) for item in value]
        if not isinstance(value, dict):
            return value

        converted = {key: convert(item) for key, item in value.items() if key != "default"}
        properties = converted.get("properties")
        if isinstance(properties, dict):
            converted["required"] = list(properties.keys())
        if converted.get("type") == "object" or isinstance(properties, dict):
            converted["additionalProperties"] = False
        return converted

    converted_schema = convert(schema)
    if not isinstance(converted_schema, dict):
        raise AppConfigurationError("Codex output schema must be a JSON object")
    return converted_schema


class CodexCliProvider:
    def __init__(self, settings: Settings) -> None:
        if not settings.codex_model:
            raise AppConfigurationError(
                "LIFEMAP_CODEX_MODEL is required when LIFEMAP_LLM_PROVIDER=codex"
            )

        self._settings = settings

    def _build_prompt(
        self,
        *,
        messages: Sequence[dict[str, str]],
        schema_name: str,
    ) -> str:
        rendered_messages = "\n\n".join(
            f"<{message.get('role', 'user')}>\n{message.get('content', '')}\n</{message.get('role', 'user')}>"
            for message in messages
        )
        return (
            "You are being called by the local Pathway app through the logged-in Codex CLI.\n"
            "Use the active Codex subscription/login session. Do not ask for API keys or tokens.\n"
            f"Return a single JSON object for schema `{schema_name}`. No markdown, no prose.\n\n"
            f"{rendered_messages}"
        )

    def generate_structured_json(
        self,
        *,
        messages: Sequence[dict[str, str]],
        json_schema: dict[str, Any],
        schema_name: str,
    ) -> str:
        prompt = self._build_prompt(messages=messages, schema_name=schema_name)
        use_web_search = (
            self._settings.codex_web_search_enabled and schema_name != "pathway_goal_analysis"
        )
        try:
            with tempfile.TemporaryDirectory(prefix="pathway-codex-") as temp_dir:
                temp_path = Path(temp_dir)
                schema_path = temp_path / f"{schema_name}.schema.json"
                output_path = temp_path / f"{schema_name}.json"
                schema_path.write_text(
                    json.dumps(_to_codex_output_schema(json_schema), ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                command = [
                    "codex",
                    *(["--search"] if use_web_search else []),
                    "exec",
                    "--ephemeral",
                    "--model",
                    self._settings.codex_model,
                    "--sandbox",
                    "read-only",
                    "--output-schema",
                    str(schema_path),
                    "--output-last-message",
                    str(output_path),
                    "-",
                ]
                result = subprocess.run(
                    command,
                    input=prompt,
                    text=True,
                    capture_output=True,
                    timeout=self._settings.llm_request_timeout_seconds,
                    check=False,
                )
                if result.returncode != 0:
                    error_text = (result.stderr or result.stdout or "").strip()
                    raise ProviderInvocationError(
                        "Codex CLI structured generation failed: "
                        f"{error_text[-1200:] or f'exit code {result.returncode}'}"
                    )
                output_text = output_path.read_text(encoding="utf-8").strip()
        except FileNotFoundError as exc:
            raise AppConfigurationError(
                "Codex CLI was not found on PATH. Install/login to Codex before using Pathway AI analysis."
            ) from exc
        except subprocess.TimeoutExpired as exc:
            raise ProviderInvocationError(
                f"Codex CLI structured generation timed out after {self._settings.llm_request_timeout_seconds:g}s"
            ) from exc

        if not output_text:
            raise ProviderInvocationError(
                "Codex CLI structured generation returned an empty response"
            )
        return output_text


def _extract_json_block(
    content: str, start_marker: str, end_marker: str | None = None
) -> dict[str, Any] | None:
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
    return (
        _extract_json_block(content, "Current state snapshot:", "Retrieved evidence packet:") or {}
    )


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
    if any(
        token in text
        for token in [
            "일본어",
            "영어",
            "회화",
            "conversation",
            "language",
            "speak",
            "speaking",
            "fluency",
            "native speaker",
            "원어민",
        ]
    ):
        return "language"
    if any(
        token in text
        for token in ["workspace", "product", "build", "planning", "app", "service", "saas", "tool"]
    ):
        return "product"
    if any(
        token in text
        for token in ["fitness", "diet", "weight", "muscle", "injury", "workout", "run"]
    ):
        return "fitness"
    if any(
        token in text for token in ["career", "job", "interview", "resume", "portfolio", "hiring"]
    ):
        return "career"
    if any(
        token in text for token in ["move", "relocation", "visa", "city", "country", "immigration"]
    ):
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
                    "source_id": _normalize_text(item.get("source_id"))
                    or evidence_id.replace("ev_", "src_"),
                    "title": _normalize_text(item.get("title")) or evidence_id,
                    "quote_or_summary": _normalize_text(item.get("quote_or_summary"))
                    or "검색된 근거가 요약 없이 연결되었습니다.",
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


def _base_node_types() -> dict[str, dict[str, Any]]:
    return {
        "goal": {
            "id": "goal",
            "label": "목표",
            "description": "사용자가 도달하려는 상태",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [
                {
                    "key": "success_criteria",
                    "label": "성공 기준",
                    "value_type": "markdown",
                    "required": True,
                }
            ],
        },
        "route": {
            "id": "route",
            "label": "루트",
            "description": "달성 경로",
            "default_style": {"tone": "iris", "shape": "rounded_card"},
            "fields": [
                {
                    "key": "fit_reason",
                    "label": "적합 이유",
                    "value_type": "markdown",
                    "required": False,
                }
            ],
        },
        "practice_system": {
            "id": "practice_system",
            "label": "연습 시스템",
            "description": "반복 구조와 실천 루프",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [
                {
                    "key": "cadence",
                    "label": "반복 리듬",
                    "value_type": "markdown",
                    "required": False,
                }
            ],
        },
        "checkpoint": {
            "id": "checkpoint",
            "label": "체크포인트",
            "description": "경로 검증 지점",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [
                {
                    "key": "checkpoint",
                    "label": "검증 기준",
                    "value_type": "markdown",
                    "required": False,
                }
            ],
        },
        "constraint": {
            "id": "constraint",
            "label": "제약",
            "description": "진행을 약화시키는 압력",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [
                {"key": "impact", "label": "영향", "value_type": "markdown", "required": False}
            ],
        },
        "risk": {
            "id": "risk",
            "label": "리스크",
            "description": "실패 패턴이나 이탈 신호",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [
                {
                    "key": "mitigation",
                    "label": "완화책",
                    "value_type": "markdown",
                    "required": False,
                }
            ],
        },
        "fallback_route": {
            "id": "fallback_route",
            "label": "전환 루트",
            "description": "기존 경로가 약해질 때의 대안",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [
                {
                    "key": "trigger",
                    "label": "전환 조건",
                    "value_type": "markdown",
                    "required": False,
                }
            ],
        },
        "opportunity_cost": {
            "id": "opportunity_cost",
            "label": "기회비용",
            "description": "선택하지 않는 동안 약해지는 다른 경로",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [
                {"key": "cost", "label": "잃는 것", "value_type": "markdown", "required": False}
            ],
        },
        "switch_condition": {
            "id": "switch_condition",
            "label": "전환 조건",
            "description": "루트를 바꿀 시점과 신호",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [
                {"key": "signal", "label": "신호", "value_type": "markdown", "required": False}
            ],
        },
        "milestone": {
            "id": "milestone",
            "label": "마일스톤",
            "description": "중간 성취 지점",
            "default_style": {"tone": "sky", "shape": "rounded_card"},
            "fields": [
                {
                    "key": "exit_test",
                    "label": "통과 기준",
                    "value_type": "markdown",
                    "required": False,
                }
            ],
        },
        "environment": {
            "id": "environment",
            "label": "환경 설계",
            "description": "실행 환경과 노출 구조",
            "default_style": {"tone": "mist", "shape": "rounded_card"},
            "fields": [
                {"key": "setup", "label": "환경 세팅", "value_type": "markdown", "required": False}
            ],
        },
    }


def _language_stub_bundle(
    goal: dict[str, Any],
    profile: dict[str, Any],
    current_state: dict[str, Any],
    evidence: list[dict[str, Any]],
) -> dict[str, Any]:
    title = _normalize_text(goal.get("title")) or "새 목표"
    success_criteria = (
        _normalize_text(goal.get("success_criteria")) or "목표 달성 조건을 정의합니다."
    )
    goal_id = _normalize_text(goal.get("id")) or "stub-goal"
    evidence_ids = [item["id"] for item in evidence]
    weekly_hours = profile.get("weekly_free_hours")
    budget = profile.get("monthly_budget_amount")
    energy = _normalize_text(profile.get("energy_level")) or "unknown"
    constraints = (
        current_state.get("active_constraints")
        if isinstance(current_state.get("active_constraints"), list)
        else []
    )

    use_guided_route = isinstance(budget, (int, float)) and budget >= 80000
    route_direct_label = "회화 직행 루트"
    route_support_label = "교정 루트" if use_guided_route else "입력 보강 루트"
    fallback_label = (
        "범위 축소 루트"
        if (isinstance(weekly_hours, (int, float)) and weekly_hours < 6)
        else "출력 유지 루트"
    )
    constraint_label = "에너지 변동 압력" if energy in {"low", "medium"} else "일정 충돌 압력"

    nodes = [
        {
            "id": "goal",
            "type": "goal",
            "label": title,
            "summary": "원어민과의 실제 대화를 감당할 수 있을 만큼 출력·이해·복구 능력을 함께 키우는 지도를 만듭니다.",
            "data": {"success_criteria": success_criteria},
            "scores": {
                "time_load": 0.52,
                "money_load": 0.34,
                "energy_load": 0.42,
                "uncertainty": 0.41,
            },
            "evidence_refs": [],
            "assumption_refs": ["assumption_consistency"],
        },
        {
            "id": "route_output",
            "type": "route",
            "label": route_direct_label,
            "summary": "초반부터 말하기 비중을 올려 회화 감각을 빠르게 붙이는 루트입니다.",
            "data": {
                "fit_reason": "대화 가능 수준이 목표라면 출력 루프를 뒤로 미루지 않는 편이 유리합니다."
            },
            "scores": {
                "time_load": 0.72,
                "money_load": 0.28,
                "energy_load": 0.68,
                "uncertainty": 0.46,
            },
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "route_support",
            "type": "route",
            "label": route_support_label,
            "summary": "직행 루트의 이탈 위험을 줄이기 위해 입력 보강이나 교정을 붙이는 안정화 루트입니다.",
            "data": {"fit_reason": "혼자 공부하다 막히는 구간을 줄여 지속성을 확보합니다."},
            "scores": {
                "time_load": 0.58,
                "money_load": 0.48 if use_guided_route else 0.22,
                "energy_load": 0.46,
                "uncertainty": 0.31,
            },
            "evidence_refs": evidence_ids[1:2],
            "assumption_refs": [],
        },
        {
            "id": "route_micro",
            "type": "route",
            "label": "마이크로 회화 루트",
            "summary": "긴 공부 시간이 깨져도 하루 10~15분 음성 출력으로 말문만은 유지하는 저마찰 루트입니다.",
            "data": {
                "fit_reason": "야근이나 피로가 있어도 완전 중단 대신 아주 작은 회화 반복을 남깁니다."
            },
            "scores": {
                "time_load": 0.24,
                "money_load": 0.08,
                "energy_load": 0.22,
                "uncertainty": 0.37,
            },
            "evidence_refs": evidence_ids[3:4],
            "assumption_refs": [],
        },
        {
            "id": "route_exchange",
            "type": "route",
            "label": "언어교환 루트",
            "summary": "돈을 많이 쓰기 어렵다면 공개 커뮤니티나 언어교환으로 실제 반응을 받는 루트입니다.",
            "data": {
                "fit_reason": "교정 품질은 흔들릴 수 있지만 실제 대화 공포를 줄이는 데 유리합니다."
            },
            "scores": {
                "time_load": 0.49,
                "money_load": 0.12,
                "energy_load": 0.58,
                "uncertainty": 0.52,
            },
            "evidence_refs": evidence_ids[2:3],
            "assumption_refs": [],
        },
        {
            "id": "practice_loop",
            "type": "practice_system",
            "label": "주간 회화 루프",
            "summary": "암기·입력·출력을 한 주 안에서 순환시키는 실전 루프입니다.",
            "data": {"cadence": "어휘/패턴 누적 → 짧은 독백 → 실제 대화/모의 대화 → 복기"},
            "scores": {
                "time_load": 0.63,
                "money_load": 0.18,
                "energy_load": 0.55,
                "uncertainty": 0.27,
            },
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "environment",
            "type": "environment",
            "label": "원어민 노출 환경",
            "summary": "실제 원어민 반응을 주기적으로 받아야 회화 복구력이 붙습니다.",
            "data": {
                "setup": "주 1회 이상 원어민 대화, 언어교환, 튜터링, 혹은 음성 피드백 경로를 확보합니다."
            },
            "scores": {
                "time_load": 0.34,
                "money_load": 0.39 if use_guided_route else 0.16,
                "energy_load": 0.48,
                "uncertainty": 0.33,
            },
            "evidence_refs": evidence_ids[2:3],
            "assumption_refs": [],
        },
        {
            "id": "checkpoint",
            "type": "checkpoint",
            "label": "원어민 15분 점검",
            "summary": "실제 대화를 15분 이상 이어가며 막히는 지점을 수집하는 첫 검증 지점입니다.",
            "data": {
                "checkpoint": "모르는 표현이 나와도 일본어로 우회 설명하며 대화를 끊지 않는지 확인합니다."
            },
            "scores": {
                "time_load": 0.22,
                "money_load": 0.18,
                "energy_load": 0.42,
                "uncertainty": 0.19,
            },
            "evidence_refs": evidence_ids[3:4],
            "assumption_refs": [],
        },
        {
            "id": "constraint",
            "type": "constraint",
            "label": constraint_label,
            "summary": "회화형 목표는 집중 시간이 흔들리면 먼저 출력 루프가 무너지는 경향이 있습니다.",
            "data": {
                "impact": "복습만 남고 실제 말하기가 밀리면 체감 성장이 느려져 동기 저하가 커집니다."
            },
            "scores": {
                "time_load": 0.51,
                "money_load": 0.12,
                "energy_load": 0.61,
                "uncertainty": 0.44,
            },
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "risk_boredom",
            "type": "risk",
            "label": "입력만 쌓이는 리스크",
            "summary": "단어장과 강의만 늘어나면 실제 대화 경험은 부족한데 공부한 느낌만 커질 수 있습니다.",
            "data": {
                "mitigation": "매주 녹음, 짧은 독백, 실제 대화 중 하나를 남겨 출력 흔적을 확인합니다."
            },
            "scores": {
                "time_load": 0.36,
                "money_load": 0.08,
                "energy_load": 0.52,
                "uncertainty": 0.49,
            },
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "opportunity_cost",
            "type": "opportunity_cost",
            "label": "대화 노출 지연 비용",
            "summary": "완벽히 준비될 때까지 사람과 말하지 않으면 발화 공포를 줄이는 기회를 계속 미룹니다.",
            "data": {"cost": "문법 정확도는 올라가도 실전 복구력과 즉흥 반응은 늦게 붙습니다."},
            "scores": {
                "time_load": 0.28,
                "money_load": 0.18,
                "energy_load": 0.48,
                "uncertainty": 0.47,
            },
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "switch_condition",
            "type": "switch_condition",
            "label": "6주차 전환 조건",
            "summary": "6주 동안 말하기 세션이 두 번 이상 깨지면 루트 강도를 줄이거나 대화 환경을 바꿉니다.",
            "data": {
                "signal": "출력 회피, 복습만 반복, 대화 후 복기 누락 중 둘 이상이 반복될 때 전환합니다."
            },
            "scores": {
                "time_load": 0.2,
                "money_load": 0.11,
                "energy_load": 0.28,
                "uncertainty": 0.32,
            },
            "evidence_refs": evidence_ids[1:2],
            "assumption_refs": [],
        },
        {
            "id": "fallback",
            "type": "fallback_route",
            "label": fallback_label,
            "summary": "목표를 버리지 않고 대화 범위를 줄여서 출력 감각만은 유지하는 우회 루트입니다.",
            "data": {
                "trigger": "주 2회 이상 출력 세션이 깨지면 자유회화 대신 짧은 주제 회화나 스크립트 회화로 축소합니다."
            },
            "scores": {
                "time_load": 0.29,
                "money_load": 0.15,
                "energy_load": 0.25,
                "uncertainty": 0.24,
            },
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
                "data": {
                    "exit_test": "원어민과 30분 동안 일상·흥미·계획 주제를 오가며 대화합니다."
                },
                "scores": {
                    "time_load": 0.38,
                    "money_load": 0.2,
                    "energy_load": 0.56,
                    "uncertainty": 0.22,
                },
                "evidence_refs": evidence_ids[1:2],
                "assumption_refs": [],
            }
        )

    edges = [
        {
            "id": "e1",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_output",
            "label": "출력 우선",
        },
        {
            "id": "e2",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_support",
            "label": "안정화 보조",
        },
        {
            "id": "e3",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_micro",
            "label": "저마찰 유지",
        },
        {
            "id": "e4",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_exchange",
            "label": "실전 반응 확보",
        },
        {
            "id": "e5",
            "type": "progresses_to",
            "source": "goal",
            "target": "opportunity_cost",
            "label": "미루는 비용",
        },
        {"id": "e6", "type": "progresses_to", "source": "route_output", "target": "practice_loop"},
        {"id": "e7", "type": "progresses_to", "source": "route_output", "target": "risk_boredom"},
        {"id": "e8", "type": "progresses_to", "source": "route_support", "target": "environment"},
        {"id": "e9", "type": "progresses_to", "source": "route_micro", "target": "practice_loop"},
        {"id": "e10", "type": "progresses_to", "source": "route_exchange", "target": "environment"},
        {"id": "e11", "type": "progresses_to", "source": "practice_loop", "target": "checkpoint"},
        {"id": "e12", "type": "progresses_to", "source": "environment", "target": "checkpoint"},
        {
            "id": "e13",
            "type": "progresses_to",
            "source": "checkpoint",
            "target": "switch_condition",
        },
        {
            "id": "e14",
            "type": "progresses_to",
            "source": "constraint",
            "target": "switch_condition",
        },
        {"id": "e15", "type": "progresses_to", "source": "switch_condition", "target": "fallback"},
        {"id": "e16", "type": "progresses_to", "source": "risk_boredom", "target": "fallback"},
    ]

    if any(node["id"] == "milestone" for node in nodes):
        edges.append(
            {
                "id": "e17",
                "type": "progresses_to",
                "source": "checkpoint",
                "target": "milestone",
                "label": "유지 성공",
            }
        )

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
                {
                    "id": "progresses_to",
                    "label": "진행",
                    "role": "progression",
                    "default_style": {"line": "curved"},
                },
                {
                    "id": "supported_by",
                    "label": "근거",
                    "role": "reference",
                    "default_style": {"line": "dotted"},
                },
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


def _generic_stub_bundle(
    goal: dict[str, Any], evidence: list[dict[str, Any]], family: str
) -> dict[str, Any]:
    title = _normalize_text(goal.get("title")) or "새 목표"
    success_criteria = (
        _normalize_text(goal.get("success_criteria")) or "목표 달성 조건을 명확히 정의합니다."
    )
    goal_id = _normalize_text(goal.get("id")) or "stub-goal"
    evidence_ids = [item["id"] for item in evidence]
    route_labels_by_family = {
        "product": (
            "핵심 구조 루트",
            "검증 루트",
            "저비용 실험 루트",
            "협업/멘토 루트",
            "스코프 축소 루트",
        ),
        "fitness": ("적응 루트", "회복 루트", "짧은 루틴 루트", "코칭 루트", "부하 축소 루트"),
        "career": (
            "직접 도전 루트",
            "포트폴리오 보강 루트",
            "작은 프로젝트 루트",
            "네트워크 루트",
            "범위 재설계 루트",
        ),
        "relocation": (
            "준비 루트",
            "행정 보강 루트",
            "저비용 탐색 루트",
            "지원망 구축 루트",
            "우회 정착 루트",
        ),
        "general": (
            "직행 루트",
            "가이드 루트",
            "작은 실험 루트",
            "지원 확보 루트",
            "범위 축소 루트",
        ),
    }
    (
        route_primary,
        route_secondary,
        route_micro,
        route_support,
        route_fallback,
    ) = route_labels_by_family.get(family, route_labels_by_family["general"])

    nodes = [
        {
            "id": "goal",
            "type": "goal",
            "label": title,
            "summary": "현재 목표를 기준으로 실행 가능한 루트 후보를 정렬합니다.",
            "data": {"success_criteria": success_criteria},
            "scores": {
                "time_load": 0.45,
                "money_load": 0.33,
                "energy_load": 0.38,
                "uncertainty": 0.39,
            },
            "evidence_refs": [],
            "assumption_refs": ["assumption_capacity"],
        },
        {
            "id": "route_primary",
            "type": "route",
            "label": route_primary,
            "summary": "목표를 정면으로 밀어붙이는 주 경로입니다.",
            "data": {
                "fit_reason": "핵심 진전을 가장 빨리 만들지만 유지 조건이 흔들리면 리스크가 커집니다."
            },
            "scores": {
                "time_load": 0.67,
                "money_load": 0.31,
                "energy_load": 0.62,
                "uncertainty": 0.43,
            },
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "route_secondary",
            "type": "route",
            "label": route_secondary,
            "summary": "직행 경로의 실패 확률을 낮추기 위한 안정화 경로입니다.",
            "data": {"fit_reason": "속도보다 유지 가능성과 시행착오 축소를 우선할 때 유리합니다."},
            "scores": {
                "time_load": 0.54,
                "money_load": 0.42,
                "energy_load": 0.48,
                "uncertainty": 0.29,
            },
            "evidence_refs": evidence_ids[1:2],
            "assumption_refs": [],
        },
        {
            "id": "route_micro",
            "type": "route",
            "label": route_micro,
            "summary": "큰 결심 대신 작고 빠른 실험을 반복해서 목표가 현실과 맞는지 확인하는 루트입니다.",
            "data": {
                "fit_reason": "불확실성이 크거나 시간이 부족할 때 전체 계획을 작게 검증합니다."
            },
            "scores": {
                "time_load": 0.28,
                "money_load": 0.16,
                "energy_load": 0.25,
                "uncertainty": 0.36,
            },
            "evidence_refs": evidence_ids[2:3],
            "assumption_refs": [],
        },
        {
            "id": "route_support",
            "type": "route",
            "label": route_support,
            "summary": "혼자 밀어붙이지 않고 피드백, 동료, 멘토, 도구를 붙여 유지 비용을 낮추는 루트입니다.",
            "data": {
                "fit_reason": "반복 실패나 판단 공백이 큰 목표일수록 외부 피드백이 route drift를 줄입니다."
            },
            "scores": {
                "time_load": 0.46,
                "money_load": 0.38,
                "energy_load": 0.42,
                "uncertainty": 0.33,
            },
            "evidence_refs": evidence_ids[1:2],
            "assumption_refs": [],
        },
        {
            "id": "checkpoint",
            "type": "checkpoint",
            "label": "첫 검증 시점",
            "summary": "지금 선택한 루트가 유지 가능한지 확인하는 첫 지점입니다.",
            "data": {"checkpoint": "실제 투입량과 반복 가능성을 함께 확인합니다."},
            "scores": {
                "time_load": 0.18,
                "money_load": 0.08,
                "energy_load": 0.24,
                "uncertainty": 0.2,
            },
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "constraint",
            "type": "constraint",
            "label": "핵심 제약 압력",
            "summary": "시간, 예산, 에너지, 맥락 중 하나가 줄면 주 경로가 먼저 흔들립니다.",
            "data": {"impact": "전환 신호를 늦게 보면 전체 계획이 무너질 수 있습니다."},
            "scores": {
                "time_load": 0.42,
                "money_load": 0.3,
                "energy_load": 0.55,
                "uncertainty": 0.46,
            },
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "risk",
            "type": "risk",
            "label": "초기 과부하 리스크",
            "summary": "처음부터 가장 무거운 루트를 택하면 시작은 빨라도 중간 이탈 비용이 커질 수 있습니다.",
            "data": {
                "mitigation": "2주 단위로 실제 투입량과 회복 시간을 같이 기록해 과부하를 빨리 감지합니다."
            },
            "scores": {
                "time_load": 0.5,
                "money_load": 0.2,
                "energy_load": 0.66,
                "uncertainty": 0.48,
            },
            "evidence_refs": evidence_ids[:1],
            "assumption_refs": [],
        },
        {
            "id": "opportunity_cost",
            "type": "opportunity_cost",
            "label": "기회비용 노드",
            "summary": "한 루트에 시간을 묶는 동안 더 저렴하거나 빠른 검증 경로를 놓칠 수 있습니다.",
            "data": {"cost": "한 달 이상 한 경로만 밀기 전에 작게 대조 실험할 route를 남깁니다."},
            "scores": {
                "time_load": 0.26,
                "money_load": 0.2,
                "energy_load": 0.31,
                "uncertainty": 0.44,
            },
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "switch_condition",
            "type": "switch_condition",
            "label": "전환 판단 조건",
            "summary": "실제 실행 데이터가 기대와 어긋날 때 주 경로를 약화하거나 우회 루트를 활성화합니다.",
            "data": {
                "signal": "2회 연속 checkpoint 미달, 비용 초과, 에너지 고갈 중 하나가 반복될 때 전환합니다."
            },
            "scores": {
                "time_load": 0.22,
                "money_load": 0.1,
                "energy_load": 0.26,
                "uncertainty": 0.31,
            },
            "evidence_refs": [],
            "assumption_refs": [],
        },
        {
            "id": "fallback",
            "type": "fallback_route",
            "label": route_fallback,
            "summary": "목표 전체를 버리지 않고 범위나 속도를 조정하는 우회 경로입니다.",
            "data": {"trigger": "두 차례 이상 계획 리듬이 깨지면 이 전환 루트를 검토합니다."},
            "scores": {
                "time_load": 0.32,
                "money_load": 0.18,
                "energy_load": 0.28,
                "uncertainty": 0.25,
            },
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
                "scores": {
                    "time_load": 0.34,
                    "money_load": 0.18,
                    "energy_load": 0.36,
                    "uncertainty": 0.24,
                },
                "evidence_refs": evidence_ids[2:3],
                "assumption_refs": [],
            }
        )

    if not any(node["id"] == "milestone" for node in nodes):
        nodes.append(
            {
                "id": "milestone",
                "type": "milestone",
                "label": "중간 마일스톤",
                "summary": "목표가 계속 유효한지 판단하는 중간 성취 지점입니다.",
                "data": {
                    "exit_test": "작은 실험 결과를 바탕으로 루트 유지, 전환, 축소 중 하나를 고릅니다."
                },
                "scores": {
                    "time_load": 0.3,
                    "money_load": 0.14,
                    "energy_load": 0.34,
                    "uncertainty": 0.28,
                },
                "evidence_refs": [],
                "assumption_refs": [],
            }
        )

    edges = [
        {
            "id": "e1",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_primary",
            "label": "빠른 시작",
        },
        {
            "id": "e2",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_secondary",
            "label": "안정적 시작",
        },
        {
            "id": "e3",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_micro",
            "label": "작은 실험",
        },
        {
            "id": "e4",
            "type": "progresses_to",
            "source": "goal",
            "target": "route_support",
            "label": "지원 확보",
        },
        {
            "id": "e5",
            "type": "progresses_to",
            "source": "goal",
            "target": "opportunity_cost",
            "label": "놓치는 것",
        },
        {"id": "e6", "type": "progresses_to", "source": "route_primary", "target": "checkpoint"},
        {"id": "e7", "type": "progresses_to", "source": "route_primary", "target": "risk"},
        {"id": "e8", "type": "progresses_to", "source": "route_secondary", "target": "checkpoint"},
        {"id": "e9", "type": "progresses_to", "source": "route_micro", "target": "milestone"},
        {"id": "e10", "type": "progresses_to", "source": "route_support", "target": "checkpoint"},
        {
            "id": "e11",
            "type": "progresses_to",
            "source": "checkpoint",
            "target": "switch_condition",
        },
        {
            "id": "e12",
            "type": "progresses_to",
            "source": "constraint",
            "target": "switch_condition",
        },
        {"id": "e13", "type": "progresses_to", "source": "risk", "target": "fallback"},
        {"id": "e14", "type": "progresses_to", "source": "switch_condition", "target": "fallback"},
    ]
    if evidence_ids[2:3]:
        edges.append(
            {
                "id": "e15",
                "type": "progresses_to",
                "source": "checkpoint",
                "target": "milestone",
                "label": "중간 통과",
            }
        )

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
                {
                    "id": "progresses_to",
                    "label": "진행",
                    "role": "progression",
                    "default_style": {"line": "curved"},
                },
                {
                    "id": "supported_by",
                    "label": "근거",
                    "role": "reference",
                    "default_style": {"line": "dotted"},
                },
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

    is_deterministic_fallback = True

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
            raise ProviderInvocationError(
                "The deterministic stub provider cannot generate Pathway intake questions."
            )
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
        current_bundle = (
            _extract_json_block(content, "Current graph bundle:", "Recent state updates:") or {}
        )
        goal = _extract_json_block(content, "Goal:", "Default profile:") or {}
        goal_id = str(
            goal.get("id") or current_bundle.get("map", {}).get("goal_id") or "stub-goal"
        ).strip()
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
                    "fields": [
                        {
                            "key": "trigger",
                            "label": "발화 조건",
                            "value_type": "markdown",
                            "required": False,
                        }
                    ],
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
                    "data": {
                        "trigger": "최근 변경으로 불가능해진 지점부터 작은 단위로 다시 연결합니다."
                    },
                    "scores": {"time_load": 0.29, "money_load": 0.18, "uncertainty": 0.34},
                    "evidence_refs": [],
                    "assumption_refs": [],
                    "status": "proposed",
                    "revision_meta": {
                        "change_note": "현실 변경 요청으로 새 브랜치가 추가되었습니다."
                    },
                }
            )

        if pressure_node is not None and not any(
            edge.get("target") == recovery_node_id for edge in edges
        ):
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
        warnings = list(
            dict.fromkeys([*warnings, "최근 현실 업데이트를 반영한 스텁 리비전 미리보기입니다."])
        )

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


def build_llm_provider(settings: Settings) -> CodexCliProvider | StubPathwayProvider:
    provider_name = settings.llm_provider.strip().lower()
    if provider_name == "stub":
        return StubPathwayProvider()
    if provider_name == "codex":
        return CodexCliProvider(settings)
    raise AppConfigurationError(
        f"Unsupported LLM provider '{settings.llm_provider}'. Use 'stub' or 'codex'."
    )
