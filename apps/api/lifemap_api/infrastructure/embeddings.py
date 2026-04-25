from __future__ import annotations

from collections.abc import Sequence


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
