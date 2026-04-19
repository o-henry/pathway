from fastapi import APIRouter, Depends, HTTPException, Response, status

from lifemap_api.api.dependencies import (
    get_embedding_provider,
    get_goal_repository,
    get_lifemap_repository,
    get_llm_provider,
    get_profile_repository,
    get_source_search_index,
)
from lifemap_api.application.errors import (
    AppConfigurationError,
    EntityNotFoundError,
    GenerationFailedError,
    ProviderInvocationError,
)
from lifemap_api.application.generation import generate_map_for_goal
from lifemap_api.application.goals import (
    create_goal,
    delete_goal,
    get_goal,
    list_goals,
    update_goal,
)
from lifemap_api.application.maps import list_maps_for_goal
from lifemap_api.config import get_settings
from lifemap_api.domain.models import Goal, GoalCreate, GoalUpdate, LifeMap
from lifemap_api.domain.ports import EmbeddingProvider, LLMProvider, SourceSearchIndex
from lifemap_api.infrastructure.repositories import (
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
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
