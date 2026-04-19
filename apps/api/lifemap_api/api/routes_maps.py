from fastapi import APIRouter, Depends, HTTPException, Response, status

from lifemap_api.api.dependencies import (
    get_goal_repository,
    get_lifemap_repository,
    get_profile_repository,
)
from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.application.maps import (
    create_map,
    export_map_bundle,
    export_map_markdown,
    get_map,
    import_map_bundle,
)
from lifemap_api.domain.models import LifeMap, LifeMapCreate, MapExportEnvelope, MapImportEnvelope
from lifemap_api.infrastructure.repositories import (
    SqliteGoalRepository,
    SqliteLifeMapRepository,
    SqliteProfileRepository,
)

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


@router.get("/{map_id}/export/json", response_model=MapExportEnvelope)
def read_map_export_json(
    map_id: str,
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    profile_repo: SqliteProfileRepository = Depends(get_profile_repository),
) -> MapExportEnvelope:
    try:
        return export_map_bundle(
            map_id=map_id,
            map_repo=map_repo,
            goal_repo=goal_repo,
            profile_repo=profile_repo,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{map_id}/export/markdown")
def read_map_export_markdown(
    map_id: str,
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
) -> Response:
    try:
        markdown = export_map_markdown(
            map_id=map_id,
            map_repo=map_repo,
            goal_repo=goal_repo,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return Response(content=markdown, media_type="text/markdown; charset=utf-8")


@router.post("/import", response_model=LifeMap, status_code=status.HTTP_201_CREATED)
def post_map_import(
    payload: MapImportEnvelope,
    map_repo: SqliteLifeMapRepository = Depends(get_lifemap_repository),
    goal_repo: SqliteGoalRepository = Depends(get_goal_repository),
    profile_repo: SqliteProfileRepository = Depends(get_profile_repository),
) -> LifeMap:
    return import_map_bundle(
        payload=payload,
        map_repo=map_repo,
        goal_repo=goal_repo,
        profile_repo=profile_repo,
    )
