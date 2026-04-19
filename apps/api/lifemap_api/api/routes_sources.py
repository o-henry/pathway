from fastapi import APIRouter, Depends, HTTPException, Query, status

from lifemap_api.api.dependencies import (
    get_embedding_provider,
    get_source_chunk_repository,
    get_source_repository,
    get_source_search_index,
)
from lifemap_api.application.errors import (
    AppConfigurationError,
    EntityNotFoundError,
    ProviderInvocationError,
)
from lifemap_api.application.sources import (
    create_manual_source,
    get_source,
    list_sources,
    preview_url_source,
    search_sources,
)
from lifemap_api.config import get_settings
from lifemap_api.domain.models import (
    SourceDocument,
    SourceDocumentCreate,
    SourceSearchHit,
    SourceUrlPreview,
    SourceUrlPreviewRequest,
)
from lifemap_api.domain.ports import EmbeddingProvider, SourceSearchIndex
from lifemap_api.infrastructure.repositories import (
    SqliteSourceChunkRepository,
    SqliteSourceRepository,
)

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
    chunk_repo: SqliteSourceChunkRepository = Depends(get_source_chunk_repository),
    embedding_provider: EmbeddingProvider = Depends(get_embedding_provider),
    search_index: SourceSearchIndex = Depends(get_source_search_index),
) -> SourceDocument:
    try:
        return create_manual_source(
            repo=repo,
            chunk_repo=chunk_repo,
            embedding_provider=embedding_provider,
            search_index=search_index,
            payload=payload,
            settings=get_settings(),
        )
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


@router.get("/search", response_model=list[SourceSearchHit])
def get_source_search(
    query: str = Query(min_length=1),
    limit: int = Query(default=5, ge=1, le=20),
    embedding_provider: EmbeddingProvider = Depends(get_embedding_provider),
    search_index: SourceSearchIndex = Depends(get_source_search_index),
) -> list[SourceSearchHit]:
    try:
        return search_sources(
            query=query,
            limit=limit,
            embedding_provider=embedding_provider,
            search_index=search_index,
        )
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


@router.post("/url-preview", response_model=SourceUrlPreview)
def post_source_url_preview(payload: SourceUrlPreviewRequest) -> SourceUrlPreview:
    return preview_url_source(payload.url)


@router.get("/{source_id}", response_model=SourceDocument)
def read_source(
    source_id: str,
    repo: SqliteSourceRepository = Depends(get_source_repository),
) -> SourceDocument:
    try:
        return get_source(repo, source_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
