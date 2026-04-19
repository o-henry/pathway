from __future__ import annotations

from collections.abc import Sequence


class FakeEmbeddingProvider:
    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._embed(text) for text in texts]

    def _embed(self, text: str) -> list[float]:
        lowered = text.lower()
        japanese_terms = ["일본어", "japanese", "회화", "speaking", "anki", "travel"]
        fitness_terms = ["운동", "fitness", "strength", "cardio", "근력"]
        money_terms = ["예산", "budget", "money", "cost", "비용"]
        return [
            float(sum(term in lowered for term in japanese_terms)),
            float(sum(term in lowered for term in fitness_terms)),
            float(sum(term in lowered for term in money_terms)),
        ]
