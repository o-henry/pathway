from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import JSON, Column, Text
from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


class ProfileRecord(SQLModel, table=True):
    __tablename__ = "profiles"

    id: str = Field(primary_key=True)
    display_name: str
    age: int | None = None
    weekly_free_hours: float | None = None
    monthly_budget_amount: float | None = None
    monthly_budget_currency: str | None = None
    energy_level: str | None = None
    preference_tags_json: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    constraints_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class GoalRecord(SQLModel, table=True):
    __tablename__ = "goals"

    id: str = Field(primary_key=True)
    profile_id: str = Field(index=True)
    title: str
    description: str = ""
    category: str = "general"
    deadline: date | None = None
    success_criteria: str
    status: str = "draft"
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class LifeMapRecord(SQLModel, table=True):
    __tablename__ = "life_maps"

    id: str = Field(primary_key=True)
    goal_id: str = Field(index=True)
    title: str
    graph_bundle_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SourceDocumentRecord(SQLModel, table=True):
    __tablename__ = "sources"

    id: str = Field(primary_key=True)
    title: str
    url: str | None = None
    source_type: str
    content_text: str = Field(sa_column=Column(Text, nullable=False))
    content_hash: str = Field(index=True)
    metadata_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class SourceChunkRecord(SQLModel, table=True):
    __tablename__ = "source_chunks"

    id: str = Field(primary_key=True)
    source_id: str = Field(index=True)
    chunk_index: int
    text: str = Field(sa_column=Column(Text, nullable=False))
    token_estimate: int = 0
    metadata_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    embedding_status: str = "pending"
    created_at: datetime = Field(default_factory=utc_now)


class CheckInRecord(SQLModel, table=True):
    __tablename__ = "checkins"

    id: str = Field(primary_key=True)
    goal_id: str = Field(index=True)
    map_id: str | None = Field(default=None, index=True)
    checkin_date: date
    actual_time_spent: float | None = None
    actual_money_spent: float | None = None
    mood: str | None = None
    progress_summary: str = Field(sa_column=Column(Text, nullable=False))
    blockers: str = Field(default="", sa_column=Column(Text, nullable=False))
    next_adjustment: str = Field(default="", sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)


class RevisionProposalRecord(SQLModel, table=True):
    __tablename__ = "revision_proposals"

    id: str = Field(primary_key=True)
    goal_id: str = Field(index=True)
    source_map_id: str = Field(index=True)
    checkin_id: str = Field(index=True)
    status: str = Field(default="pending", index=True)
    rationale: str = Field(sa_column=Column(Text, nullable=False))
    diff_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    proposed_graph_bundle_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    accepted_map_id: str | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now)
    resolved_at: datetime | None = None


class DecisionRecord(SQLModel, table=True):
    __tablename__ = "decisions"

    id: str = Field(primary_key=True)
    goal_id: str = Field(index=True)
    map_id: str = Field(index=True)
    node_id: str
    decision_text: str = Field(sa_column=Column(Text, nullable=False))
    selected_at: datetime = Field(default_factory=utc_now)
    metadata_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
