from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from lifemap_api.domain.graph_bundle import GraphBundle

GoalStatus = Literal["draft", "active", "paused", "completed", "archived"]
SourcePolicyState = Literal[
    "manual_note",
    "user_uploaded_file",
    "public_url_allowed",
    "public_url_metadata",
    "blocked_by_policy",
    "requires_user_review",
]


def utc_now() -> datetime:
    return datetime.now(UTC)


class DomainModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ProfileBase(DomainModel):
    display_name: str = Field(min_length=1, max_length=100)
    age: int | None = Field(default=None, ge=0, le=120)
    weekly_free_hours: float | None = Field(default=None, ge=0)
    monthly_budget_amount: float | None = Field(default=None, ge=0)
    monthly_budget_currency: str | None = Field(default=None, min_length=3, max_length=10)
    energy_level: str | None = Field(default=None, min_length=1, max_length=40)
    preference_tags: list[str] = Field(default_factory=list)
    constraints: dict[str, Any] = Field(default_factory=dict)


class ProfileUpsert(ProfileBase):
    pass


class Profile(ProfileBase):
    id: str = "default"
    created_at: datetime
    updated_at: datetime


class GoalBase(DomainModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    category: str = Field(default="general", min_length=1, max_length=60)
    deadline: date | None = None
    success_criteria: str = Field(min_length=1)
    status: GoalStatus = "draft"


class GoalCreate(GoalBase):
    profile_id: str = "default"


class GoalUpdate(DomainModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    category: str | None = Field(default=None, min_length=1, max_length=60)
    deadline: date | None = None
    success_criteria: str | None = Field(default=None, min_length=1)
    status: GoalStatus | None = None


class Goal(GoalBase):
    id: str
    profile_id: str
    created_at: datetime
    updated_at: datetime


class LifeMapCreate(DomainModel):
    goal_id: str
    title: str = Field(min_length=1, max_length=200)
    graph_bundle: GraphBundle


class LifeMap(DomainModel):
    id: str
    goal_id: str
    title: str
    graph_bundle: GraphBundle
    created_at: datetime
    updated_at: datetime


class SourceDocumentCreate(DomainModel):
    title: str = Field(min_length=1, max_length=200)
    content_text: str = Field(min_length=1)
    url: str | None = None
    source_type: SourcePolicyState = "manual_note"
    metadata: dict[str, Any] = Field(default_factory=dict)


class SourceDocument(DomainModel):
    id: str
    title: str
    content_text: str
    url: str | None = None
    source_type: SourcePolicyState
    content_hash: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class SourceChunk(DomainModel):
    id: str
    source_id: str
    chunk_index: int
    text: str
    token_estimate: int = Field(ge=0)
    metadata: dict[str, Any] = Field(default_factory=dict)
    embedding_status: str = "pending"
    created_at: datetime


class CheckInCreate(DomainModel):
    map_id: str | None = None
    checkin_date: date = Field(default_factory=date.today)
    actual_time_spent: float | None = Field(default=None, ge=0)
    actual_money_spent: float | None = Field(default=None, ge=0)
    mood: str | None = Field(default=None, max_length=60)
    progress_summary: str = Field(min_length=1)
    blockers: str = ""
    next_adjustment: str = ""


class CheckIn(DomainModel):
    id: str
    goal_id: str
    map_id: str | None = None
    checkin_date: date
    actual_time_spent: float | None = None
    actual_money_spent: float | None = None
    mood: str | None = None
    progress_summary: str
    blockers: str
    next_adjustment: str
    created_at: datetime


class Decision(DomainModel):
    id: str
    goal_id: str
    map_id: str
    node_id: str
    decision_text: str
    selected_at: datetime = Field(default_factory=utc_now)
    metadata: dict[str, Any] = Field(default_factory=dict)
