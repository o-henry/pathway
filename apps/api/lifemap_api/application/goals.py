from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.domain.models import Goal, GoalCreate, GoalUpdate
from lifemap_api.domain.ports import GoalRepository


def list_goals(repo: GoalRepository) -> list[Goal]:
    return repo.list()


def get_goal(repo: GoalRepository, goal_id: str) -> Goal:
    goal = repo.get(goal_id)
    if goal is None:
        raise EntityNotFoundError("Goal", goal_id)
    return goal


def create_goal(repo: GoalRepository, payload: GoalCreate) -> Goal:
    return repo.create(payload)


def update_goal(repo: GoalRepository, goal_id: str, payload: GoalUpdate) -> Goal:
    goal = repo.update(goal_id, payload)
    if goal is None:
        raise EntityNotFoundError("Goal", goal_id)
    return goal


def delete_goal(repo: GoalRepository, goal_id: str) -> None:
    deleted = repo.delete(goal_id)
    if not deleted:
        raise EntityNotFoundError("Goal", goal_id)
