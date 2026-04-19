from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.domain.models import CheckIn, CheckInCreate
from lifemap_api.domain.ports import CheckInRepository, GoalRepository, LifeMapRepository


def list_checkins(
    repo: CheckInRepository, goal_repo: GoalRepository, goal_id: str
) -> list[CheckIn]:
    if goal_repo.get(goal_id) is None:
        raise EntityNotFoundError("Goal", goal_id)
    return repo.list_for_goal(goal_id)


def create_checkin(
    repo: CheckInRepository,
    goal_repo: GoalRepository,
    map_repo: LifeMapRepository,
    goal_id: str,
    payload: CheckInCreate,
) -> CheckIn:
    if goal_repo.get(goal_id) is None:
        raise EntityNotFoundError("Goal", goal_id)
    if payload.map_id and map_repo.get(payload.map_id) is None:
        raise EntityNotFoundError("LifeMap", payload.map_id)
    return repo.create(goal_id, payload)
