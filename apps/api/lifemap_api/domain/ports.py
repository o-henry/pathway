from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from lifemap_api.domain.models import (
    CheckIn,
    CheckInCreate,
    Goal,
    GoalCreate,
    GoalUpdate,
    LifeMap,
    LifeMapCreate,
    Profile,
    ProfileUpsert,
    SourceChunk,
    SourceChunkCreate,
    SourceDocument,
    SourceDocumentCreate,
    SourceSearchHit,
)


class LLMProvider(Protocol):
    def generate_structured_json(
        self,
        *,
        messages: Sequence[dict[str, str]],
        json_schema: dict,
        schema_name: str,
    ) -> str: ...


class EmbeddingProvider(Protocol):
    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]: ...


class ProfileRepository(Protocol):
    def get_default(self) -> Profile | None: ...

    def upsert_default(self, payload: ProfileUpsert) -> Profile: ...


class GoalRepository(Protocol):
    def list(self) -> list[Goal]: ...

    def get(self, goal_id: str) -> Goal | None: ...

    def create(self, payload: GoalCreate) -> Goal: ...

    def update(self, goal_id: str, payload: GoalUpdate) -> Goal | None: ...

    def delete(self, goal_id: str) -> bool: ...


class LifeMapRepository(Protocol):
    def get(self, map_id: str) -> LifeMap | None: ...

    def create(self, payload: LifeMapCreate) -> LifeMap: ...


class SourceRepository(Protocol):
    def list(self) -> list[SourceDocument]: ...

    def get(self, source_id: str) -> SourceDocument | None: ...

    def find_by_content_hash(self, content_hash: str) -> SourceDocument | None: ...

    def create_manual(self, payload: SourceDocumentCreate) -> SourceDocument: ...


class SourceChunkRepository(Protocol):
    def list_for_source(self, source_id: str) -> list[SourceChunk]: ...

    def replace_for_source(
        self, source_id: str, payloads: Sequence[SourceChunkCreate]
    ) -> list[SourceChunk]: ...


class SourceSearchIndex(Protocol):
    def upsert_source_chunks(
        self,
        *,
        source: SourceDocument,
        chunks: Sequence[SourceChunk],
        embeddings: Sequence[list[float]],
    ) -> None: ...

    def search(self, *, query_embedding: list[float], limit: int) -> list[SourceSearchHit]: ...


class CheckInRepository(Protocol):
    def list_for_goal(self, goal_id: str) -> list[CheckIn]: ...

    def create(self, goal_id: str, payload: CheckInCreate) -> CheckIn: ...
