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

    return compactTitle || `pathway-${map.id}`;
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
      exportMessage = '현재 Pathway snapshot을 JSON으로 내려받았습니다.';
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
      exportMessage = '현재 Pathway snapshot을 Markdown으로 내려받았습니다.';
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

      importMessage = `${importedMap.title} snapshot을 새 로컬 Pathway 레코드로 복원했습니다.`;
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
      <p class="eyebrow">Snapshot controls</p>
      <h2>현재 Pathway를 꺼내고, 보관하고, 되살립니다</h2>
      <p class="copy">
        그래프는 계속 변합니다. 그래서 지금 이 순간의 Pathway를 별도 snapshot으로 남기고, 과거
        snapshot을 다시 가져와 비교 가능한 상태로 유지하는 것이 중요합니다.
      </p>
    </div>
  </div>

  <div class="grid">
    <article class="card">
      <h3>Export current Pathway</h3>
      {#if currentMap}
        <p class="muted">Active snapshot: {currentMap.title}</p>
        <div class="button-row">
          <button type="button" onclick={handleExportJson} disabled={isExportingJson}>
            {#if isExportingJson}Exporting JSON...{:else}Export JSON snapshot{/if}
          </button>
          <button type="button" class="secondary" onclick={handleExportMarkdown} disabled={isExportingMarkdown}>
            {#if isExportingMarkdown}Exporting Markdown...{:else}Export Markdown brief{/if}
          </button>
        </div>
      {:else}
        <p class="muted">먼저 Pathway를 생성해야 snapshot export가 가능합니다.</p>
      {/if}
    </article>

    <article class="card">
      <h3>Rehydrate a prior branch</h3>
      <p class="muted">
        예전에 내보낸 `.json` snapshot을 다시 불러오면, 현재 워크스페이스에 새 Pathway 레코드로
        추가됩니다.
      </p>
      <label class="file-input">
        <span>{#if isImporting}Importing...{:else}Choose exported snapshot{/if}</span>
        <input type="file" accept="application/json,.json" onchange={handleImportFile} disabled={isImporting} />
      </label>
    </article>

    <article class="card">
      <h3>Local durability</h3>
      <p class="muted">
        이 앱은 로컬 우선입니다. 전체 상태를 보존하려면 아래 세 위치를 함께 백업해야 합니다.
      </p>
      <ul>
        <li>`data/local.db`: profiles, goals, pathways, check-ins, revision proposals</li>
        <li>`data/lancedb/`: evidence chunks and retrieval index</li>
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
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    padding: 1rem;
  }

  .section-header,
  .grid {
    display: grid;
    gap: 0.8rem;
  }

  .grid {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .eyebrow,
  h2,
  h3,
  p,
  ul {
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
  ul {
    color: var(--pathway-muted);
    line-height: 1.6;
  }

  .card {
    display: grid;
    gap: 0.8rem;
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.42);
    padding: 0.95rem;
  }

  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.7rem;
  }

  button,
  .file-input span {
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-chip-radius);
    background: var(--pathway-ink);
    color: white;
    cursor: pointer;
    font: inherit;
    font-weight: 800;
    padding: 0.74rem 0.92rem;
  }

  button.secondary {
    background: rgba(23, 20, 17, 0.8);
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
    padding-left: 1rem;
  }

  .success,
  .error {
    border-left: 3px solid;
    padding: 0.8rem 0.9rem;
  }

  .success {
    border-left-color: var(--pathway-success);
    background: rgba(232, 242, 233, 0.9);
    color: #254b31;
  }

  .error {
    border-left-color: var(--pathway-danger);
    background: rgba(245, 230, 224, 0.9);
    color: #733624;
  }
</style>
