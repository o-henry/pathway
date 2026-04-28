from __future__ import annotations

import re
from datetime import UTC, datetime

from lifemap_api.application.errors import EntityNotFoundError
from lifemap_api.application.source_pipeline import (
    chunk_source_text,
    compute_content_hash,
    fetch_url_as_source,
    preview_source_url,
)
from lifemap_api.config import Settings
from lifemap_api.domain.models import (
    SourceDocument,
    SourceDocumentCreate,
    SourceSearchHit,
    SourceUrlIngestRequest,
    SourceUrlPreview,
)
from lifemap_api.domain.ports import (
    EmbeddingProvider,
    SourceChunkRepository,
    SourceRepository,
    SourceSearchIndex,
)

TOKEN_RE = re.compile(r"[A-Za-z0-9가-힣]{2,}")
STOPWORDS = {
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "from",
    "into",
    "your",
    "have",
    "what",
    "when",
    "under",
    "goal",
    "pathway",
    "route",
    "routes",
    "structures",
    "usually",
    "work",
}


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


def create_url_source(
    *,
    repo: SourceRepository,
    chunk_repo: SourceChunkRepository,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
    payload: SourceUrlIngestRequest,
    settings: Settings,
) -> SourceDocument:
    normalized_payload = fetch_url_as_source(
        url=payload.url,
        settings=settings,
        title=payload.title,
        metadata=payload.metadata,
        collector_preference=payload.collector_preference,
    )
    return create_manual_source(
        repo=repo,
        chunk_repo=chunk_repo,
        embedding_provider=embedding_provider,
        search_index=search_index,
        payload=normalized_payload,
        settings=settings,
    )


def _tokenize(value: str) -> set[str]:
    return {
        token.lower()
        for token in TOKEN_RE.findall(value)
        if len(token) > 1 and token.lower() not in STOPWORDS
    }


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def _layer_bonus(hit: SourceSearchHit) -> float:
    layer = str(hit.metadata.get("layer", "")).strip().lower()
    weights = {
        "user_context": 0.18,
        "user_saved_note": 0.18,
        "manual_note": 0.16,
        "official": 0.08,
        "research": 0.08,
        "expert-interpretation": 0.06,
        "lived_experience": 0.16,
        "personal_story": 0.14,
        "public_url_allowed": 0.03,
        "public_url_metadata": -0.18,
    }
    if hit.source_type == "manual_note":
        return max(weights.get(layer, 0.0), 0.16)
    if hit.source_type == "public_url_metadata":
        return -0.18
    return weights.get(layer, 0.0)


def _freshness_bonus(hit: SourceSearchHit) -> float:
    candidates = [
        hit.metadata.get("retrieved_at"),
        hit.metadata.get("fetched_at"),
        hit.source_created_at.isoformat() if hit.source_created_at else None,
    ]
    parsed = next((_parse_iso_datetime(str(value)) for value in candidates if value), None)
    if parsed is None:
        return 0.0

    age_days = max(0.0, (datetime.now(UTC) - parsed).total_seconds() / 86400)
    if age_days >= 120:
        return 0.0
    return 0.05 * (1 - (age_days / 120))


def _rerank_search_hits(
    *,
    query: str,
    hits: list[SourceSearchHit],
    limit: int,
) -> list[SourceSearchHit]:
    query_tokens = _tokenize(query)

    def score(hit: SourceSearchHit) -> tuple[float, str, str]:
        haystack = " ".join(
            [
                hit.title,
                hit.snippet,
                str(hit.metadata.get("layer", "")),
                str(hit.metadata.get("publisher", "")),
                str(hit.metadata.get("kind", "")),
            ]
        )
        hit_tokens = _tokenize(haystack)
        lexical_overlap = (
            len(query_tokens & hit_tokens) / max(1, len(query_tokens))
            if query_tokens
            else 0.0
        )
        blended = (
            (hit.similarity_score * 0.62)
            + (lexical_overlap * 0.22)
            + _layer_bonus(hit)
            + _freshness_bonus(hit)
        )
        return (blended, hit.title.casefold(), hit.chunk_id)

    ranked = sorted(hits, key=score, reverse=True)
    return ranked[:limit]


def search_sources(
    *,
    query: str,
    limit: int,
    embedding_provider: EmbeddingProvider,
    search_index: SourceSearchIndex,
) -> list[SourceSearchHit]:
    query_embedding = embedding_provider.embed_texts([query])[0]
    candidate_limit = max(limit * 8, 16)
    hits = search_index.search(query_embedding=query_embedding, limit=min(candidate_limit, 64))
    return _rerank_search_hits(query=query, hits=hits, limit=limit)


def preview_url_source(url: str) -> SourceUrlPreview:
    return preview_source_url(url)
