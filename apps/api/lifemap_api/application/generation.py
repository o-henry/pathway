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
from lifemap_api.application.graph_quality import (
    attach_missing_action_fields,
    attach_missing_decision_evidence,
    enforce_pathway_grounding,
    enforce_pathway_shape,
    enforce_semantic_roles,
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
        - For every ontology node type, set `semantic_role` to a broad machine role
          such as goal, route, route_choice, fallback_route, checkpoint, risk,
          constraint, cost, opportunity_cost, switch_condition, practice,
          resource, evidence, assumption, milestone, or other.
        - `semantic_role` is for validation/rendering only; the node type `id`,
          label, and description must still be specific to this map.
        - Keep the graph grounded in the goal, profile constraints, and explicit assumptions.
        - Use retrieved evidence only through the evidence IDs provided in the grounding packet.
        - Never invent evidence IDs, source titles, or quotes.
        - If a claim is not supported by the grounding packet, express it as an assumption instead.
        - Treat `public_url_metadata` items as discovery candidates only. Do not use them
          as proof for claims about the page content unless the node is explicitly about
          source availability or the need for user review.
        - When the grounding packet contains different evidence families such as lived experience,
          official guidance, failure cases, or alternative routes,
          reflect that breadth in the graph.
        - Do not use generic filler nodes or empty placeholder text.
        - Build a route atlas, not a two-line plan. Prefer 12 to 24 nodes and
          14 to 32 edges for the first generated map.
        - Include at least 5 distinct route or option nodes across at least
          3 route families. These can represent many concrete possibilities
          as families and variants instead of exhaustively listing hundreds
          of tiny nodes.
        - Include support nodes for checkpoints, failure modes, constraints,
          trade-offs, opportunity costs, fallback/switch conditions, and
          missed options when they affect the user's route choice.
        - At least one assumption is required whenever profile information is missing or uncertain.
        - Every progression path must remain acyclic.
        - Make the copy human, crisp, and slightly witty when appropriate,
          but never jokey enough to reduce clarity.
        - Keep field values compact and readable for a graph-first UI.
        - Include only the evidence items actually referenced by at least one node.
        - For every route, checkpoint, risk, cost, switch, fallback, curriculum,
          media, community, tutor/academy, and practice node, `node.data` must
          include concrete user-facing execution fields:
          `user_step`, `how_to_do_it`, `success_check`, `record_after`, and,
          when relevant, `switch_condition`.
        - Those action fields must be derived from the linked evidence and the
          user's constraints. Do not use internal analysis prose, generic advice,
          or "this node represents..." explanations.
        - A clicked node should read like instructions the user can follow today:
          what to do, with what resource, for how long or how often, what result
          counts, and what to record for the next graph revision.
        - Keep `ontology.node_types[].fields`, `node.style_overrides`,
          `edge.style_overrides`, and `node.revision_meta` as empty objects/arrays
          unless a repair prompt explicitly asks otherwise.
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
        - Every ontology node type must include `semantic_role`; do not force node
          type ids into a fixed taxonomy just to satisfy validation.
        - Include warnings that remind the user this is a scenario map and may need revision.
        - Use assumptions when information is missing.
        - If evidence exists, connect it to specific nodes with `evidence_refs`.
          Route, checkpoint, risk, cost, switch, fallback, curriculum, media,
          community, tutor/academy, and practice nodes must cite retrieved evidence.
          Do not ship first-map decision nodes with empty `evidence_refs` when the
          grounding packet contains usable evidence.
        - If evidence does not exist for a claim, do not disguise it as evidence.
        - If an evidence item has reliability `public_url_metadata`, use it only to
          mark a candidate source, blocked fetch, or review need. Do not summarize
          unsupported page claims from it.
        - Cover the evidence landscape broadly: academic papers, public community
          experience, YouTube/open media, structured courses, lectures, tutors,
          academies, official guides, and failure/switch cases where relevant.
        - Prefer route families that show tradeoffs and switching conditions
          instead of collapsing everything into one default path.
        - Make the graph broad enough that the user can see multiple viable,
          risky, cheap, fast, slow, social, solo, direct, fallback, and
          opportunity-cost routes where relevant.
        - Do not stop at one happy path. If many possible routes exist,
          group them into route-family nodes and attach representative variants,
          checkpoints, risks, and switch conditions.
        - Use node summaries that explain tradeoffs, not just labels.
        - Make each node actionable enough for a context panel: if the user clicks
          it, `node.data.user_step`, `node.data.how_to_do_it`,
          `node.data.success_check`, and `node.data.record_after` should tell
          the user what to do next. Avoid self-descriptions of the graph.
        - Do not write node action text that brags about what Pathway analyzed.
          Write instructions for the user.
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
        - If validation says the route atlas is too sparse, expand the graph
          with more route families, representative route variants, checkpoints,
          failure modes, fallback/switch nodes, and opportunity-cost nodes.
        - If validation says ontology node types are missing semantic_role, add
          semantic_role to each node type without changing existing node ids.
        - If validation says route/support nodes are missing, set correct
          `ontology.node_types[].semantic_role` values instead of renaming node types.
        - If validation says nodes are missing evidence, attach allowed evidence ids
          from the packet to the specific route/support nodes they justify. Do not
          leave user-facing decision nodes ungrounded when usable evidence exists.
        - Do not use `public_url_metadata` evidence as support for route claims;
          use it only for source-review/candidate-source nodes.

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
    semantic_validated = enforce_semantic_roles(validated)
    evidence_attached = attach_missing_decision_evidence(semantic_validated, grounding_packet)
    action_attached = attach_missing_action_fields(evidence_attached, grounding_packet)
    grounded = validate_bundle_grounding(action_attached, grounding_packet)
    shaped = enforce_pathway_shape(grounded)
    return enforce_pathway_grounding(shaped, grounding_packet)


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
