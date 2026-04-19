from __future__ import annotations

import hashlib
import ipaddress
from textwrap import shorten
from urllib.parse import urlparse, urlunparse

from lifemap_api.config import Settings
from lifemap_api.domain.models import (
    SourceChunkCreate,
    SourceDocument,
    SourceUrlPreview,
)


def compute_content_hash(content_text: str) -> str:
    return hashlib.sha256(content_text.encode("utf-8")).hexdigest()


def _estimate_tokens(text: str) -> int:
    return max(1, len(text.split()))


def _overlap_tail_words(text: str, overlap_tokens: int) -> str:
    words = text.split()
    if not words:
        return ""
    return " ".join(words[-overlap_tokens:])


def chunk_source_text(
    *,
    source_id: str,
    source: SourceDocument,
    settings: Settings,
) -> list[SourceChunkCreate]:
    target_tokens = settings.source_chunk_target_tokens
    overlap_tokens = min(settings.source_chunk_overlap_tokens, target_tokens // 2)
    paragraphs = [
        paragraph.strip()
        for paragraph in source.content_text.split("\n\n")
        if paragraph.strip()
    ]

    if not paragraphs:
        paragraphs = [source.content_text.strip()]

    chunks: list[SourceChunkCreate] = []
    current_parts: list[str] = []
    current_tokens = 0
    chunk_index = 0

    for paragraph in paragraphs:
        paragraph_tokens = _estimate_tokens(paragraph)
        should_flush = current_parts and current_tokens + paragraph_tokens > target_tokens
        if should_flush:
            chunk_text = "\n\n".join(current_parts)
            chunks.append(
                SourceChunkCreate(
                    source_id=source_id,
                    chunk_index=chunk_index,
                    text=chunk_text,
                    token_estimate=_estimate_tokens(chunk_text),
                    metadata={
                        "title": source.title,
                        "url": source.url,
                        "source_type": source.source_type,
                        "content_hash": source.content_hash,
                    },
                    embedding_status="pending",
                )
            )
            chunk_index += 1
            overlap_text = _overlap_tail_words(chunk_text, overlap_tokens)
            current_parts = [overlap_text] if overlap_text else []
            current_tokens = _estimate_tokens(overlap_text) if overlap_text else 0

        current_parts.append(paragraph)
        current_tokens += paragraph_tokens

    if current_parts:
        chunk_text = "\n\n".join(current_parts)
        chunks.append(
            SourceChunkCreate(
                source_id=source_id,
                chunk_index=chunk_index,
                text=chunk_text,
                token_estimate=_estimate_tokens(chunk_text),
                metadata={
                    "title": source.title,
                    "url": source.url,
                    "source_type": source.source_type,
                    "content_hash": source.content_hash,
                },
                embedding_status="pending",
            )
        )

    return chunks


def build_search_snippet(text: str, *, max_length: int = 220) -> str:
    normalized = " ".join(text.split())
    return shorten(normalized, width=max_length, placeholder="...")


def preview_source_url(url: str) -> SourceUrlPreview:
    normalized = url.strip()
    parsed = urlparse(normalized)

    if parsed.scheme not in {"http", "https"}:
        return SourceUrlPreview(
            url=url,
            normalized_url=None,
            policy_state="blocked_by_policy",
            reason="Only http and https URLs are allowed for source preview.",
            fetch_allowed=False,
            metadata_only=False,
            domain=None,
        )

    hostname = parsed.hostname
    if not hostname:
        return SourceUrlPreview(
            url=url,
            normalized_url=None,
            policy_state="blocked_by_policy",
            reason="The URL is missing a valid hostname.",
            fetch_allowed=False,
            metadata_only=False,
            domain=None,
        )

    lowered_hostname = hostname.lower()
    if lowered_hostname in {"localhost", "127.0.0.1", "::1"}:
        return SourceUrlPreview(
            url=url,
            normalized_url=None,
            policy_state="blocked_by_policy",
            reason="Localhost URLs are blocked from source ingestion.",
            fetch_allowed=False,
            metadata_only=False,
            domain=lowered_hostname,
        )

    try:
        ip = ipaddress.ip_address(lowered_hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local:
            return SourceUrlPreview(
                url=url,
                normalized_url=None,
                policy_state="blocked_by_policy",
                reason="Private-network URLs are blocked from source ingestion.",
                fetch_allowed=False,
                metadata_only=False,
                domain=lowered_hostname,
            )
    except ValueError:
        pass

    normalized_url = urlunparse(parsed._replace(fragment=""))
    return SourceUrlPreview(
        url=url,
        normalized_url=normalized_url,
        policy_state="public_url_metadata",
        reason=(
            "URL preview is allowed, but content fetch remains disabled until the crawling phase."
        ),
        fetch_allowed=False,
        metadata_only=True,
        domain=lowered_hostname,
    )
