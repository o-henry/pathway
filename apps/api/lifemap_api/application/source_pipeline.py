from __future__ import annotations

import hashlib
import ipaddress
import re
from datetime import UTC, datetime
from textwrap import shorten
from urllib import robotparser
from urllib.parse import urlparse, urlunparse

import httpx
import trafilatura
from bs4 import BeautifulSoup

from lifemap_api.application.errors import ProviderInvocationError
from lifemap_api.config import Settings
from lifemap_api.domain.models import (
    SourceChunkCreate,
    SourceDocument,
    SourceDocumentCreate,
    SourceUrlPreview,
)

FETCH_USER_AGENT = "PathwayBot/0.1 (+local-first research workspace)"
TOKEN_RE = re.compile(r"\S+")


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


def _robots_url(url: str) -> str | None:
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}/robots.txt"


def check_robots_permission(url: str) -> tuple[bool, str]:
    robots_url = _robots_url(url)
    if not robots_url:
        return False, "Could not determine robots.txt URL."

    parser = robotparser.RobotFileParser()
    parser.set_url(robots_url)
    try:
        parser.read()
    except Exception:
        return True, "robots.txt unavailable; proceeding with explicit one-off fetch."

    try:
        allowed = parser.can_fetch(FETCH_USER_AGENT, url)
    except Exception:
        return True, "robots.txt could not be interpreted; proceeding with explicit one-off fetch."

    if allowed:
        return True, "robots.txt allows fetch."
    return False, "robots.txt disallows fetch for this URL."


def _normalize_plain_text(text: str) -> str:
    lines = [" ".join(line.split()) for line in text.splitlines()]
    cleaned = "\n".join(line for line in lines if line)
    return cleaned.strip()


def _extract_text_with_fallback(*, url: str, html: str) -> tuple[str, str | None]:
    extracted = trafilatura.extract(
        html,
        url=url,
        output_format="txt",
        include_links=False,
        include_images=False,
        include_tables=False,
        favor_recall=True,
    )
    if extracted:
        metadata = trafilatura.extract_metadata(html, default_url=url)
        title = metadata.title.strip() if metadata and metadata.title else None
        return _normalize_plain_text(extracted), title

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text("\n")
    title = soup.title.get_text(" ", strip=True) if soup.title else None
    return _normalize_plain_text(text), title


def fetch_url_as_source(
    *,
    url: str,
    settings: Settings,
    title: str | None = None,
    metadata: dict[str, object] | None = None,
    collector_preference: str | None = None,
) -> SourceDocumentCreate:
    preview = preview_source_url(url)
    if preview.policy_state == "blocked_by_policy" or not preview.normalized_url:
        raise ValueError(preview.reason)

    if not settings.source_fetch_enabled:
        raise ValueError(
            "URL fetch is disabled. Set SOURCE_FETCH_ENABLED=true for explicit source ingestion."
        )

    robots_allowed, robots_reason = check_robots_permission(preview.normalized_url)
    if not robots_allowed:
        raise ValueError(robots_reason)

    headers = {
        "User-Agent": FETCH_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    }

    try:
        with httpx.Client(
            timeout=settings.llm_request_timeout_seconds,
            follow_redirects=True,
            headers=headers,
        ) as client:
            response = client.get(preview.normalized_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise ProviderInvocationError(f"URL fetch failed: {exc}") from exc

    final_url = str(response.url)
    content_type = response.headers.get("content-type", "").lower()
    collector_used = (collector_preference or "trafilatura").strip().lower()

    if "text/plain" in content_type:
        content_text = _normalize_plain_text(response.text)
        extracted_title = None
        collector_used = "httpx_plaintext"
    else:
        content_text, extracted_title = _extract_text_with_fallback(
            url=final_url,
            html=response.text,
        )
        if not content_text:
            raise ProviderInvocationError("Fetched page did not yield extractable main content.")

    parsed = urlparse(final_url)
    fallback_title = (
        title
        or extracted_title
        or parsed.path.strip("/").split("/")[-1].replace("-", " ").replace("_", " ").strip()
        or parsed.netloc
    )

    merged_metadata = dict(metadata or {})
    merged_metadata.update(
        {
            "collector_used": collector_used,
            "fetched_at": datetime.now(UTC).isoformat(),
            "final_url": final_url,
            "content_type": content_type or "unknown",
            "robots_status": robots_reason,
            "word_count": len(TOKEN_RE.findall(content_text)),
        }
    )

    return SourceDocumentCreate(
        title=fallback_title[:200],
        content_text=content_text,
        url=final_url,
        source_type="public_url_allowed",
        metadata=merged_metadata,
    )


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
