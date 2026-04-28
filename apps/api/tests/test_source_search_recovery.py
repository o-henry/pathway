from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

from lifemap_api.domain.models import SourceChunk, SourceDocument, SourceSearchHit
from lifemap_api.infrastructure.vector_store import RecoveringSourceSearchIndex

from .fake_embeddings import FakeEmbeddingProvider


def _source(source_id: str, source_type: str = "manual_note") -> SourceDocument:
    now = datetime.now(UTC)
    return SourceDocument(
        id=source_id,
        title=f"Source {source_id}",
        content_text="Speaking practice guidance with concrete feedback loops.",
        url=None,
        source_type=source_type,
        content_hash=f"hash-{source_id}",
        metadata={"layer": source_type},
        created_at=now,
        updated_at=now,
    )


def _chunk(source_id: str, index: int, text: str) -> SourceChunk:
    return SourceChunk(
        id=f"chunk_{source_id}_{index}",
        source_id=source_id,
        chunk_index=index,
        text=text,
        token_estimate=12,
        metadata={},
        embedding_status="ready",
        created_at=datetime.now(UTC),
    )


class StaticSourceRepo:
    def __init__(self, sources: Sequence[SourceDocument]) -> None:
        self._sources = list(sources)

    def list(self) -> list[SourceDocument]:
        return list(self._sources)


class StaticChunkRepo:
    def __init__(self, chunks_by_source: dict[str, list[SourceChunk]]) -> None:
        self._chunks_by_source = chunks_by_source

    def list_for_source(self, source_id: str) -> list[SourceChunk]:
        return list(self._chunks_by_source.get(source_id, []))


class StaleDelegate:
    def __init__(self) -> None:
        self.cleared = False
        self.upserted: list[tuple[str, int]] = []
        self._hits: list[SourceSearchHit] = []

    def count_rows(self) -> int:
        return 1

    def indexed_source_ids(self) -> set[str]:
        return {"src_stale"}

    def clear(self) -> None:
        self.cleared = True
        self._hits = []

    def replace_all_source_chunks(
        self,
        indexed_sources: Sequence[
            tuple[SourceDocument, Sequence[SourceChunk], Sequence[list[float]]]
        ],
    ) -> None:
        self.clear()
        for source, chunks, embeddings in indexed_sources:
            self.upsert_source_chunks(source=source, chunks=chunks, embeddings=embeddings)

    def upsert_source_chunks(
        self,
        *,
        source: SourceDocument,
        chunks: Sequence[SourceChunk],
        embeddings: Sequence[list[float]],
    ) -> None:
        self.upserted.append((source.id, len(chunks)))
        self._hits.extend(
            SourceSearchHit(
                chunk_id=chunk.id,
                source_id=source.id,
                title=source.title,
                url=source.url,
                snippet=chunk.text,
                similarity_score=0.9,
                reliability=source.source_type,
                source_type=source.source_type,
                metadata=source.metadata,
                source_created_at=source.created_at,
            )
            for chunk in chunks
        )
        assert len(embeddings) == len(chunks)

    def search(self, *, query_embedding: list[float], limit: int) -> list[SourceSearchHit]:
        del query_embedding
        return self._hits[:limit]


def test_recovering_source_search_index_rebuilds_stale_lancedb_from_sqlite_chunks() -> None:
    source = _source("src_manual")
    chunk = _chunk(source.id, 0, "Conversation practice improves with repeated output.")
    delegate = StaleDelegate()
    index = RecoveringSourceSearchIndex(
        delegate=delegate,  # type: ignore[arg-type]
        source_repo=StaticSourceRepo([source]),  # type: ignore[arg-type]
        chunk_repo=StaticChunkRepo({source.id: [chunk]}),  # type: ignore[arg-type]
        embedding_provider=FakeEmbeddingProvider(),
    )

    hits = index.search(query_embedding=[1.0, 0.0, 0.0], limit=5)

    assert delegate.cleared is True
    assert delegate.upserted == [("src_manual", 1)]
    assert hits[0].source_id == "src_manual"
    assert hits[0].reliability == "manual_note"
