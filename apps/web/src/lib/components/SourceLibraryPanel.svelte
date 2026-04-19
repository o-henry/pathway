<script lang="ts">
  import { getApiBaseUrl, readJson } from '$lib/api/client';

  interface SourceDocumentResponse {
    id: string;
    title: string;
    source_type: string;
    created_at: string;
  }

  interface SourceSearchHit {
    chunk_id: string;
    source_id: string;
    title: string;
    url: string | null;
    snippet: string;
    similarity_score: number;
    reliability: string;
    source_type: string;
  }

  interface SourceUrlPreview {
    url: string;
    normalized_url: string | null;
    policy_state: string;
    reason: string;
    fetch_allowed: boolean;
    metadata_only: boolean;
    domain: string | null;
  }

  const apiBaseUrl = getApiBaseUrl();

  let sourceTitle = $state('일본어 루틴 메모');
  let sourceBody = $state(
    '일본어 여행 회화를 목표로 하면, Anki 복습과 짧은 speaking drill을 같이 넣는 편이 덜 질린다.'
  );
  let searchQuery = $state('일본어 speaking');
  let previewUrl = $state('https://example.com/japanese-study-note');
  let saveMessage = $state('');
  let errorMessage = $state('');
  let searchResults = $state<SourceSearchHit[]>([]);
  let lastSource = $state<SourceDocumentResponse | null>(null);
  let lastPreview = $state<SourceUrlPreview | null>(null);
  let isSaving = $state(false);
  let isSearching = $state(false);
  let isPreviewing = $state(false);

  async function handleSaveSource() {
    isSaving = true;
    errorMessage = '';
    saveMessage = '';

    try {
      const source = await readJson<SourceDocumentResponse>(
        await fetch(`${apiBaseUrl}/sources/manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: sourceTitle,
            content_text: sourceBody,
            source_type: 'manual_note',
            metadata: { tags: ['manual', 'phase-5'] }
          })
        })
      );
      lastSource = source;
      saveMessage = `Saved source ${source.title}`;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown source ingestion failure';
    } finally {
      isSaving = false;
    }
  }

  async function handleSearch() {
    isSearching = true;
    errorMessage = '';

    try {
      searchResults = await readJson<SourceSearchHit[]>(
        await fetch(
          `${apiBaseUrl}/sources/search?query=${encodeURIComponent(searchQuery)}&limit=5`
        )
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown source search failure';
    } finally {
      isSearching = false;
    }
  }

  async function handlePreviewUrl() {
    isPreviewing = true;
    errorMessage = '';

    try {
      lastPreview = await readJson<SourceUrlPreview>(
        await fetch(`${apiBaseUrl}/sources/url-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: previewUrl })
        })
      );
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown URL preview failure';
    } finally {
      isPreviewing = false;
    }
  }
</script>

<section class="source-panel">
  <div class="section-header">
    <div>
      <p class="eyebrow">Phase 5</p>
      <h2>Source library + local retrieval</h2>
      <p class="copy">
        사용자 노트를 저장하고 chunk/embedding/index를 거쳐 바로 검색합니다. URL preview는 아직
        정책 판정만 수행합니다.
      </p>
    </div>
  </div>

  <div class="grid">
    <article class="card">
      <h3>Manual note ingest</h3>
      <label>
        <span>Title</span>
        <input bind:value={sourceTitle} />
      </label>
      <label>
        <span>Body</span>
        <textarea bind:value={sourceBody} rows="5"></textarea>
      </label>
      <button type="button" onclick={handleSaveSource} disabled={isSaving}>
        {#if isSaving}Saving...{:else}Save source{/if}
      </button>
      {#if saveMessage}
        <p class="success">{saveMessage}</p>
      {/if}
      {#if lastSource}
        <p class="muted">Latest source id: {lastSource.id}</p>
      {/if}
    </article>

    <article class="card">
      <h3>Source search</h3>
      <label>
        <span>Query</span>
        <input bind:value={searchQuery} />
      </label>
      <button type="button" onclick={handleSearch} disabled={isSearching}>
        {#if isSearching}Searching...{:else}Search chunks{/if}
      </button>
      <div class="results">
        {#if searchResults.length === 0}
          <p class="muted">No retrieval results yet.</p>
        {:else}
          {#each searchResults as result (result.chunk_id)}
            <div class="result-card">
              <strong>{result.title}</strong>
              <p>{result.snippet}</p>
              <small>
                score {result.similarity_score.toFixed(3)} · {result.reliability}
              </small>
            </div>
          {/each}
        {/if}
      </div>
    </article>

    <article class="card">
      <h3>URL preview skeleton</h3>
      <label>
        <span>URL</span>
        <input bind:value={previewUrl} />
      </label>
      <button type="button" onclick={handlePreviewUrl} disabled={isPreviewing}>
        {#if isPreviewing}Previewing...{:else}Preview policy{/if}
      </button>
      {#if lastPreview}
        <div class="result-card">
          <strong>{lastPreview.policy_state}</strong>
          <p>{lastPreview.reason}</p>
          <small>
            {lastPreview.domain ?? 'no-domain'} · metadata_only {String(lastPreview.metadata_only)}
          </small>
        </div>
      {/if}
    </article>
  </div>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</section>

<style>
  .source-panel {
    display: grid;
    gap: 1rem;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 16px 34px rgba(84, 63, 77, 0.08);
    padding: 1.4rem;
  }

  .section-header,
  .card,
  .results {
    display: grid;
    gap: 0.8rem;
  }

  .eyebrow,
  h2,
  h3,
  p,
  span {
    margin: 0;
  }

  .eyebrow {
    color: #8a5562;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin-top: 0.25rem;
    font-size: clamp(1.3rem, 1.6vw, 1.8rem);
  }

  .copy {
    margin-top: 0.45rem;
    color: #584955;
    line-height: 1.6;
    max-width: 68ch;
  }

  .grid {
    display: grid;
    gap: 1rem;
  }

  .card {
    border-radius: 22px;
    background: rgba(255, 251, 246, 0.92);
    padding: 1rem;
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  label span {
    color: #5d4a56;
    font-size: 0.82rem;
    font-weight: 700;
  }

  input,
  textarea,
  button {
    font: inherit;
  }

  input,
  textarea {
    border: 1px solid rgba(94, 78, 92, 0.14);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.9);
    color: #2f2330;
    padding: 0.8rem 0.9rem;
  }

  textarea {
    resize: vertical;
  }

  button {
    border: 0;
    border-radius: 999px;
    background: #2f2330;
    color: white;
    cursor: pointer;
    font-weight: 800;
    padding: 0.75rem 1rem;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .result-card {
    display: grid;
    gap: 0.35rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.85);
    padding: 0.8rem 0.9rem;
  }

  .muted,
  .result-card p,
  small {
    color: #5f505b;
    line-height: 1.55;
  }

  .success {
    color: #2f6e4d;
    font-weight: 700;
  }

  .error {
    border-left: 4px solid #d06b5d;
    border-radius: 18px;
    background: rgba(255, 239, 236, 0.92);
    color: #7d352c;
    padding: 0.85rem 0.95rem;
  }

  @media (min-width: 1000px) {
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
