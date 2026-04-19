from fastapi import APIRouter, Depends, HTTPException, status

from lifemap_api.api.dependencies import get_source_repository
from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.application.sources import create_manual_source, get_source, list_sources
from lifemap_api.domain.models import SourceDocument, SourceDocumentCreate
from lifemap_api.infrastructure.repositories import SqliteSourceRepository

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("", response_model=list[SourceDocument])
def read_sources(
    repo: SqliteSourceRepository = Depends(get_source_repository),
) -> list[SourceDocument]:
    return list_sources(repo)


@router.post("/manual", response_model=SourceDocument, status_code=status.HTTP_201_CREATED)
def post_manual_source(
    payload: SourceDocumentCreate,
    repo: SqliteSourceRepository = Depends(get_source_repository),
) -> SourceDocument:
    return create_manual_source(repo, payload)


@router.get("/{source_id}", response_model=SourceDocument)
def read_source(
    source_id: str,
    repo: SqliteSourceRepository = Depends(get_source_repository),
) -> SourceDocument:
    try:
        return get_source(repo, source_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
