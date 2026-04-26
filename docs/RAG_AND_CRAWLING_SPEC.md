# RAG and Crawling Specification

## 1. Goal

Support evidence-aware Pathway generation using:

1. the user's own source library
2. targeted goal-specific research
3. broader contextual research that helps the graph branch into alternatives, missed opportunities, and future route switches

The app should prefer:

1. user-written notes
2. user-provided source excerpts
3. user-pasted URLs that are safely and explicitly ingested
4. public datasets or corpora with clear usage rights
5. permitted public web sources that can be fetched safely

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
- high-rate crawling
 storing third-party personal data unnecessarily

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

## 4.1 Research layers

The system should distinguish between:

- `user context`: notes, check-ins, uploaded files, pasted excerpts
- `targeted evidence`: sources directly about the goal and route options
- `contextual expansion`: sources about adjacent routes, trade-offs, cost drivers, common failure modes, and switching conditions

Contextual expansion exists so the graph can grow laterally, not just linearly.

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

### Lightpanda renderer

Use when a page requires JavaScript execution but full Chromium overhead is unnecessary.
Prefer safe page rendering, markdown/html extraction, and robots-aware operation.
Do not treat it as a bypass tool.

### Scrapy orchestration

Use when the project needs breadth-first or scheduled crawling over a bounded allowed domain set.
Do not introduce Scrapy before there is a clear orchestration need.

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

- Deterministic local embeddings by default
- LanceDB local embedded vector store

Optional:

- SQLite FTS5 keyword search
- hybrid ranker combining vector similarity and keyword hits

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
  "user_constraints": {},
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

For multi-step synthesis, prefer chained prompts:

1. extract grounded findings
2. critique weak findings
3. synthesize route options
4. emit final schema-valid graph bundle

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
- contextual expansion query
- missed-opportunity / opportunity-cost query

Example:

```text
goal: 일본어 여행 회화
constraints: 6개월, 주 5시간, 월 10만원, 쉽게 질림
queries:
  - 일본어 여행 회화 6개월 독학
  - 일본어 공부 주 5시간 지속 실패 지점
  - 일본어 회화 초보 말하기 출력 루틴
  - 일본어 독학 2개월차 지루함 극복
  - 일본어 회화 목표에서 학원 대신 튜터를 택할 때 비용 대비 차이
  - 일본어 공부를 미루면 3개월 뒤 잃는 학습량과 전환 비용
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

- local SearXNG discovery adapter
- Common Crawl based research corpus
- GraphRAG-like community summaries for large source libraries
- DSPy-based prompt optimization/evaluation
- source reliability scoring
