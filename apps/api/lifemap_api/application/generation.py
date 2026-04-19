from __future__ import annotations

import json
from textwrap import dedent

from pydantic import ValidationError

from lifemap_api.application.errors import EntityNotFoundError, GenerationFailedError
from lifemap_api.domain.graph_bundle import GraphBundle, validate_graph_bundle
from lifemap_api.domain.models import Goal, LifeMap, LifeMapCreate, Profile
from lifemap_api.domain.ports import (
    GoalRepository,
    LifeMapRepository,
    LLMProvider,
    ProfileRepository,
)

SCHEMA_NAME = "life_map_graph_bundle"


def _serialize_profile(profile: Profile | None) -> str:
    if profile is None:
        return (
            "No default profile exists yet. Infer only from the goal payload and keep "
            "assumptions explicit."
        )
    return json.dumps(profile.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _serialize_goal(goal: Goal) -> str:
    return json.dumps(goal.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _build_system_prompt() -> str:
    return dedent(
        """
        You generate Life Map graph bundles for a local-first scenario mapping product.

        Non-negotiable rules:
        - Return JSON only.
        - The output must satisfy the provided JSON Schema.
        - This is a scenario map, never a prophecy or certainty claim.
        - Use a dynamic ontology. Do not assume a fixed node taxonomy.
        - Invent node types and edge types only when they are useful for this goal.
        - Keep the graph grounded in the goal, profile constraints, and explicit assumptions.
        - Do not use generic filler nodes or empty placeholder text.
        - Prefer 4 to 9 nodes and 3 to 12 edges for this phase.
        - At least one assumption is required whenever profile information is missing or uncertain.
        - Every progression path must remain acyclic.
        - Make the copy human, crisp, and slightly witty when appropriate,
          but never jokey enough to reduce clarity.
        - Keep field values compact and readable for a mind-map UI.
        """
    ).strip()


def _build_user_prompt(goal: Goal, profile: Profile | None, schema: dict) -> str:
    return dedent(
        f"""
        Generate one graph bundle for this goal.

        Goal:
        {_serialize_goal(goal)}

        Default profile:
        {_serialize_profile(profile)}

        JSON Schema:
        {json.dumps(schema, ensure_ascii=False, indent=2)}

        Expectations:
        - `map.goal_id` must equal `{goal.id}`.
        - The ontology must be useful for this specific goal instead of generic.
        - Include warnings that remind the user this is a scenario map and may need revision.
        - Use assumptions when information is missing.
        - Use node summaries that explain tradeoffs, not just labels.
        - Keep scores within 0 and 1.
        """
    ).strip()


def _build_repair_prompt(raw_output: str, error_message: str, goal_id: str) -> str:
    return dedent(
        f"""
        Repair the previous JSON so it validates.

        Validation errors:
        {error_message}

        Rules:
        - Return JSON only.
        - Preserve as much useful structure as possible.
        - `map.goal_id` must equal `{goal_id}`.
        - Fix the schema and graph validation issues completely.

        Previous JSON:
        {raw_output}
        """
    ).strip()


def _normalize_bundle(bundle: GraphBundle, goal: Goal) -> GraphBundle:
    return bundle.model_copy(
        update={
            "map": bundle.map.model_copy(update={"goal_id": goal.id}),
        }
    )


def _validate_candidate(raw_output: str, goal: Goal) -> GraphBundle:
    candidate = GraphBundle.model_validate_json(raw_output)
    normalized = _normalize_bundle(candidate, goal)
    return validate_graph_bundle(normalized)


def _attempt_generation(
    *,
    provider: LLMProvider,
    goal: Goal,
    profile: Profile | None,
    max_repair_attempts: int,
) -> GraphBundle:
    schema = GraphBundle.model_json_schema()
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _build_system_prompt()},
        {"role": "user", "content": _build_user_prompt(goal, profile, schema)},
    ]
    last_error = "Unknown generation failure"

    for attempt_index in range(max_repair_attempts + 1):
        raw_output = provider.generate_structured_json(
            messages=messages,
            json_schema=schema,
            schema_name=SCHEMA_NAME,
        )

        try:
            return _validate_candidate(raw_output, goal)
        except (ValidationError, ValueError) as exc:
            last_error = str(exc)
            if attempt_index >= max_repair_attempts:
                break
            messages = [
                {"role": "system", "content": _build_system_prompt()},
                {"role": "user", "content": _build_user_prompt(goal, profile, schema)},
                {"role": "assistant", "content": raw_output},
                {
                    "role": "user",
                    "content": _build_repair_prompt(raw_output, last_error, goal.id),
                },
            ]

    raise GenerationFailedError(
        "Could not produce a valid graph bundle after "
        f"{max_repair_attempts + 1} attempts: {last_error}"
    )


def _build_map_title(goal: Goal, bundle: GraphBundle) -> str:
    title = bundle.map.title.strip()
    if title:
        return title
    return f"{goal.title} · generated"


def generate_map_for_goal(
    *,
    goal_id: str,
    goal_repo: GoalRepository,
    profile_repo: ProfileRepository,
    map_repo: LifeMapRepository,
    llm_provider: LLMProvider,
    max_repair_attempts: int,
) -> LifeMap:
    goal = goal_repo.get(goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", goal_id)

    profile = profile_repo.get_default()
    graph_bundle = _attempt_generation(
        provider=llm_provider,
        goal=goal,
        profile=profile,
        max_repair_attempts=max_repair_attempts,
    )

    return map_repo.create(
        LifeMapCreate(
            goal_id=goal.id,
            title=_build_map_title(goal, graph_bundle),
            graph_bundle=graph_bundle,
        )
    )
