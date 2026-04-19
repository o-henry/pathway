from __future__ import annotations

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
    SourceDocument,
    SourceDocumentCreate,
)


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

    def create_manual(self, payload: SourceDocumentCreate) -> SourceDocument: ...


class CheckInRepository(Protocol):
    def list_for_goal(self, goal_id: str) -> list[CheckIn]: ...

    def create(self, goal_id: str, payload: CheckInCreate) -> CheckIn: ...
