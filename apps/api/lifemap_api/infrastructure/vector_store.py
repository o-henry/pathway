from __future__ import annotations

from collections.abc import Sequence

import lancedb

from lifemap_api.application.source_pipeline import build_search_snippet
from lifemap_api.domain.models import SourceChunk, SourceDocument, SourceSearchHit

TABLE_NAME = "source_chunks"


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

        rows = [
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
                "vector": embedding,
            }
            for chunk, embedding in zip(chunks, embeddings, strict=True)
        ]

        db = self._connect()
        if self._table_exists(db):
            table = db.open_table(TABLE_NAME)
            table.delete(f"source_id = '{source.id}'")
            table.add(rows)
            return

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
                )
            )
        return hits
