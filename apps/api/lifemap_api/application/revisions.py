from __future__ import annotations

import json
from textwrap import dedent

from pydantic import ValidationError

from lifemap_api.application.errors import EntityNotFoundError, GenerationFailedError
from lifemap_api.application.generation import (
    SCHEMA_NAME,
    _attach_missing_action_fields,
    _attach_missing_decision_evidence,
    _enforce_pathway_grounding,
    _serialize_goal,
    _serialize_profile,
)
from lifemap_api.application.generation_grounding import (
    build_grounding_packet,
    serialize_grounding_packet,
    validate_bundle_grounding,
)
from lifemap_api.application.graph_diff import build_graph_diff
from lifemap_api.domain.graph_bundle import GraphBundle, validate_graph_bundle
from lifemap_api.domain.models import (
    CurrentStateSnapshot,
    LifeMap,
    LifeMapCreate,
    Profile,
    RevisionProposal,
    RevisionProposalCreate,
    RouteSelection,
    StateUpdate,
)
from lifemap_api.domain.ports import (
    CurrentStateSnapshotRepository,
    EmbeddingProvider,
    GoalRepository,
    LifeMapRepository,
    LLMProvider,
    ProfileRepository,
    RevisionProposalRepository,
    RouteSelectionRepository,
    SourceSearchIndex,
    StateUpdateRepository,
)


def _serialize_map(life_map: LifeMap) -> str:
    return json.dumps(life_map.graph_bundle.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _serialize_state_updates(state_updates: list[StateUpdate]) -> str:
    if not state_updates:
        return "[]"
    return json.dumps(
        [update.model_dump(mode="json") for update in state_updates],
        ensure_ascii=False,
        indent=2,
    )


def _serialize_current_state(snapshot: CurrentStateSnapshot | None) -> str:
    if snapshot is None:
        return "No current state snapshot exists yet."
    return json.dumps(snapshot.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _serialize_route_selection(selection: RouteSelection | None) -> str:
    if selection is None:
        return "No explicit current route has been selected yet."
    return json.dumps(selection.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _build_revision_system_prompt() -> str:
    return dedent(
        """
        You revise an existing Pathway graph after real-world progress updates.

        Non-negotiable rules:
        - Return JSON only.
        - Output must satisfy the provided JSON Schema.
        - Preserve useful structure from the current map. Do not delete or overwrite
          existing graph history during normal revision.
        - This is still a scenario map, not a deterministic claim engine.
        - Use node.status to track route state such as active, at_risk, stalled,
          completed, or proposed.
        - Use revision_meta.change_note on nodes that changed materially.
        - Use evidence ids only from the grounding packet.
        - Unsupported claims must be captured as assumptions.
        - Keep revisions incremental: add, connect, annotate, weaken, hide, or
          supersede nodes instead of rewriting the whole graph for style only.
        - If the user reports a changed situation, discovered fit, working method,
          blocker, or new opportunity, add personalized nodes that explain what
          the user should do next and connect those nodes to the relevant existing
          route/checkpoint and the goal path.
        - Treat the latest check-in narrative as freeform user-reported reality:
          actions taken, things learned, failed attempts, blockers, and new
          opportunities may all be described in natural language instead of
          structured fields.
        - Infer graph consequences from the meaning of that narrative, not from
          keyword-triggered branching.
        - Prefer appending, annotating, weakening, or superseding prior graph
          material over deleting it.
        - For every new or materially changed route, checkpoint, risk, cost,
          switch, fallback, curriculum, media, community, tutor/academy, and
          practice node, `node.data` must include user-facing execution fields:
          `user_step`, `how_to_do_it`, `success_check`, `record_after`, and,
          when relevant, `switch_condition`.
        - Do not write about what Pathway analyzed. Write instructions the user
          can follow.
        - Keep `ontology.node_types[].fields`, `node.style_overrides`, and
          `edge.style_overrides` as empty objects/arrays unless a repair prompt
          explicitly asks otherwise.
        """
    ).strip()


def _build_revision_user_prompt(
    *,
    goal_json: str,
    profile_json: str,
    current_map_json: str,
    state_updates_json: str,
    current_state_json: str,
    route_selection_json: str,
    grounding_packet_json: str,
    schema_json: str,
    goal_id: str,
    checkin_id: str,
) -> str:
    return dedent(
        f"""
        Revise the current graph bundle after a new check-in.

        Goal:
        {goal_json}

        Default profile:
        {profile_json}

        Current graph bundle:
        {current_map_json}

        Recent state updates:
        {state_updates_json}

        Current state snapshot:
        {current_state_json}

        Explicit current route:
        {route_selection_json}

        Retrieved evidence packet:
        {grounding_packet_json}

        JSON Schema:
        {schema_json}

        Expectations:
        - `map.goal_id` must equal `{goal_id}`.
        - Keep the ontology dynamic and useful for this goal.
        - Reflect the latest check-in `{checkin_id}` in node statuses and route choices.
        - Read the latest state update's `progress_summary` as the user's own
          freeform report of what they actually did, practiced, discovered,
          or got blocked by while pursuing the GOAL.
        - When that report implies new skill gains, missing prerequisites,
          better checkpoints, or route risks, express those changes in the graph
          even if `learned_items` is empty.
        - Add personalized nodes when the user's update reveals a better method,
          changed constraint, new bottleneck, or route fit. Connect each added node
          to the relevant existing graph node and to the continuing path toward
          the goal.
        - Avoid destructive removal. If a route became worse, mark it at_risk,
          weakened, hidden, or superseded and add the reason.
        - Use `revision_meta.change_note` on changed or newly added nodes.
        - New/changed user-facing nodes must include concrete step instructions in
          `node.data`, not internal analysis prose.
        - Keep evidence refs explicit and assumptions honest.
        """
    ).strip()


def _build_revision_repair_prompt(
    *,
    raw_output: str,
    error_message: str,
    goal_id: str,
    allowed_evidence_ids: list[str],
) -> str:
    return (
        dedent(
            f"""
        Repair the revised graph JSON so it validates.

        Validation errors:
        {error_message}

        Rules:
        - Return JSON only.
        - `map.goal_id` must equal `{goal_id}`.
        - You may only use evidence ids from this packet:
          {", ".join(allowed_evidence_ids) or "(none)"}
        - Preserve valid structure wherever possible.
        """
        ).strip()
        + f"\n\nPrevious JSON:\n{raw_output}"
    )


def _validate_revised_bundle(
    *,
    raw_output: str,
    source_map: LifeMap,
    goal_id: str,
    grounding_packet,
) -> GraphBundle:
    candidate = GraphBundle.model_validate_json(raw_output)
    normalized = candidate.model_copy(
        update={
            "map": candidate.map.model_copy(update={"goal_id": goal_id}),
        }
    )
    validated = validate_graph_bundle(normalized)
    evidence_attached = _attach_missing_decision_evidence(validated, grounding_packet)
    action_attached = _attach_missing_action_fields(evidence_attached, grounding_packet)
    grounded = validate_bundle_grounding(action_attached, grounding_packet)
    return _enforce_pathway_grounding(grounded, grounding_packet)


def _revision_extra_query_texts(
    state_updates: list[StateUpdate],
    checkin_id: str,
) -> tuple[str, ...]:
    target_update = next((item for item in state_updates if item.id == checkin_id), None)
    if target_update is None:
        return ()
    parts = [
        target_update.progress_summary,
        target_update.blockers,
        target_update.next_adjustment,
        target_update.mood or "",
        " ".join(str(item) for item in target_update.learned_items),
        json.dumps(target_update.resource_deltas, ensure_ascii=False, sort_keys=True),
        "similar user solved this bottleneck experience curriculum expert method",
        "updated personal route fit next steps evidence",
    ]
    return tuple(part for part in parts if str(part).strip())


def _attempt_revision_generation(
    *,
    provider: LLMProvider,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    goal,
    profile: Profile | None,
    source_map: LifeMap,
    state_updates: list[StateUpdate],
    current_state: CurrentStateSnapshot | None,
    route_selection: RouteSelection | None,
    checkin_id: str,
    query_limit: int,
    hits_per_query: int,
    evidence_limit: int,
    max_repair_attempts: int,
) -> GraphBundle:
    schema = GraphBundle.model_json_schema()
    grounding_packet = build_grounding_packet(
        goal=goal,
        profile=profile,
        current_state=current_state,
        embedding_provider=embedding_provider,
        search_index=search_index,
        query_limit=query_limit,
        hits_per_query=hits_per_query,
        evidence_limit=evidence_limit,
        extra_query_texts=_revision_extra_query_texts(state_updates, checkin_id),
    )
    goal_json = _serialize_goal(goal)
    profile_json = _serialize_profile(profile)
    current_map_json = _serialize_map(source_map)
    state_updates_json = _serialize_state_updates(state_updates)
    current_state_json = _serialize_current_state(current_state)
    route_selection_json = _serialize_route_selection(route_selection)
    grounding_json = serialize_grounding_packet(grounding_packet)
    schema_json = json.dumps(schema, ensure_ascii=False, indent=2)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": _build_revision_system_prompt()},
        {
            "role": "user",
            "content": _build_revision_user_prompt(
                goal_json=goal_json,
                profile_json=profile_json,
                current_map_json=current_map_json,
                state_updates_json=state_updates_json,
                current_state_json=current_state_json,
                route_selection_json=route_selection_json,
                grounding_packet_json=grounding_json,
                schema_json=schema_json,
                goal_id=goal.id,
                checkin_id=checkin_id,
            ),
        },
    ]
    last_error = "Unknown revision generation failure"
    allowed_evidence_ids = [item.id for item in grounding_packet.evidence_items]

    for attempt_index in range(max_repair_attempts + 1):
        raw_output = provider.generate_structured_json(
            messages=messages,
            json_schema=schema,
            schema_name=SCHEMA_NAME,
        )
        try:
            return _validate_revised_bundle(
                raw_output=raw_output,
                source_map=source_map,
                goal_id=goal.id,
                grounding_packet=grounding_packet,
            )
        except (ValidationError, ValueError) as exc:
            last_error = str(exc)
            if attempt_index >= max_repair_attempts:
                break
            messages = [
                {"role": "system", "content": _build_revision_system_prompt()},
                {
                    "role": "user",
                    "content": _build_revision_user_prompt(
                        goal_json=goal_json,
                        profile_json=profile_json,
                        current_map_json=current_map_json,
                        state_updates_json=state_updates_json,
                        current_state_json=current_state_json,
                        route_selection_json=route_selection_json,
                        grounding_packet_json=grounding_json,
                        schema_json=schema_json,
                        goal_id=goal.id,
                        checkin_id=checkin_id,
                    ),
                },
                {"role": "assistant", "content": raw_output},
                {
                    "role": "user",
                    "content": _build_revision_repair_prompt(
                        raw_output=raw_output,
                        error_message=last_error,
                        goal_id=goal.id,
                        allowed_evidence_ids=allowed_evidence_ids,
                    ),
                },
            ]

    raise GenerationFailedError(
        "Could not produce a valid revision proposal after "
        f"{max_repair_attempts + 1} attempts: {last_error}"
    )


def create_revision_proposal(
    *,
    map_id: str,
    checkin_id: str,
    map_repo: LifeMapRepository,
    goal_repo: GoalRepository,
    profile_repo: ProfileRepository,
    state_update_repo: StateUpdateRepository,
    current_state_repo: CurrentStateSnapshotRepository,
    route_selection_repo: RouteSelectionRepository,
    proposal_repo: RevisionProposalRepository,
    llm_provider: LLMProvider,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    query_limit: int,
    hits_per_query: int,
    evidence_limit: int,
    max_repair_attempts: int,
) -> RevisionProposal:
    source_map = map_repo.get(map_id)
    if source_map is None:
        raise EntityNotFoundError("LifeMap", map_id)

    goal = goal_repo.get(source_map.goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", source_map.goal_id)

    state_updates = state_update_repo.list_for_goal(goal.id)
    target_update = next((item for item in state_updates if item.id == checkin_id), None)
    if target_update is None:
        raise EntityNotFoundError("StateUpdate", checkin_id)

    profile = profile_repo.get_default()
    current_state = current_state_repo.get_for_goal(goal.id)
    route_selection = route_selection_repo.get_for_pathway(map_id)
    revised_bundle = _attempt_revision_generation(
        provider=llm_provider,
        embedding_provider=embedding_provider,
        search_index=search_index,
        goal=goal,
        profile=profile,
        source_map=source_map,
        state_updates=state_updates[:5],
        current_state=current_state,
        route_selection=route_selection,
        checkin_id=checkin_id,
        query_limit=query_limit,
        hits_per_query=hits_per_query,
        evidence_limit=evidence_limit,
        max_repair_attempts=max_repair_attempts,
    )

    diff = build_graph_diff(source_map.graph_bundle, revised_bundle)
    rationale = (
        f"Revision proposal based on state update {target_update.update_date.isoformat()} "
        f"and progress update: {target_update.progress_summary}"
    )
    return proposal_repo.create(
        RevisionProposalCreate(
            goal_id=goal.id,
            source_map_id=source_map.id,
            checkin_id=checkin_id,
            rationale=rationale,
            diff=diff,
            proposed_graph_bundle=revised_bundle,
        )
    )


def get_revision_proposal(
    proposal_repo: RevisionProposalRepository,
    proposal_id: str,
) -> RevisionProposal:
    proposal = proposal_repo.get(proposal_id)
    if proposal is None:
        raise EntityNotFoundError("RevisionProposal", proposal_id)
    return proposal


def accept_revision_proposal(
    *,
    proposal_id: str,
    proposal_repo: RevisionProposalRepository,
    map_repo: LifeMapRepository,
) -> LifeMap:
    proposal = get_revision_proposal(proposal_repo, proposal_id)
    if proposal.status != "pending":
        raise GenerationFailedError(
            f"Revision proposal '{proposal_id}' is already {proposal.status}"
        )

    accepted_map = map_repo.create(
        LifeMapCreate(
            goal_id=proposal.goal_id,
            title=proposal.proposed_graph_bundle.map.title,
            graph_bundle=proposal.proposed_graph_bundle,
        )
    )
    proposal_repo.update_status(
        proposal_id,
        status="accepted",
        accepted_map_id=accepted_map.id,
    )
    return accepted_map


def reject_revision_proposal(
    *,
    proposal_id: str,
    proposal_repo: RevisionProposalRepository,
) -> RevisionProposal:
    proposal = get_revision_proposal(proposal_repo, proposal_id)
    if proposal.status != "pending":
        raise GenerationFailedError(
            f"Revision proposal '{proposal_id}' is already {proposal.status}"
        )
    rejected = proposal_repo.update_status(proposal_id, status="rejected")
    if rejected is None:
        raise EntityNotFoundError("RevisionProposal", proposal_id)
    return rejected
