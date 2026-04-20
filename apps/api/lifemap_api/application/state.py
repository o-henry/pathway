from __future__ import annotations

from typing import Any

from lifemap_api.application.errors import EntityNotFoundError, GenerationFailedError
from lifemap_api.domain.models import (
    CurrentStateSnapshot,
    CurrentStateSnapshotUpsert,
    Goal,
    RouteSelection,
    RouteSelectionUpsert,
    StateUpdate,
    StateUpdateCreate,
)
from lifemap_api.domain.ports import (
    CurrentStateSnapshotRepository,
    GoalRepository,
    LifeMapRepository,
    RouteSelectionRepository,
    StateUpdateRepository,
)


def _profile_seed(goal: Goal) -> dict[str, Any]:
    return {
        "goal_category": goal.category,
        "goal_status": goal.status,
    }


def _merge_constraints(
    existing_constraints: list[str], payload_constraints: list[str], deltas: dict[str, Any]
) -> list[str]:
    merged = list(dict.fromkeys(existing_constraints + payload_constraints))
    for key, value in deltas.items():
        if isinstance(value, str) and value.strip().lower() in {"blocked", "unavailable", "low"}:
            merged.append(f"{key}: {value}")
    return list(dict.fromkeys(item for item in merged if item))


def upsert_current_state(
    *,
    goal_id: str,
    goal_repo: GoalRepository,
    snapshot_repo: CurrentStateSnapshotRepository,
    payload: CurrentStateSnapshotUpsert,
) -> CurrentStateSnapshot:
    if goal_repo.get(goal_id) is None:
        raise EntityNotFoundError("Goal", goal_id)
    return snapshot_repo.upsert_for_goal(goal_id, payload)


def get_current_state(
    *,
    goal_id: str,
    goal_repo: GoalRepository,
    snapshot_repo: CurrentStateSnapshotRepository,
) -> CurrentStateSnapshot | None:
    if goal_repo.get(goal_id) is None:
        raise EntityNotFoundError("Goal", goal_id)
    return snapshot_repo.get_for_goal(goal_id)


def list_state_updates(
    *,
    goal_id: str,
    goal_repo: GoalRepository,
    state_update_repo: StateUpdateRepository,
) -> list[StateUpdate]:
    if goal_repo.get(goal_id) is None:
        raise EntityNotFoundError("Goal", goal_id)
    return state_update_repo.list_for_goal(goal_id)


def create_state_update(
    *,
    goal_id: str,
    payload: StateUpdateCreate,
    goal_repo: GoalRepository,
    pathway_repo: LifeMapRepository,
    state_update_repo: StateUpdateRepository,
    snapshot_repo: CurrentStateSnapshotRepository,
) -> StateUpdate:
    goal = goal_repo.get(goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", goal_id)
    if payload.pathway_id and pathway_repo.get(payload.pathway_id) is None:
        raise EntityNotFoundError("Pathway", payload.pathway_id)

    update = state_update_repo.create(goal_id, payload)
    existing_snapshot = snapshot_repo.get_for_goal(goal_id)
    existing_values = dict(existing_snapshot.resource_values) if existing_snapshot else _profile_seed(goal)
    existing_interview_answers = (
        dict(existing_snapshot.interview_answers) if existing_snapshot else {}
    )
    existing_constraints = list(existing_snapshot.active_constraints) if existing_snapshot else []
    existing_ids = list(existing_snapshot.derived_from_update_ids) if existing_snapshot else []
    merged_values = {**existing_values, **payload.resource_deltas}
    merged_constraints = _merge_constraints(
        existing_constraints,
        [],
        payload.resource_deltas,
    )
    snapshot_repo.upsert_for_goal(
        goal_id,
        CurrentStateSnapshotUpsert(
            interview_answers=existing_interview_answers,
            resource_values=merged_values,
            active_constraints=merged_constraints,
            state_summary=payload.progress_summary,
            derived_from_update_ids=existing_ids + [update.id],
        ),
    )
    return update


def get_route_selection(
    *,
    pathway_id: str,
    pathway_repo: LifeMapRepository,
    route_selection_repo: RouteSelectionRepository,
) -> RouteSelection | None:
    if pathway_repo.get(pathway_id) is None:
        raise EntityNotFoundError("Pathway", pathway_id)
    return route_selection_repo.get_for_pathway(pathway_id)


def upsert_route_selection(
    *,
    pathway_id: str,
    payload: RouteSelectionUpsert,
    pathway_repo: LifeMapRepository,
    route_selection_repo: RouteSelectionRepository,
) -> RouteSelection:
    pathway = pathway_repo.get(pathway_id)
    if pathway is None:
        raise EntityNotFoundError("Pathway", pathway_id)
    if not any(node.id == payload.selected_node_id for node in pathway.graph_bundle.nodes):
        raise GenerationFailedError(
            f"Selected route node {payload.selected_node_id} does not exist in the pathway graph."
        )
    return route_selection_repo.upsert_for_pathway(
        goal_id=pathway.goal_id,
        pathway_id=pathway_id,
        payload=payload,
    )
