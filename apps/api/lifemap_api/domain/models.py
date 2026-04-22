from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from lifemap_api.domain.graph_bundle import GraphBundle

GoalStatus = Literal["draft", "active", "paused", "completed", "archived"]
RevisionProposalStatus = Literal["pending", "accepted", "rejected"]
ResourceDimensionKind = Literal[
    "time",
    "money",
    "energy",
    "motivation",
    "skill",
    "environment",
    "schedule",
    "support",
    "location",
    "tooling",
    "practice",
]
RevisionChangeKind = Literal[
    "unchanged",
    "added",
    "strengthened",
    "weakened",
    "invalidated",
    "reactivated",
    "removed",
]
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


class ResourceDimension(DomainModel):
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=120)
    kind: ResourceDimensionKind
    value_type: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=1)
    relevance_reason: str = Field(min_length=1)


class GoalAnalysis(DomainModel):
    goal_id: str = Field(min_length=1, max_length=200)
    analysis_summary: str = Field(min_length=1)
    resource_dimensions: list[ResourceDimension] = Field(default_factory=list)
    research_questions: list[str] = Field(default_factory=list)


class CurrentStateBase(DomainModel):
    interview_answers: dict[str, Any] = Field(default_factory=dict)
    resource_values: dict[str, Any] = Field(default_factory=dict)
    active_constraints: list[str] = Field(default_factory=list)
    state_summary: str = Field(min_length=1)
    derived_from_update_ids: list[str] = Field(default_factory=list)


class CurrentStateSnapshotUpsert(CurrentStateBase):
    pass


class CurrentStateSnapshot(CurrentStateBase):
    id: str
    goal_id: str
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


class MapExportEnvelope(DomainModel):
    format_version: str = Field(default="1.0.0", min_length=1, max_length=20)
    exported_at: datetime
    profile: Profile | None = None
    goal: Goal
    map: LifeMap


class MapImportEnvelope(DomainModel):
    format_version: str = Field(default="1.0.0", min_length=1, max_length=20)
    exported_at: datetime | None = None
    profile: Profile | None = None
    goal: Goal
    map: LifeMap


class PathwayRecord(LifeMap):
    pass


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


class SourceChunkCreate(DomainModel):
    source_id: str
    chunk_index: int = Field(ge=0)
    text: str = Field(min_length=1)
    token_estimate: int = Field(default=0, ge=0)
    metadata: dict[str, Any] = Field(default_factory=dict)
    embedding_status: str = "pending"


class SourceSearchHit(DomainModel):
    chunk_id: str
    source_id: str
    title: str
    url: str | None = None
    snippet: str
    similarity_score: float = Field(ge=0)
    reliability: str = Field(min_length=1, max_length=80)
    source_type: SourcePolicyState
    metadata: dict[str, Any] = Field(default_factory=dict)
    source_created_at: datetime | None = None


class SourceUrlPreviewRequest(DomainModel):
    url: str = Field(min_length=1, max_length=2000)


class SourceUrlIngestRequest(DomainModel):
    url: str = Field(min_length=1, max_length=2000)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    metadata: dict[str, Any] = Field(default_factory=dict)
    collector_preference: str | None = Field(default=None, min_length=1, max_length=80)


class SourceUrlPreview(DomainModel):
    url: str
    normalized_url: str | None = None
    policy_state: SourcePolicyState
    reason: str = Field(min_length=1)
    fetch_allowed: bool = False
    metadata_only: bool = False
    domain: str | None = None


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


class StateUpdateCreate(DomainModel):
    pathway_id: str | None = None
    update_date: date = Field(default_factory=date.today)
    actual_time_spent: float | None = Field(default=None, ge=0)
    actual_money_spent: float | None = Field(default=None, ge=0)
    mood: str | None = Field(default=None, max_length=60)
    progress_summary: str = Field(min_length=1)
    blockers: str = ""
    next_adjustment: str = ""
    resource_deltas: dict[str, Any] = Field(default_factory=dict)
    learned_items: list[str] = Field(default_factory=list)
    source_refs: list[str] = Field(default_factory=list)


class StateUpdate(DomainModel):
    id: str
    goal_id: str
    pathway_id: str | None = None
    legacy_checkin_id: str | None = None
    update_date: date
    actual_time_spent: float | None = None
    actual_money_spent: float | None = None
    mood: str | None = None
    progress_summary: str
    blockers: str
    next_adjustment: str
    resource_deltas: dict[str, Any] = Field(default_factory=dict)
    learned_items: list[str] = Field(default_factory=list)
    source_refs: list[str] = Field(default_factory=list)
    created_at: datetime


class RouteSelectionUpsert(DomainModel):
    selected_node_id: str = Field(min_length=1, max_length=200)
    rationale: str = ""


class RouteSelection(DomainModel):
    id: str
    goal_id: str
    pathway_id: str
    selected_node_id: str
    rationale: str = ""
    created_at: datetime
    updated_at: datetime


class GraphNodeChange(DomainModel):
    node_id: str = Field(min_length=1, max_length=120)
    change_type: Literal["added", "removed", "updated", "status_changed"]
    label: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1)
    previous_status: str | None = Field(default=None, min_length=1, max_length=80)
    next_status: str | None = Field(default=None, min_length=1, max_length=80)
    fields_changed: list[str] = Field(default_factory=list)


class GraphEdgeChange(DomainModel):
    edge_id: str = Field(min_length=1, max_length=120)
    change_type: Literal["added", "removed", "updated"]
    source: str = Field(min_length=1, max_length=120)
    target: str = Field(min_length=1, max_length=120)
    label: str | None = None
    reason: str = Field(min_length=1)


class GraphWarningChange(DomainModel):
    change_type: Literal["added", "removed"]
    warning: str = Field(min_length=1)


class GraphDiff(DomainModel):
    summary: list[str] = Field(default_factory=list)
    node_changes: list[GraphNodeChange] = Field(default_factory=list)
    edge_changes: list[GraphEdgeChange] = Field(default_factory=list)
    warning_changes: list[GraphWarningChange] = Field(default_factory=list)


class RevisionProposalCreate(DomainModel):
    goal_id: str = Field(min_length=1, max_length=200)
    source_map_id: str = Field(min_length=1, max_length=200)
    checkin_id: str = Field(min_length=1, max_length=200)
    rationale: str = Field(min_length=1)
    diff: GraphDiff
    proposed_graph_bundle: GraphBundle


class RevisionProposalRequest(DomainModel):
    checkin_id: str = Field(min_length=1, max_length=200)


class RevisionProposalDecision(DomainModel):
    note: str = ""


class RevisionProposal(DomainModel):
    id: str
    goal_id: str
    source_map_id: str
    checkin_id: str
    status: RevisionProposalStatus = "pending"
    rationale: str
    diff: GraphDiff
    proposed_graph_bundle: GraphBundle
    accepted_map_id: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class PathwayRevisionPreview(RevisionProposal):
    selected_route_node_id: str | None = None


class Decision(DomainModel):
    id: str
    goal_id: str
    map_id: str
    node_id: str
    decision_text: str
    selected_at: datetime = Field(default_factory=utc_now)
    metadata: dict[str, Any] = Field(default_factory=dict)
