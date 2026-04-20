from __future__ import annotations

from collections.abc import Sequence

import httpx

from lifemap_api.application.errors import ProviderInvocationError
from lifemap_api.config import Settings


class OllamaEmbeddingProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        payload = {
            "model": self._settings.ollama_embedding_model,
            "input": list(texts),
            "truncate": True,
        }

        try:
            with httpx.Client(
                base_url=self._settings.ollama_base_url,
                timeout=self._settings.llm_request_timeout_seconds,
            ) as client:
                response = client.post("/api/embed", json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise ProviderInvocationError(f"Ollama embedding request failed: {exc}") from exc

        body = response.json()
        embeddings = body.get("embeddings")
        if not isinstance(embeddings, list) or not embeddings:
            raise ProviderInvocationError("Ollama embedding response did not include embeddings")

        normalized_embeddings: list[list[float]] = []
        for embedding in embeddings:
            if not isinstance(embedding, list) or not embedding:
                raise ProviderInvocationError(
                    "Ollama embedding response returned an invalid vector"
                )
            normalized_embeddings.append([float(value) for value in embedding])

        return normalized_embeddings


class DeterministicEmbeddingProvider:
    """Tiny local fallback used when no embedding backend is configured yet."""

    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def _embed(self, text: str) -> list[float]:
        lowered = text.lower()
        route_terms = ["route", "goal", "path", "루트", "경로", "목표", "graph", "그래프"]
        resource_terms = ["budget", "time", "money", "cost", "예산", "시간", "비용"]
        adaptation_terms = ["change", "update", "risk", "block", "revision", "변경", "리비전", "장애", "리스크"]
        return [
            float(sum(term in lowered for term in route_terms)),
            float(sum(term in lowered for term in resource_terms)),
            float(sum(term in lowered for term in adaptation_terms)),
        ]
