from __future__ import annotations

import json
from textwrap import dedent

from pydantic import ValidationError

from lifemap_api.application.errors import EntityNotFoundError, GenerationFailedError
from lifemap_api.application.generation_grounding import (
    GroundingPacket,
    build_grounding_packet,
    serialize_grounding_packet,
    validate_bundle_grounding,
)
from lifemap_api.domain.graph_bundle import GraphBundle, validate_graph_bundle
from lifemap_api.domain.models import CurrentStateSnapshot, Goal, LifeMap, LifeMapCreate, Profile
from lifemap_api.domain.ports import (
    CurrentStateSnapshotRepository,
    EmbeddingProvider,
    GoalAnalysisRepository,
    GoalRepository,
    LifeMapRepository,
    LLMProvider,
    ProfileRepository,
    SourceSearchIndex,
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


def _serialize_current_state(snapshot: CurrentStateSnapshot | None) -> str:
    if snapshot is None:
        return "No current state snapshot exists yet. Keep assumptions explicit and lightweight."
    return json.dumps(snapshot.model_dump(mode="json"), ensure_ascii=False, indent=2)


def _build_system_prompt() -> str:
    return dedent(
        """
        You generate Pathway graph bundles for a local-first decision-graph product.

        Non-negotiable rules:
        - Return JSON only.
        - The output must satisfy the provided JSON Schema.
        - This is a scenario map, never a prophecy or certainty claim.
        - Use a dynamic ontology. Do not assume a fixed node taxonomy.
        - Invent node types and edge types only when they are useful for this goal.
        - Keep the graph grounded in the goal, profile constraints, and explicit assumptions.
        - Use retrieved evidence only through the evidence IDs provided in the grounding packet.
        - Never invent evidence IDs, source titles, or quotes.
        - If a claim is not supported by the grounding packet, express it as an assumption instead.
        - When the grounding packet contains different evidence families such as lived experience,
          official guidance, failure cases, or alternative routes,
          reflect that breadth in the graph.
        - Do not use generic filler nodes or empty placeholder text.
        - Prefer 4 to 9 nodes and 3 to 12 edges for this phase.
        - At least one assumption is required whenever profile information is missing or uncertain.
        - Every progression path must remain acyclic.
        - Make the copy human, crisp, and slightly witty when appropriate,
          but never jokey enough to reduce clarity.
        - Keep field values compact and readable for a graph-first UI.
        - Include only the evidence items actually referenced by at least one node.
        - For this structured-output path, keep `ontology.node_types[].fields`,
          `node.data`, `node.style_overrides`, `edge.style_overrides`, and
          `node.revision_meta` as empty objects/arrays unless a repair prompt
          explicitly asks otherwise.
        """
    ).strip()


def _build_user_prompt(
    goal: Goal,
    profile: Profile | None,
    current_state: CurrentStateSnapshot | None,
    schema: dict,
    grounding_packet: GroundingPacket,
) -> str:
    return dedent(
        f"""
        Generate one graph bundle for this goal.

        Goal:
        {_serialize_goal(goal)}

        Default profile:
        {_serialize_profile(profile)}

        Current state snapshot:
        {_serialize_current_state(current_state)}

        Retrieved evidence packet:
        {serialize_grounding_packet(grounding_packet)}

        JSON Schema:
        {json.dumps(schema, ensure_ascii=False, indent=2)}

        Expectations:
        - `map.goal_id` must equal `{goal.id}`.
        - The ontology must be useful for this specific goal instead of generic.
        - Include warnings that remind the user this is a scenario map and may need revision.
        - Use assumptions when information is missing.
        - If evidence exists, connect it to specific nodes with `evidence_refs`.
        - If evidence does not exist for a claim, do not disguise it as evidence.
        - Prefer route families that show tradeoffs and switching conditions
          instead of collapsing everything into one default path.
        - Use node summaries that explain tradeoffs, not just labels.
        - Keep scores within 0 and 1.
        - Every node must include `scores` with `time_load`, `money_load`,
          `energy_load`, and `uncertainty`.
        """
    ).strip()


def _build_repair_prompt(
    raw_output: str,
    error_message: str,
    goal_id: str,
    grounding_packet: GroundingPacket,
) -> str:
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
        - You may only use evidence ids from this packet:
          {", ".join(item.id for item in grounding_packet.evidence_items) or "(none)"}
        - Unsupported claims must move into assumptions, not invented evidence.

        Previous JSON:
        {raw_output}
        """
    ).strip()


def _analysis_query_texts(analysis) -> tuple[str, ...]:
    if analysis is None:
        return ()
    query_texts = list(analysis.research_questions)
    if analysis.research_plan is not None:
        for target in analysis.research_plan.collection_targets:
            query_texts.extend(target.example_queries)
            query_texts.append(f"{target.label}: {target.search_intent}")
    return tuple(dict.fromkeys(text for text in query_texts if text.strip()))


def _normalize_bundle(bundle: GraphBundle, goal: Goal) -> GraphBundle:
    return bundle.model_copy(
        update={
            "map": bundle.map.model_copy(update={"goal_id": goal.id}),
        }
    )


def _validate_candidate(
    raw_output: str,
    goal: Goal,
    grounding_packet: GroundingPacket,
) -> GraphBundle:
    candidate = GraphBundle.model_validate_json(raw_output)
    normalized = _normalize_bundle(candidate, goal)
    validated = validate_graph_bundle(normalized)
    return validate_bundle_grounding(validated, grounding_packet)


def _attempt_generation(
    *,
    provider: LLMProvider,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    goal: Goal,
    profile: Profile | None,
    current_state: CurrentStateSnapshot | None,
    extra_query_texts: tuple[str, ...],
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
        extra_query_texts=extra_query_texts,
    )
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _build_system_prompt()},
        {
            "role": "user",
            "content": _build_user_prompt(goal, profile, current_state, schema, grounding_packet),
        },
    ]
    last_error = "Unknown generation failure"

    for attempt_index in range(max_repair_attempts + 1):
        raw_output = provider.generate_structured_json(
            messages=messages,
            json_schema=schema,
            schema_name=SCHEMA_NAME,
        )

        try:
            return _validate_candidate(raw_output, goal, grounding_packet)
        except (ValidationError, ValueError) as exc:
            last_error = str(exc)
            if attempt_index >= max_repair_attempts:
                break
            messages = [
                {"role": "system", "content": _build_system_prompt()},
                {
                    "role": "user",
                    "content": _build_user_prompt(
                        goal,
                        profile,
                        current_state,
                        schema,
                        grounding_packet,
                    ),
                },
                {"role": "assistant", "content": raw_output},
                {
                    "role": "user",
                    "content": _build_repair_prompt(
                        raw_output,
                        last_error,
                        goal.id,
                        grounding_packet,
                    ),
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
    analysis_repo: GoalAnalysisRepository,
    current_state_repo: CurrentStateSnapshotRepository,
    map_repo: LifeMapRepository,
    llm_provider: LLMProvider,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    query_limit: int,
    hits_per_query: int,
    evidence_limit: int,
    max_repair_attempts: int,
) -> LifeMap:
    goal = goal_repo.get(goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", goal_id)

    profile = profile_repo.get_default()
    analysis = analysis_repo.get(goal_id)
    current_state = current_state_repo.get_for_goal(goal_id)
    graph_bundle = _attempt_generation(
        provider=llm_provider,
        embedding_provider=embedding_provider,
        search_index=search_index,
        goal=goal,
        profile=profile,
        current_state=current_state,
        extra_query_texts=_analysis_query_texts(analysis),
        query_limit=query_limit,
        hits_per_query=hits_per_query,
        evidence_limit=evidence_limit,
        max_repair_attempts=max_repair_attempts,
    )

    return map_repo.create(
        LifeMapCreate(
            goal_id=goal.id,
            title=_build_map_title(goal, graph_bundle),
            graph_bundle=graph_bundle,
        )
    )
