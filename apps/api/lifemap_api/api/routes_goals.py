from fastapi import APIRouter, Depends, HTTPException, Response, status

from lifemap_api.api.dependencies import (
    get_current_state_snapshot_repository,
    get_embedding_provider,
    get_goal_analysis_repository,
    get_goal_repository,
    get_lifemap_repository,
    get_llm_provider,
    get_profile_repository,
    get_state_update_repository,
    get_source_search_index,
)
from lifemap_api.application.errors import (
    AppConfigurationError,
    EntityNotFoundError,
    GenerationFailedError,
    ProviderInvocationError,
)
from lifemap_api.application.generation import generate_map_for_goal
from lifemap_api.application.goal_analysis import analyze_goal
from lifemap_api.application.goals import (
    create_goal,
    delete_goal,
    get_goal,
    list_goals,
    update_goal,
)
from lifemap_api.application.maps import list_maps_for_goal
from lifemap_api.application.state import (
    create_state_update,
    get_current_state,
    list_state_updates,
    upsert_current_state,
)
from lifemap_api.config import get_settings
from lifemap_api.domain.models import (
    CurrentStateSnapshot,
    CurrentStateSnapshotUpsert,
    Goal,
    GoalAnalysis,
    GoalCreate,
    GoalUpdate,
    LifeMap,
    StateUpdate,
    StateUpdateCreate,
)
from lifemap_api.domain.ports import EmbeddingProvider, LLMProvider, SourceSearchIndex
from lifemap_api.infrastructure.repositories import (
    SqliteCurrentStateSnapshotRepository,
    SqliteGoalAnalysisRepository,
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
    SqliteStateUpdateRepository,
)

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[Goal])
def read_goals(repo: SqliteGoalRepository = Depends(get_goal_repository)) -> list[Goal]:
    return list_goals(repo)


@router.post("", response_model=Goal, status_code=status.HTTP_201_CREATED)
def post_goal(
    payload: GoalCreate,
    repo: SqliteGoalRepository = Depends(get_goal_repository),
) -> Goal:
    return create_goal(repo, payload)


@router.get("/{goal_id}", response_model=Goal)
def read_goal(goal_id: str, repo: SqliteGoalRepository = Depends(get_goal_repository)) -> Goal:
    try:
        return get_goal(repo, goal_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{goal_id}/maps", response_model=list[LifeMap])
def read_goal_maps(
    goal_id: str,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
) -> list[LifeMap]:
    try:
        return list_maps_for_goal(map_repo, goal_repo, goal_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{goal_id}/analysis", response_model=GoalAnalysis)
def post_goal_analysis(
    goal_id: str,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    analysis_repo: SqliteGoalAnalysisRepository = Depends(get_goal_analysis_repository),
) -> GoalAnalysis:
    try:
        return analyze_goal(goal_id=goal_id, goal_repo=goal_repo, analysis_repo=analysis_repo)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{goal_id}/current-state", response_model=CurrentStateSnapshot | None)
def read_goal_current_state(
    goal_id: str,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    snapshot_repo: SqliteCurrentStateSnapshotRepository = Depends(
        get_current_state_snapshot_repository
    ),
) -> CurrentStateSnapshot | None:
    try:
        return get_current_state(goal_id=goal_id, goal_repo=goal_repo, snapshot_repo=snapshot_repo)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{goal_id}/current-state", response_model=CurrentStateSnapshot)
def put_goal_current_state(
    goal_id: str,
    payload: CurrentStateSnapshotUpsert,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    snapshot_repo: SqliteCurrentStateSnapshotRepository = Depends(
        get_current_state_snapshot_repository
    ),
) -> CurrentStateSnapshot:
    try:
        return upsert_current_state(
            goal_id=goal_id,
            goal_repo=goal_repo,
            snapshot_repo=snapshot_repo,
            payload=payload,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{goal_id}/state-updates", response_model=list[StateUpdate])
def read_goal_state_updates(
    goal_id: str,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    state_update_repo: SqliteStateUpdateRepository = Depends(get_state_update_repository),
) -> list[StateUpdate]:
    try:
        return list_state_updates(
            goal_id=goal_id,
            goal_repo=goal_repo,
            state_update_repo=state_update_repo,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{goal_id}/state-updates", response_model=StateUpdate, status_code=status.HTTP_201_CREATED)
def post_goal_state_update(
    goal_id: str,
    payload: StateUpdateCreate,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    pathway_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    state_update_repo: SqliteStateUpdateRepository = Depends(get_state_update_repository),
    snapshot_repo: SqliteCurrentStateSnapshotRepository = Depends(
        get_current_state_snapshot_repository
    ),
) -> StateUpdate:
    try:
        return create_state_update(
            goal_id=goal_id,
            payload=payload,
            goal_repo=goal_repo,
            pathway_repo=pathway_repo,
            state_update_repo=state_update_repo,
            snapshot_repo=snapshot_repo,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{goal_id}", response_model=Goal)
def patch_goal(
    goal_id: str,
    payload: GoalUpdate,
    repo: SqliteGoalRepository = Depends(get_goal_repository),
) -> Goal:
    try:
        return update_goal(repo, goal_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_goal(
    goal_id: str,
    repo: SqliteGoalRepository = Depends(get_goal_repository),
) -> Response:
    try:
        delete_goal(repo, goal_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{goal_id}/maps/generate",
    response_model=LifeMap,
    status_code=status.HTTP_201_CREATED,
)
def post_generated_map(
    goal_id: str,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    profile_repo: SqliteProfileRepository = Depends(get_profile_repository),
    snapshot_repo: SqliteCurrentStateSnapshotRepository = Depends(
        get_current_state_snapshot_repository
    ),
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    llm_provider: LLMProvider = Depends(get_llm_provider),
    embedding_provider: EmbeddingProvider = Depends(get_embedding_provider),
    search_index: SourceSearchIndex = Depends(get_source_search_index),
):
    settings = get_settings()
    try:
        return generate_map_for_goal(
            goal_id=goal_id,
            goal_repo=goal_repo,
            profile_repo=profile_repo,
            current_state_repo=snapshot_repo,
            map_repo=map_repo,
            llm_provider=llm_provider,
            embedding_provider=embedding_provider,
            search_index=search_index,
            query_limit=settings.generation_query_limit,
            hits_per_query=settings.generation_hits_per_query,
            evidence_limit=settings.generation_evidence_limit,
            max_repair_attempts=settings.llm_max_repair_attempts,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AppConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ProviderInvocationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except GenerationFailedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post(
    "/{goal_id}/pathways/generate",
    response_model=LifeMap,
    status_code=status.HTTP_201_CREATED,
)
def post_generated_pathway(
    goal_id: str,
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    profile_repo: SqliteProfileRepository = Depends(get_profile_repository),
    snapshot_repo: SqliteCurrentStateSnapshotRepository = Depends(
        get_current_state_snapshot_repository
    ),
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    llm_provider: LLMProvider = Depends(get_llm_provider),
    embedding_provider: EmbeddingProvider = Depends(get_embedding_provider),
    search_index: SourceSearchIndex = Depends(get_source_search_index),
):
    settings = get_settings()
    try:
        return generate_map_for_goal(
            goal_id=goal_id,
            goal_repo=goal_repo,
            profile_repo=profile_repo,
            current_state_repo=snapshot_repo,
            map_repo=map_repo,
            llm_provider=llm_provider,
            embedding_provider=embedding_provider,
            search_index=search_index,
            query_limit=settings.generation_query_limit,
            hits_per_query=settings.generation_hits_per_query,
            evidence_limit=settings.generation_evidence_limit,
            max_repair_attempts=settings.llm_max_repair_attempts,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except AppConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ProviderInvocationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    except GenerationFailedError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
