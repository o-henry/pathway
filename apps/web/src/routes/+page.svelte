<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';

  import type { GeneratedMapResponse } from '$lib/api/client';
  import GenerateMapPanel from '$lib/components/GenerateMapPanel.svelte';
  import LandingHero from '$lib/components/LandingHero.svelte';
  import WorkspaceDataPanel from '$lib/components/WorkspaceDataPanel.svelte';
  import WorkspaceHistoryPanel from '$lib/components/WorkspaceHistoryPanel.svelte';
  import { exampleGraphBundle } from '$lib/fixtures/exampleGraphBundle';
  import type { GraphBundle } from '$lib/graph/types';

  let activeBundle = $state<GraphBundle>(exampleGraphBundle);
  let currentMap = $state<GeneratedMapResponse | null>(null);
  let workspaceRefreshKey = $state(0);
  let activeDock = $state<'revision' | 'evidence' | 'history' | 'snapshot'>('revision');
  let StaticLifeMapComponent = $state<Component<{ bundle: GraphBundle }> | null>(null);
  let SourceLibraryPanelComponent = $state<Component | null>(null);
  let CheckInRevisionPanelComponent = $state<
    Component<{
      currentMap: GeneratedMapResponse | null;
      onAccepted?: (map: GeneratedMapResponse) => void;
    }> | null
  >(null);

  function handleGeneratedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
  }

  function handleImportedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
  }

  function handleAcceptedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
  }

  function handleSelectedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activeBundle = map.graph_bundle;
  }

  onMount(async () => {
    const [pathwayModule, sourceModule, revisionModule] = await Promise.all([
      import('$lib/components/lifemap/StaticLifeMap.svelte'),
      import('$lib/components/SourceLibraryPanel.svelte'),
      import('$lib/components/CheckInRevisionPanel.svelte')
    ]);

    StaticLifeMapComponent = pathwayModule.default;
    SourceLibraryPanelComponent = sourceModule.default;
    CheckInRevisionPanelComponent = revisionModule.default;
  });

  const operatingModel = [
    'Research swarm이 서로 다른 편향으로 자료를 긁고 교차 검증한다.',
    '현재의 시간, 돈, 거리, 에너지 변화가 branch를 열고 닫는다.',
    '도달 경로뿐 아니라 늦게 선택해서 잃는 것과 과한 루트도 함께 보여준다.'
  ];

  const dockTabs = [
    { id: 'revision', label: 'Revision loop' },
    { id: 'evidence', label: 'Evidence desk' },
    { id: 'history', label: 'Branch history' },
    { id: 'snapshot', label: 'Snapshot controls' }
  ] as const;
</script>

<svelte:head>
  <title>Pathway</title>
  <meta
    name="description"
    content="Local-first graph workspace for goals, evidence, routes, and revisions."
  />
</svelte:head>

<div class="page">
  <main class="workspace-shell">
    <aside class="control-rail">
      <LandingHero />
      <GenerateMapPanel onGenerated={handleGeneratedMap} />

      <section class="rail-note">
        <p class="eyebrow">Pathway rules</p>
        <div class="rule-list">
          {#each operatingModel as item (item)}
            <p>{item}</p>
          {/each}
        </div>
      </section>
    </aside>

    <section class="canvas-column">
      <div class="graph-stage">
        {#if StaticLifeMapComponent}
          <StaticLifeMapComponent bundle={activeBundle} />
        {:else}
          <section class="loading-card">
            <p class="eyebrow">Graph engine</p>
            <h2>Pathway workspace를 로딩하는 중입니다</h2>
            <p>그래프 엔진과 revision panel을 분리 로딩해 초반 번들을 가볍게 유지합니다.</p>
          </section>
        {/if}
      </div>

      <section class="dock">
        <div class="dock-tab-row" role="tablist" aria-label="Pathway dock">
          {#each dockTabs as tab (tab.id)}
            <button
              type="button"
              role="tab"
              class:active={activeDock === tab.id}
              aria-selected={activeDock === tab.id}
              onclick={() => (activeDock = tab.id)}
            >
              {tab.label}
            </button>
          {/each}
        </div>

        <div class="dock-surface">
          {#if activeDock === 'revision'}
            {#if CheckInRevisionPanelComponent}
              <CheckInRevisionPanelComponent {currentMap} onAccepted={handleAcceptedMap} />
            {/if}
          {:else if activeDock === 'evidence'}
            {#if SourceLibraryPanelComponent}
              <SourceLibraryPanelComponent />
            {/if}
          {:else if activeDock === 'history'}
            <WorkspaceHistoryPanel
              activeMapId={currentMap?.id ?? null}
              refreshKey={workspaceRefreshKey}
              onSelectMap={handleSelectedMap}
            />
          {:else}
            <WorkspaceDataPanel {currentMap} onImported={handleImportedMap} />
          {/if}
        </div>
      </section>
    </section>
  </main>
</div>

<style>
  :global(:root) {
    --pathway-bg: #f2ede2;
    --pathway-bg-strong: #e6dfd0;
    --pathway-panel: rgba(250, 247, 240, 0.92);
    --pathway-panel-strong: rgba(243, 238, 228, 0.96);
    --pathway-line: rgba(45, 40, 33, 0.12);
    --pathway-line-strong: rgba(45, 40, 33, 0.24);
    --pathway-ink: #171411;
    --pathway-muted: #61594f;
    --pathway-accent: #2d6570;
    --pathway-accent-strong: #17444d;
    --pathway-warm: #8a5a35;
    --pathway-danger: #a65440;
    --pathway-success: #356b49;
    --pathway-panel-radius: 10px;
    --pathway-card-radius: 8px;
    --pathway-chip-radius: 6px;
    --pathway-shadow: 0 18px 40px rgba(35, 30, 24, 0.08);
  }

  :global(body) {
    margin: 0;
    background:
      linear-gradient(var(--pathway-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--pathway-line) 1px, transparent 1px),
      linear-gradient(180deg, #f7f2e7 0%, var(--pathway-bg) 100%);
    background-size:
      28px 28px,
      28px 28px,
      cover;
    color: var(--pathway-ink);
    font-family:
      'IBM Plex Sans', 'Pretendard Variable', 'Pretendard', system-ui, sans-serif;
  }

  .page {
    min-height: 100vh;
    padding: 1rem;
  }

  .workspace-shell {
    display: grid;
    gap: 1rem;
    min-height: 100vh;
  }

  .control-rail,
  .canvas-column,
  .dock,
  .rule-list {
    display: grid;
    gap: 1rem;
  }

  .canvas-column,
  .graph-stage,
  .dock-surface {
    min-width: 0;
  }

  .loading-card,
  .rail-note {
    display: grid;
    gap: 0.8rem;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    padding: 1rem;
  }

  .control-rail {
    align-content: start;
  }

  .eyebrow,
  h2,
  p {
    margin: 0;
  }

  .eyebrow {
    color: var(--pathway-accent-strong);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    font-size: clamp(1.35rem, 2vw, 2rem);
    line-height: 1.1;
  }

  .loading-card p:last-child,
  .rule-list p {
    color: var(--pathway-muted);
    line-height: 1.6;
  }

  .rule-list p {
    border-left: 2px solid rgba(23, 68, 77, 0.26);
    padding-left: 0.7rem;
  }

  .graph-stage {
    min-height: 0;
  }

  .dock {
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    overflow: hidden;
  }

  .dock-tab-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-bottom: 1px solid var(--pathway-line);
    background: rgba(245, 239, 229, 0.9);
    padding: 0.75rem;
  }

  .dock-tab-row button {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-chip-radius);
    background: rgba(255, 255, 255, 0.52);
    color: var(--pathway-muted);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: 0.55rem 0.78rem;
  }

  .dock-tab-row button.active {
    border-color: rgba(23, 68, 77, 0.28);
    background: rgba(218, 229, 232, 0.92);
    color: var(--pathway-accent-strong);
  }

  .dock-surface {
    min-height: 320px;
  }

  .dock-surface :global(section) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  @media (min-width: 1120px) {
    .workspace-shell {
      grid-template-columns: minmax(340px, 390px) minmax(0, 1fr);
      align-items: start;
    }

    .control-rail {
      position: sticky;
      top: 1rem;
    }
  }
</style>
