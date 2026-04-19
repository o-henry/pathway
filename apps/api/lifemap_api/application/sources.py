from __future__ import annotations

from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.application.source_pipeline import (
    chunk_source_text,
    compute_content_hash,
    preview_source_url,
)
from lifemap_api.config import Settings
from lifemap_api.domain.models import (
    SourceDocument,
    SourceDocumentCreate,
    SourceSearchHit,
    SourceUrlPreview,
)
from lifemap_api.domain.ports import (
    EmbeddingProvider,
    SourceChunkRepository,
    SourceRepository,
    SourceSearchIndex,
)


def list_sources(repo: SourceRepository) -> list[SourceDocument]:
    return repo.list()


def get_source(repo: SourceRepository, source_id: str) -> SourceDocument:
    source = repo.get(source_id)
    if source is None:
        raise EntityNotFoundError("SourceDocument", source_id)
    return source


def create_manual_source(
    *,
    repo: SourceRepository,
    chunk_repo: SourceChunkRepository,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    payload: SourceDocumentCreate,
    settings: Settings,
) -> SourceDocument:
    content_hash = compute_content_hash(payload.content_text)
    existing = repo.find_by_content_hash(content_hash)
    if existing is not None:
        return existing

    source = repo.create_manual(payload)
    chunks = chunk_source_text(source_id=source.id, source=source, settings=settings)
    stored_chunks = chunk_repo.replace_for_source(source.id, chunks)
    embeddings = embedding_provider.embed_texts([chunk.text for chunk in stored_chunks])
    search_index.upsert_source_chunks(
        source=source,
        chunks=stored_chunks,
        embeddings=embeddings,
    )
    return source


def search_sources(
    *,
    query: str,
    limit: int,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
) -> list[SourceSearchHit]:
    query_embedding = embedding_provider.embed_texts([query])[0]
    return search_index.search(query_embedding=query_embedding, limit=limit)


def preview_url_source(url: str) -> SourceUrlPreview:
    return preview_source_url(url)
