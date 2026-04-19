# RAG and Crawling Specification

## 1. Goal

Support evidence-aware Life Map generation using the user's own source library.

The app should prefer:

1. user-written notes
2. user-provided source excerpts
3. user-pasted URLs that are safely and explicitly ingested
4. public datasets or corpora with clear usage rights

Do not assume that arbitrary community pages may be scraped.

## 2. Source policy

Every source has a policy state:

```text
manual_note             safe by user input
user_uploaded_file      safe if local and accepted file type
public_url_allowed      fetched after robots/terms/rate check
public_url_metadata     only metadata stored, no content fetched
blocked_by_policy       do not fetch
requires_user_review    user must decide
```

## 3. Forbidden behavior

Do not implement:

- login/session reuse for scraping third-party services
- CAPTCHA bypass
- anti-bot bypass
- paywall bypass
- private community scraping
- high-rate crawling
- hidden browser automation for extraction without explicit user action
- storing third-party personal data unnecessarily

Scrapling may be used only for normal parsing of permitted pages.
Its anti-bot-related capabilities must not be used in this project.

## 4. Ingestion pipeline

```text
Input source
  -> source policy check
  -> fetch or accept manual content
  -> extract main content
  -> normalize markdown/plain text
  -> compute content hash
  -> store SourceDocument
  -> chunk
  -> embed
  -> store vectors
```

## 5. Fetchers and extractors

### Manual ingest

First-class path:

- title
- body text / markdown
- optional URL
- tags
- related goal

### Crawl4AI fetcher

Use for permitted public URLs. Output should be markdown/plain text suitable for RAG.

Required behavior:

- explicit user action
- one URL at a time in MVP
- configurable rate limit
- store fetch timestamp
- store source URL and extraction metadata
- catch and explain failures

### Trafilatura/readability fallback

Use when a simpler HTML extraction is enough.

### Scrapling parser

Allowed only for permitted public pages where normal parsing is needed.
Disallow stealth/bypass options.

## 6. Chunking

Chunking defaults:

- 500–900 tokens per chunk equivalent
- 100–150 token overlap equivalent
- preserve headings and source title
- store source metadata per chunk

Chunk metadata:

```json
{
  "source_id": "src_001",
  "chunk_index": 3,
  "title": "...",
  "url": "...",
  "tags": ["japanese", "language-learning"],
  "created_at": "...",
  "hash": "..."
}
```

## 7. Embeddings and vector search

Default:

- Ollama embeddings.
- LanceDB local embedded vector store.

Optional:

- SQLite FTS5 keyword search.
- Hybrid ranker combining vector similarity and keyword hits.

Retrieval result must include:

- chunk ID
- source ID
- title
- URL if any
- snippet or summary
- similarity score
- reliability label

## 8. RAG packet for generation

Before graph generation, build an evidence packet:

```json
{
  "query": "일본어 여행 회화 6개월 주 5시간 월 10만원",
  "goal_summary": "...",
  "user_constraints": {...},
  "retrieved_evidence": [
    {
      "evidence_id": "ev_001",
      "source_id": "src_001",
      "title": "...",
      "snippet": "...",
      "source_type": "manual_note",
      "reliability": "user_saved_note"
    }
  ]
}
```

The prompt must instruct the LLM:

- cite evidence IDs inside `evidence_refs`
- do not invent source claims
- mark unsupported ideas as assumptions
- do not produce deterministic future predictions
- include uncertainty warnings

## 9. Grounding policy

A generated node may include:

- user fact: from profile/goal/check-in
- evidence-backed observation: requires `evidence_refs`
- assumption: requires `assumption_refs`
- suggestion: allowed but label as suggestion

A node should not say:

```text
비슷한 사람들은 대부분 성공했다.
```

unless the source library actually supports that claim.

Prefer:

```text
저장된 경험담에서는 6~8주차에 말하기 출력 부족을 어려움으로 언급한 사례가 있습니다.
```

## 10. Query planning

For each goal, create retrieval queries:

- direct goal query
- constraint-aware query
- risk query
- alternative path query
- check-in revision query, if applicable

Example:

```text
goal: 일본어 여행 회화
constraints: 6개월, 주 5시간, 월 10만원, 쉽게 질림
queries:
  - 일본어 여행 회화 6개월 독학
  - 일본어 공부 주 5시간 지속 실패 지점
  - 일본어 회화 초보 말하기 출력 루틴
  - 일본어 독학 2개월차 지루함 극복
```

## 11. Evaluation

Create fixture sources under tests, not live network calls.

Test cases:

- manual source can be ingested and chunked
- duplicate source hash prevents duplicate chunks
- retrieval returns relevant fixture chunks
- generated graph references only existing evidence IDs
- unsupported claims are marked as assumptions
- source fetch blocked by policy does not create content

## 12. Later enhancements

- Local SearXNG discovery adapter.
- Common Crawl based research corpus.
- GraphRAG-like community summaries for large source libraries.
- DSPy-based prompt optimization/evaluation.
- Source reliability scoring.
