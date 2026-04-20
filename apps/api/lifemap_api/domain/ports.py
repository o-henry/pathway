from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from lifemap_api.domain.models import (
    CheckIn,
    CheckInCreate,
    CurrentStateSnapshot,
    CurrentStateSnapshotUpsert,
    Goal,
    GoalAnalysis,
    GoalCreate,
    GoalUpdate,
    LifeMap,
    LifeMapCreate,
    Profile,
    ProfileUpsert,
    RevisionProposal,
    RevisionProposalCreate,
    RouteSelection,
    RouteSelectionUpsert,
    StateUpdate,
    StateUpdateCreate,
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


class GoalAnalysisRepository(Protocol):
    def get(self, goal_id: str) -> GoalAnalysis | None: ...

    def upsert(self, analysis: GoalAnalysis) -> GoalAnalysis: ...


class LifeMapRepository(Protocol):
    def get(self, map_id: str) -> LifeMap | None: ...

    def create(self, payload: LifeMapCreate) -> LifeMap: ...

    def list_for_goal(self, goal_id: str) -> list[LifeMap]: ...


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


class CurrentStateSnapshotRepository(Protocol):
    def get_for_goal(self, goal_id: str) -> CurrentStateSnapshot | None: ...

    def upsert_for_goal(
        self, goal_id: str, payload: CurrentStateSnapshotUpsert
    ) -> CurrentStateSnapshot: ...


class StateUpdateRepository(Protocol):
    def list_for_goal(self, goal_id: str) -> list[StateUpdate]: ...

    def create(self, goal_id: str, payload: StateUpdateCreate) -> StateUpdate: ...


class RouteSelectionRepository(Protocol):
    def get_for_pathway(self, pathway_id: str) -> RouteSelection | None: ...

    def upsert_for_pathway(
        self,
        *,
        goal_id: str,
        pathway_id: str,
        payload: RouteSelectionUpsert,
    ) -> RouteSelection: ...


class RevisionProposalRepository(Protocol):
    def get(self, proposal_id: str) -> RevisionProposal | None: ...

    def create(self, payload: RevisionProposalCreate) -> RevisionProposal: ...

    def update_status(
        self,
        proposal_id: str,
        *,
        status: str,
        accepted_map_id: str | None = None,
    ) -> RevisionProposal | None: ...
