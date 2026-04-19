from fastapi import APIRouter, Depends, HTTPException, status

from lifemap_api.api.dependencies import (
    get_checkin_repository,
    get_goal_repository,
    get_lifemap_repository,
)
from lifemap_api.application.checkins import create_checkin, list_checkins
from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.domain.models import CheckIn, CheckInCreate
from lifemap_api.infrastructure.repositories import (
    SqliteCheckInRepository,
    SqliteGoalRepository,
    SqliteLifeMapRepository,
)

router = APIRouter(prefix="/goals/{goal_id}/checkins", tags=["checkins"])


@router.get("", response_model=list[CheckIn])
def read_checkins(
    goal_id: str,
    repo: SqliteCheckInRepository = Depends(get_checkin_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
) -> list[CheckIn]:
    try:
        return list_checkins(repo, goal_repo, goal_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("", response_model=CheckIn, status_code=status.HTTP_201_CREATED)
def post_checkin(
    goal_id: str,
    payload: CheckInCreate,
    repo: SqliteCheckInRepository = Depends(get_checkin_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
) -> CheckIn:
    try:
        return create_checkin(repo, goal_repo, map_repo, goal_id, payload)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
