from __future__ import annotations

from collections.abc import Sequence
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


def build_llm_provider(settings: Settings) -> OllamaProvider | OpenAIProvider:
    provider_name = settings.llm_provider.strip().lower()
    if provider_name == "ollama":
        return OllamaProvider(settings)
    if provider_name == "openai":
        return OpenAIProvider(settings)
    raise AppConfigurationError(
        f"Unsupported LLM provider '{settings.llm_provider}'. Use 'ollama' or 'openai'."
    )
