from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.domain.models import LifeMap, LifeMapCreate
from lifemap_api.domain.ports import GoalRepository, LifeMapRepository


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
