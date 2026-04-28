from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from threading import Lock

import lancedb

from lifemap_api.application.source_pipeline import build_search_snippet
from lifemap_api.domain.models import SourceChunk, SourceDocument, SourceSearchHit
from lifemap_api.domain.ports import EmbeddingProvider, SourceChunkRepository, SourceRepository

TABLE_NAME = "source_chunks"
_TABLE_WRITE_LOCK = Lock()


def _rows_for_source_chunks(
    *,
    source: SourceDocument,
    chunks: Sequence[SourceChunk],
    embeddings: Sequence[list[float]],
) -> list[dict]:
    return [
        {
            "chunk_id": chunk.id,
            "source_id": source.id,
            "source_title": source.title,
            "source_url": source.url,
            "source_type": source.source_type,
            "reliability": source.source_type,
            "text": chunk.text,
            "token_estimate": chunk.token_estimate,
            "metadata_json": chunk.metadata,
            "source_metadata_json": source.metadata,
            "source_created_at": source.created_at.isoformat(),
            "vector": embedding,
        }
        for chunk, embedding in zip(chunks, embeddings, strict=True)
    ]


class LanceDBSourceSearchIndex:
    def __init__(self, uri: str) -> None:
        self._uri = uri

    def _connect(self):
        return lancedb.connect(self._uri)

    def _table_exists(self, db) -> bool:
        return TABLE_NAME in set(db.table_names())

    def upsert_source_chunks(
        self,
        *,
        source: SourceDocument,
        chunks: Sequence[SourceChunk],
        embeddings: Sequence[list[float]],
    ) -> None:
        if len(chunks) != len(embeddings):
            raise ValueError("chunk count and embedding count must match")
        if not chunks:
            return

        rows = _rows_for_source_chunks(source=source, chunks=chunks, embeddings=embeddings)

        with _TABLE_WRITE_LOCK:
            db = self._connect()
            if self._table_exists(db):
                table = db.open_table(TABLE_NAME)
                try:
                    table.delete(f"source_id = '{source.id}'")
                    table.add(rows)
                    return
                except Exception:
                    # Recreate the table when the stored schema lags behind the current row shape.
                    db.drop_table(TABLE_NAME)

            try:
                db.create_table(TABLE_NAME, data=rows)
            except ValueError as error:
                if "already exists" not in str(error):
                    raise
                table = db.open_table(TABLE_NAME)
                table.delete(f"source_id = '{source.id}'")
                table.add(rows)

    def replace_all_source_chunks(
        self,
        indexed_sources: Sequence[
            tuple[SourceDocument, Sequence[SourceChunk], Sequence[list[float]]]
        ],
    ) -> None:
        rows = [
            row
            for source, chunks, embeddings in indexed_sources
            for row in _rows_for_source_chunks(
                source=source,
                chunks=chunks,
                embeddings=embeddings,
            )
        ]

        with _TABLE_WRITE_LOCK:
            db = self._connect()
            if self._table_exists(db):
                db.drop_table(TABLE_NAME)
            if rows:
                db.create_table(TABLE_NAME, data=rows)

    def search(self, *, query_embedding: list[float], limit: int) -> list[SourceSearchHit]:
        db = self._connect()
        if not self._table_exists(db):
            return []

        table = db.open_table(TABLE_NAME)
        results = table.search(query_embedding).limit(limit).to_list()
        hits: list[SourceSearchHit] = []
        for row in results:
            distance = float(row.get("_distance", 0.0))
            similarity = max(0.0, 1.0 / (1.0 + distance))
            created_at_raw = row.get("source_created_at")
            try:
                created_at = (
                    datetime.fromisoformat(str(created_at_raw).replace("Z", "+00:00"))
                    if created_at_raw
                    else None
                )
            except ValueError:
                created_at = None
            hits.append(
                SourceSearchHit(
                    chunk_id=str(row["chunk_id"]),
                    source_id=str(row["source_id"]),
                    title=str(row["source_title"]),
                    url=row.get("source_url"),
                    snippet=build_search_snippet(str(row["text"])),
                    similarity_score=similarity,
                    reliability=str(row.get("reliability", "manual_note")),
                    source_type=str(row.get("source_type", "manual_note")),
                    metadata=dict(row.get("source_metadata_json") or {}),
                    source_created_at=created_at,
                )
            )
        return hits

    def clear(self) -> None:
        with _TABLE_WRITE_LOCK:
            db = self._connect()
            if self._table_exists(db):
                db.drop_table(TABLE_NAME)

    def count_rows(self) -> int:
        db = self._connect()
        if not self._table_exists(db):
            return 0
        return int(db.open_table(TABLE_NAME).count_rows())

    def indexed_source_ids(self) -> set[str]:
        db = self._connect()
        if not self._table_exists(db):
            return set()
        table = db.open_table(TABLE_NAME)
        rows = table.to_arrow().select(["source_id"]).to_pylist()
        return {str(row["source_id"]) for row in rows}


class RecoveringSourceSearchIndex:
    def __init__(
        self,
        *,
        delegate: LanceDBSourceSearchIndex,
        source_repo: SourceRepository,
        chunk_repo: SourceChunkRepository,
        embedding_provider: EmbeddingProvider,
    ) -> None:
        self._delegate = delegate
        self._source_repo = source_repo
        self._chunk_repo = chunk_repo
        self._embedding_provider = embedding_provider
        self._checked = False

    def upsert_source_chunks(
        self,
        *,
        source: SourceDocument,
        chunks: Sequence[SourceChunk],
        embeddings: Sequence[list[float]],
    ) -> None:
        self._delegate.upsert_source_chunks(
            source=source,
            chunks=chunks,
            embeddings=embeddings,
        )
        self._checked = False

    def search(self, *, query_embedding: list[float], limit: int) -> list[SourceSearchHit]:
        self._ensure_current()
        return self._delegate.search(query_embedding=query_embedding, limit=limit)

    def _ensure_current(self) -> None:
        if self._checked:
            return

        sources_with_chunks: list[tuple[SourceDocument, list[SourceChunk]]] = []
        total_chunks = 0
        source_ids_with_chunks: set[str] = set()
        for source in self._source_repo.list():
            chunks = self._chunk_repo.list_for_source(source.id)
            if not chunks:
                continue
            sources_with_chunks.append((source, chunks))
            total_chunks += len(chunks)
            source_ids_with_chunks.add(source.id)

        indexed_count = self._delegate.count_rows()
        indexed_source_ids = self._delegate.indexed_source_ids()
        is_current = (
            indexed_count == total_chunks
            and source_ids_with_chunks.issubset(indexed_source_ids)
        )
        if is_current:
            self._checked = True
            return

        indexed_sources: list[
            tuple[SourceDocument, Sequence[SourceChunk], Sequence[list[float]]]
        ] = []
        for source, chunks in sources_with_chunks:
            embeddings = self._embedding_provider.embed_texts([chunk.text for chunk in chunks])
            indexed_sources.append((source, chunks, embeddings))
        self._delegate.replace_all_source_chunks(indexed_sources)
        self._checked = True
