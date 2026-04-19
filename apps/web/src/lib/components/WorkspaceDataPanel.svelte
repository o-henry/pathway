<script lang="ts">
  import {
    downloadTextFile,
    getApiBaseUrl,
    readJson,
    readText,
    type GeneratedMapResponse,
    type MapExportEnvelope
  } from '$lib/api/client';

  let {
    currentMap,
    onImported
  }: {
    currentMap: GeneratedMapResponse | null;
    onImported?: (map: GeneratedMapResponse) => void;
  } = $props();

  const apiBaseUrl = getApiBaseUrl();

  let exportMessage = $state('');
  let importMessage = $state('');
  let errorMessage = $state('');
  let isExportingJson = $state(false);
  let isExportingMarkdown = $state(false);
  let isImporting = $state(false);

  function buildFileStem(map: GeneratedMapResponse): string {
    const compactTitle = map.title
      .toLowerCase()
      .replaceAll(/[^a-z0-9가-힣]+/g, '-')
      .replaceAll(/^-+|-+$/g, '')
      .slice(0, 48);

    return compactTitle || `life-map-${map.id}`;
  }

  async function handleExportJson() {
    if (!currentMap) {
      return;
    }

    isExportingJson = true;
    errorMessage = '';
    exportMessage = '';

    try {
      const payload = await readJson<MapExportEnvelope>(
        await fetch(`${apiBaseUrl}/maps/${currentMap.id}/export/json`)
      );
      const content = JSON.stringify(payload, null, 2);
      downloadTextFile(`${buildFileStem(currentMap)}.json`, content, 'application/json');
      exportMessage = 'JSON export를 내려받았습니다.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'JSON export failed';
    } finally {
      isExportingJson = false;
    }
  }

  async function handleExportMarkdown() {
    if (!currentMap) {
      return;
    }

    isExportingMarkdown = true;
    errorMessage = '';
    exportMessage = '';

    try {
      const markdown = await readText(await fetch(`${apiBaseUrl}/maps/${currentMap.id}/export/markdown`));
      downloadTextFile(`${buildFileStem(currentMap)}.md`, markdown, 'text/markdown');
      exportMessage = 'Markdown export를 내려받았습니다.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Markdown export failed';
    } finally {
      isExportingMarkdown = false;
    }
  }

  async function handleImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    isImporting = true;
    errorMessage = '';
    importMessage = '';

    try {
      const raw = await file.text();
      const envelope = JSON.parse(raw);
      const importedMap = await readJson<GeneratedMapResponse>(
        await fetch(`${apiBaseUrl}/maps/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(envelope)
        })
      );

      importMessage = `Imported ${importedMap.title} as a new local snapshot.`;
      onImported?.(importedMap);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Import failed';
    } finally {
      isImporting = false;
    }
  }
</script>

<section class="workspace-panel">
  <div class="section-header">
    <div>
      <p class="eyebrow">Phase 8</p>
      <h2>Export, import, and local backup hygiene</h2>
      <p class="copy">
        현재 snapshot을 JSON/Markdown으로 내보내고, 이전 export를 다시 불러와 새 로컬 map으로
        복원할 수 있습니다.
      </p>
    </div>
  </div>

  <div class="grid">
    <article class="card">
      <h3>Map export</h3>
      {#if currentMap}
        <p class="muted">Active map: {currentMap.title}</p>
        <div class="button-row">
          <button type="button" onclick={handleExportJson} disabled={isExportingJson}>
            {#if isExportingJson}Exporting JSON...{:else}Export JSON{/if}
          </button>
          <button type="button" class="secondary" onclick={handleExportMarkdown} disabled={isExportingMarkdown}>
            {#if isExportingMarkdown}Exporting Markdown...{:else}Export Markdown{/if}
          </button>
        </div>
      {:else}
        <p class="muted">먼저 map을 생성해야 export가 가능합니다.</p>
      {/if}
    </article>

    <article class="card">
      <h3>Map import</h3>
      <p class="muted">
        이전에 export한 `.json` snapshot을 불러오면 현재 워크스페이스에 새 map 레코드로 추가됩니다.
      </p>
      <label class="file-input">
        <span>{#if isImporting}Importing...{:else}Choose JSON export{/if}</span>
        <input type="file" accept="application/json,.json" onchange={handleImportFile} disabled={isImporting} />
      </label>
    </article>

    <article class="card">
      <h3>Backup guide</h3>
      <p class="muted">
        전체 로컬 상태를 보존하려면 `data/local.db`와 `data/lancedb/` 디렉터리를 함께 백업하면
        됩니다.
      </p>
      <ul>
        <li>`data/local.db`: profiles, goals, maps, check-ins, revision proposals</li>
        <li>`data/lancedb/`: source chunks and retrieval index</li>
        <li>`data/uploads/`: 이후 파일 ingest를 붙일 때 원본 보관 위치</li>
      </ul>
    </article>
  </div>

  {#if exportMessage}
    <p class="success">{exportMessage}</p>
  {/if}

  {#if importMessage}
    <p class="success">{importMessage}</p>
  {/if}

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</section>

<style>
  .workspace-panel {
    display: grid;
    gap: 1rem;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 16px 34px rgba(84, 63, 77, 0.08);
    padding: 1.4rem;
  }

  .section-header,
  .grid {
    display: grid;
    gap: 0.8rem;
  }

  .grid {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  .eyebrow,
  h2,
  h3,
  p,
  ul {
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

  .copy,
  .muted {
    color: #584955;
    line-height: 1.6;
  }

  .card {
    display: grid;
    gap: 0.8rem;
    border-radius: 22px;
    background: rgba(255, 251, 246, 0.92);
    padding: 1rem;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  button,
  .file-input span {
    border: 0;
    border-radius: 999px;
    background: #2f2330;
    color: white;
    cursor: pointer;
    font: inherit;
    font-weight: 800;
    padding: 0.75rem 1rem;
  }

  button.secondary {
    background: #77586a;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .file-input {
    display: inline-flex;
    align-items: center;
    width: fit-content;
  }

  .file-input input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  ul {
    padding-left: 1.1rem;
    color: #584955;
    line-height: 1.6;
  }

  .success,
  .error {
    border-radius: 18px;
    padding: 0.85rem 0.95rem;
  }

  .success {
    background: rgba(237, 252, 239, 0.92);
    color: #2f6b37;
  }

  .error {
    background: rgba(255, 239, 236, 0.92);
    color: #7d352c;
  }
</style>
