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
