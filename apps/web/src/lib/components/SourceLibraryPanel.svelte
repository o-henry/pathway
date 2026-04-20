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

  let sourceTitle = $state('Field observation note');
  let sourceBody = $state(
    'Short feedback loops tend to stay usable longer than large plans when the available time budget is inconsistent.'
  );
  let searchQuery = $state('feedback loop retention');
  let previewUrl = $state('https://example.com/product-research-note');
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
            metadata: { tags: ['manual', 'pathway'] }
          })
        })
      );
      lastSource = source;
      saveMessage = `Stored ${source.title} in the evidence desk.`;
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
      <p class="eyebrow">Evidence desk</p>
      <h2>Build the evidence layer behind the graph</h2>
      <p class="copy">
        Manual notes, local search hits, and allowed URL previews all feed the research layer that
        later revisions can cite.
      </p>
    </div>
  </div>

  <div class="grid">
    <article class="card">
      <h3>Query the evidence base</h3>
      <label>
        <span>Query</span>
        <input bind:value={searchQuery} />
      </label>
      <button type="button" onclick={handleSearch} disabled={isSearching}>
        {#if isSearching}Searching...{:else}Search stored evidence{/if}
      </button>
      <div class="results">
        {#if searchResults.length === 0}
          <p class="muted">No search results yet.</p>
        {:else}
          {#each searchResults as result (result.chunk_id)}
            <div class="result-card">
              <strong>{result.title}</strong>
              <p>{result.snippet}</p>
              <small>
                similarity {result.similarity_score.toFixed(3)} · {result.reliability}
              </small>
            </div>
          {/each}
        {/if}
      </div>
    </article>

    <article class="card">
      <h3>Capture a note</h3>
      <label>
        <span>Source title</span>
        <input bind:value={sourceTitle} />
      </label>
      <label>
        <span>Observed pattern</span>
        <textarea bind:value={sourceBody} rows="5"></textarea>
      </label>
      <button type="button" onclick={handleSaveSource} disabled={isSaving}>
        {#if isSaving}Saving...{:else}Store evidence note{/if}
      </button>
      {#if saveMessage}
        <p class="success">{saveMessage}</p>
      {/if}
      {#if lastSource}
        <p class="muted">Latest source id: {lastSource.id}</p>
      {/if}
    </article>

    <article class="card">
      <h3>URL policy gate</h3>
      <label>
        <span>Candidate URL</span>
        <input bind:value={previewUrl} />
      </label>
      <button type="button" onclick={handlePreviewUrl} disabled={isPreviewing}>
        {#if isPreviewing}Previewing...{:else}Check policy state{/if}
      </button>
      {#if lastPreview}
        <div class="result-card">
          <strong>{lastPreview.policy_state}</strong>
          <p>{lastPreview.reason}</p>
          <small>
            {lastPreview.domain ?? 'no-domain'} · fetch_allowed {String(lastPreview.fetch_allowed)}
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
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    padding: 1rem;
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
    color: var(--pathway-accent-strong);
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin-top: 0.2rem;
    font-size: clamp(1.2rem, 1.45vw, 1.7rem);
    line-height: 1.15;
  }

  .copy,
  .muted,
  .result-card p,
  small {
    color: var(--pathway-muted);
    line-height: 1.6;
  }

  .grid {
    display: grid;
    gap: 1rem;
  }

  .card {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.42);
    padding: 0.95rem;
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  label span {
    color: var(--pathway-muted);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  input,
  textarea,
  button {
    font: inherit;
  }

  input,
  textarea {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.62);
    color: var(--pathway-ink);
    padding: 0.78rem 0.82rem;
  }

  textarea {
    resize: vertical;
  }

  button {
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-chip-radius);
    background: var(--pathway-ink);
    color: white;
    cursor: pointer;
    font-weight: 800;
    padding: 0.74rem 0.92rem;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .result-card {
    display: grid;
    gap: 0.35rem;
    border-left: 3px solid var(--pathway-accent);
    background: rgba(255, 255, 255, 0.55);
    padding: 0.8rem 0.9rem;
  }

  .success {
    color: var(--pathway-success);
    font-weight: 700;
  }

  .error {
    border-left: 3px solid var(--pathway-danger);
    background: rgba(245, 230, 224, 0.9);
    color: #733624;
    padding: 0.8rem 0.9rem;
  }

  @media (min-width: 1000px) {
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
</style>
