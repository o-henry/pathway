from fastapi import APIRouter, Depends, HTTPException, status

from lifemap_api.api.dependencies import get_goal_repository, get_lifemap_repository
from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.application.maps import create_map, get_map
from lifemap_api.domain.models import LifeMap, LifeMapCreate
from lifemap_api.infrastructure.repositories import SqliteGoalRepository, SqliteLifeMapRepository

router = APIRouter(prefix="/maps", tags=["maps"])


@router.get("/{map_id}", response_model=LifeMap)
def read_map(
    map_id: str,
    repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
) -> LifeMap:
    try:
        return get_map(repo, map_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("", response_model=LifeMap, status_code=status.HTTP_201_CREATED)
def post_map(
    payload: LifeMapCreate,
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
) -> LifeMap:
    try:
        return create_map(map_repo, goal_repo, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
