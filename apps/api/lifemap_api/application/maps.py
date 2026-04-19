from datetime import UTC, datetime

from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.domain.models import (
    GoalCreate,
    LifeMap,
    LifeMapCreate,
    MapExportEnvelope,
    MapImportEnvelope,
    ProfileUpsert,
)
from lifemap_api.domain.ports import GoalRepository, LifeMapRepository, ProfileRepository


def get_map(repo: LifeMapRepository, map_id: str) -> LifeMap:
    map_record = repo.get(map_id)
    if map_record is None:
        raise EntityNotFoundError("LifeMap", map_id)
    return map_record


def create_map(
    map_repo: LifeMapRepository, goal_repo: GoalRepository, payload: LifeMapCreate
) -> LifeMap:
    if goal_repo.get(payload.goal_id) is None:
        raise EntityNotFoundError("Goal", payload.goal_id)
    return map_repo.create(payload)


def export_map_bundle(
    *,
    map_id: str,
    map_repo: LifeMapRepository,
    goal_repo: GoalRepository,
    profile_repo: ProfileRepository,
) -> MapExportEnvelope:
    life_map = get_map(map_repo, map_id)
    goal = goal_repo.get(life_map.goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", life_map.goal_id)
    profile = profile_repo.get_default()
    return MapExportEnvelope(
        exported_at=datetime.now(UTC),
        profile=profile,
        goal=goal,
        map=life_map,
    )


def import_map_bundle(
    *,
    payload: MapImportEnvelope,
    map_repo: LifeMapRepository,
    goal_repo: GoalRepository,
    profile_repo: ProfileRepository,
) -> LifeMap:
    if payload.profile is not None:
        profile_repo.upsert_default(
            ProfileUpsert(
                display_name=payload.profile.display_name,
                age=payload.profile.age,
                weekly_free_hours=payload.profile.weekly_free_hours,
                monthly_budget_amount=payload.profile.monthly_budget_amount,
                monthly_budget_currency=payload.profile.monthly_budget_currency,
                energy_level=payload.profile.energy_level,
                preference_tags=payload.profile.preference_tags,
                constraints=payload.profile.constraints,
            )
        )

    existing_goal = goal_repo.get(payload.goal.id)
    if existing_goal is None:
        imported_goal = goal_repo.create(
            GoalCreate(
                profile_id=payload.goal.profile_id,
                title=payload.goal.title,
                description=payload.goal.description,
                category=payload.goal.category,
                deadline=payload.goal.deadline,
                success_criteria=payload.goal.success_criteria,
                status=payload.goal.status,
            )
        )
    else:
        imported_goal = existing_goal

    imported_bundle = payload.map.graph_bundle.model_copy(
        update={
            "map": payload.map.graph_bundle.map.model_copy(update={"goal_id": imported_goal.id}),
        }
    )

    return map_repo.create(
        LifeMapCreate(
            goal_id=imported_goal.id,
            title=payload.map.title,
            graph_bundle=imported_bundle,
        )
    )


def export_map_markdown(
    *,
    map_id: str,
    map_repo: LifeMapRepository,
    goal_repo: GoalRepository,
) -> str:
    life_map = get_map(map_repo, map_id)
    goal = goal_repo.get(life_map.goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", life_map.goal_id)

    bundle = life_map.graph_bundle
    lines = [
        f"# {life_map.title}",
        "",
        f"- Goal: {goal.title}",
        f"- Success criteria: {goal.success_criteria}",
        f"- Nodes: {len(bundle.nodes)}",
        f"- Edges: {len(bundle.edges)}",
        "",
        "## Summary",
        "",
        bundle.map.summary,
        "",
        "## Nodes",
        "",
    ]

    for node in bundle.nodes:
        lines.append(f"### {node.label}")
        lines.append("")
        lines.append(f"- Type: {node.type}")
        if node.status:
            lines.append(f"- Status: {node.status}")
        lines.append(f"- Summary: {node.summary}")
        if node.evidence_refs:
            lines.append(f"- Evidence refs: {', '.join(node.evidence_refs)}")
        if node.assumption_refs:
            lines.append(f"- Assumption refs: {', '.join(node.assumption_refs)}")
        if node.data:
            lines.append("- Fields:")
            for key, value in node.data.items():
                lines.append(f"  - {key}: {value}")
        lines.append("")

    lines.extend(["## Warnings", ""])
    if bundle.warnings:
        for warning in bundle.warnings:
            lines.append(f"- {warning}")
    else:
        lines.append("- None")

    lines.extend(["", "## Evidence", ""])
    if bundle.evidence:
        for item in bundle.evidence:
            lines.append(f"- **{item.title}** ({item.id})")
            lines.append(f"  - {item.quote_or_summary}")
    else:
        lines.append("- None")

    lines.extend(["", "## Assumptions", ""])
    if bundle.assumptions:
        for item in bundle.assumptions:
            lines.append(f"- **{item.id}**: {item.text}")
            lines.append(f"  - Risk if false: {item.risk_if_false}")
    else:
        lines.append("- None")

    return "\n".join(lines).strip() + "\n"
