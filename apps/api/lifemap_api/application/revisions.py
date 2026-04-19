from __future__ import annotations

import json
from textwrap import dedent

from pydantic import ValidationError

from lifemap_api.application.errors import EntityNotFoundError, GenerationFailedError
from lifemap_api.application.generation import SCHEMA_NAME, _serialize_goal, _serialize_profile
from lifemap_api.application.generation_grounding import (
    build_grounding_packet,
    serialize_grounding_packet,
    validate_bundle_grounding,
)
from lifemap_api.application.graph_diff import build_graph_diff
from lifemap_api.domain.graph_bundle import GraphBundle, validate_graph_bundle
from lifemap_api.domain.models import (
    CheckIn,
    LifeMap,
    LifeMapCreate,
    Profile,
    RevisionProposal,
    RevisionProposalCreate,
)
from lifemap_api.domain.ports import (
    CheckInRepository,
    EmbeddingProvider,
    GoalRepository,
    LifeMapRepository,
    LLMProvider,
    ProfileRepository,
    RevisionProposalRepository,
    SourceSearchIndex,
)


def _serialize_map(life_map: LifeMap) -> str:
    return json.dumps(life_map.graph_bundle.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _serialize_checkins(checkins: list[CheckIn]) -> str:
    if not checkins:
        return "[]"
    return json.dumps(
        [checkin.model_dump(mode="json") for checkin in checkins],
        ensure_ascii=False,
        indent=2,
    )


def _build_revision_system_prompt() -> str:
    return dedent(
        """
        You revise an existing Pathway graph after real-world progress updates.

        Non-negotiable rules:
        - Return JSON only.
        - Output must satisfy the provided JSON Schema.
        - Preserve useful structure from the current map unless the check-in makes it stale.
        - This is still a scenario map, not a deterministic claim engine.
        - Use node.status to track route state such as active, at_risk, stalled,
          completed, or proposed.
        - Use revision_meta.change_note on nodes that changed materially.
        - Use evidence ids only from the grounding packet.
        - Unsupported claims must be captured as assumptions.
        - Keep revisions incremental when possible instead of rewriting the
          whole graph for style only.
        """
    ).strip()


def _build_revision_user_prompt(
    *,
    goal_json: str,
    profile_json: str,
    current_map_json: str,
    checkins_json: str,
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

        Recent check-ins:
        {checkins_json}

        Retrieved evidence packet:
        {grounding_packet_json}

        JSON Schema:
        {schema_json}

        Expectations:
        - `map.goal_id` must equal `{goal_id}`.
        - Keep the ontology dynamic and useful for this goal.
        - Reflect the latest check-in `{checkin_id}` in node statuses and route choices.
        - Add or remove nodes only when the check-in justifies it.
        - Use `revision_meta.change_note` on changed or newly added nodes.
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
    return dedent(
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
    ).strip() + f"\n\nPrevious JSON:\n{raw_output}"


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
    return validate_bundle_grounding(validated, grounding_packet)


def _attempt_revision_generation(
    *,
    provider: LLMProvider,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    goal,
    profile: Profile | None,
    source_map: LifeMap,
    checkins: list[CheckIn],
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
        embedding_provider=embedding_provider,
        search_index=search_index,
        query_limit=query_limit,
        hits_per_query=hits_per_query,
        evidence_limit=evidence_limit,
    )
    goal_json = _serialize_goal(goal)
    profile_json = _serialize_profile(profile)
    current_map_json = _serialize_map(source_map)
    checkins_json = _serialize_checkins(checkins)
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
                checkins_json=checkins_json,
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
                        checkins_json=checkins_json,
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
    checkin_repo: CheckInRepository,
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

    checkins = checkin_repo.list_for_goal(goal.id)
    target_checkin = next((item for item in checkins if item.id == checkin_id), None)
    if target_checkin is None:
        raise EntityNotFoundError("CheckIn", checkin_id)

    profile = profile_repo.get_default()
    revised_bundle = _attempt_revision_generation(
        provider=llm_provider,
        embedding_provider=embedding_provider,
        search_index=search_index,
        goal=goal,
        profile=profile,
        source_map=source_map,
        checkins=checkins[:5],
        checkin_id=checkin_id,
        query_limit=query_limit,
        hits_per_query=hits_per_query,
        evidence_limit=evidence_limit,
        max_repair_attempts=max_repair_attempts,
    )

    diff = build_graph_diff(source_map.graph_bundle, revised_bundle)
    rationale = (
        f"Revision proposal based on check-in {target_checkin.checkin_date.isoformat()} "
        f"and progress update: {target_checkin.progress_summary}"
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
