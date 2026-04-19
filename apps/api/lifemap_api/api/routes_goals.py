from fastapi import APIRouter, Depends, HTTPException, Response, status

from lifemap_api.api.dependencies import get_goal_repository
from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.application.goals import (
    create_goal,
    delete_goal,
    get_goal,
    list_goals,
    update_goal,
)
from lifemap_api.domain.models import Goal, GoalCreate, GoalUpdate
from lifemap_api.infrastructure.repositories import SqliteGoalRepository

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
