<script lang="ts">
  import { onMount } from 'svelte';
  import type { Component } from 'svelte';

  import type { GeneratedMapResponse, RevisionPreviewResponse, RouteSelectionRecord } from '$lib/api/client';
  import GenerateMapPanel from '$lib/components/GenerateMapPanel.svelte';
  import WorkspaceDataPanel from '$lib/components/WorkspaceDataPanel.svelte';
  import WorkspaceHistoryPanel from '$lib/components/WorkspaceHistoryPanel.svelte';
  import { exampleGraphBundle } from '$lib/fixtures/exampleGraphBundle';
  import type { GraphBundle } from '$lib/graph/types';

  let activeBundle = $state<GraphBundle>(exampleGraphBundle);
  let currentMap = $state<GeneratedMapResponse | null>(null);
  let activePreview = $state<RevisionPreviewResponse | null>(null);
  let activeRouteSelection = $state<RouteSelectionRecord | null>(null);
  let workspaceRefreshKey = $state(0);
  let activeDock = $state<'revision' | 'evidence' | 'snapshot'>('revision');
  let SourceLibraryPanelComponent = $state<Component | null>(null);
  let CheckInRevisionPanelComponent = $state<
    Component<{
      currentMap: GeneratedMapResponse | null;
      onAccepted?: (map: GeneratedMapResponse) => void;
      onPreview?: (preview: RevisionPreviewResponse | null) => void;
      onRouteSelection?: (selection: RouteSelectionRecord | null) => void;
    }> | null
  >(null);
  let StaticLifeMapComponent = $state<
    Component<{
      bundle: GraphBundle;
      selectedRouteNodeId?: string | null;
      diffOverlay?: { node_changes?: Array<{ node_id: string; change_type: string }> } | null;
      overlayMode?: boolean;
    }> | null
  >(null);

  function handleGeneratedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activePreview = null;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
  }

  function handleImportedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activePreview = null;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
  }

  function handleAcceptedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activePreview = null;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
  }

  function handleSelectedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activePreview = null;
    activeBundle = map.graph_bundle;
  }

  function handlePreview(preview: RevisionPreviewResponse | null) {
    activePreview = preview;
    activeBundle = preview?.proposed_graph_bundle ?? currentMap?.graph_bundle ?? exampleGraphBundle;
  }

  function handleRouteSelection(selection: RouteSelectionRecord | null) {
    activeRouteSelection = selection;
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

  const navigationItems = [
    { label: 'Graph', detail: 'Primary board' },
    { label: 'Updates', detail: 'Reality log' },
    { label: 'Evidence', detail: 'Research desk' },
    { label: 'Snapshots', detail: 'Saved branches' }
  ];

  const systemNotes = [
    'The graph is the workspace. Side rails support it.',
    'State changes open and close routes over time.',
    'Evidence, assumptions, and pressure points stay visible.'
  ];

  const dockTabs = [
    { id: 'revision', label: 'Updates' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'snapshot', label: 'Snapshots' }
  ] as const;

  const activeNodeCount = $derived(activeBundle.nodes.length);
  const activeEvidenceCount = $derived(activeBundle.evidence.length);
  const activeAssumptionCount = $derived(activeBundle.assumptions.length);
  const currentRouteLabel = $derived(
    activeRouteSelection
      ? (() => {
          const selectedNodeId = activeRouteSelection.selected_node_id;
          return (
            activeBundle.nodes.find((node) => node.id === selectedNodeId)?.label ?? selectedNodeId
          );
        })()
      : 'No route locked'
  );
</script>

<svelte:head>
  <title>Pathway</title>
  <meta
    name="description"
    content="Local-first graph workspace for goals, evidence, routes, and revisions."
  />
</svelte:head>

<div class="page">
  <main class="app-shell">
    <header class="window-bar">
      <div class="window-brand">
        <div class="window-lights" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div>
          <strong>Pathway</strong>
          <small>Local decision graph workspace</small>
        </div>
      </div>

      <div class="window-state">
        <span>{activeNodeCount} nodes</span>
        <span>{activeEvidenceCount} evidence</span>
        <span>{activeAssumptionCount} assumptions</span>
        {#if activePreview}
          <span class="window-pill warn">Preview active</span>
        {/if}
      </div>
    </header>

    <section class="workspace">
      <aside class="sidebar">
        <section class="nav-panel">
          <div class="nav-panel-header">
            <p class="label">Workspace</p>
            <h1>{currentMap?.title ?? 'Adaptive pathway graph'}</h1>
          </div>

          <div class="nav-list">
            {#each navigationItems as item (item.label)}
              <article class="nav-item">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </article>
            {/each}
          </div>
        </section>

        <GenerateMapPanel onGenerated={handleGeneratedMap} />

        <WorkspaceHistoryPanel
          activeMapId={currentMap?.id ?? null}
          refreshKey={workspaceRefreshKey}
          onSelectMap={handleSelectedMap}
        />
      </aside>

      <section class="stage-column">
        <section class="stage-topbar">
          <div class="stage-copy">
            <p class="label">Graph board</p>
            <h2>{currentMap?.graph_bundle.map.summary ?? 'Map the current route, inspect pressure points, and revise as reality changes.'}</h2>
          </div>

          <div class="stage-status">
            <article>
              <span>Current route</span>
              <strong>{currentRouteLabel}</strong>
            </article>
            <article>
              <span>Board mode</span>
              <strong>{activePreview ? 'Revision preview' : 'Live snapshot'}</strong>
            </article>
          </div>
        </section>

        <section class="graph-board">
          {#if StaticLifeMapComponent}
            <StaticLifeMapComponent
              bundle={activeBundle}
              selectedRouteNodeId={activeRouteSelection?.selected_node_id ?? null}
              diffOverlay={activePreview?.diff ?? null}
              overlayMode={Boolean(activePreview)}
            />
          {:else}
            <section class="loading-card">
              <p class="label">Graph engine</p>
              <h2>Loading pathway workspace</h2>
              <p>The graph surface and inspector load separately to keep the app shell responsive.</p>
            </section>
          {/if}
        </section>
      </section>

      <aside class="inspector-column">
        <section class="inspector-note">
          <p class="label">System rules</p>
          <div class="system-note-list">
            {#each systemNotes as note (note)}
              <p>{note}</p>
            {/each}
          </div>
        </section>

        <section class="inspector">
          <div class="dock-tab-row" role="tablist" aria-label="Pathway inspector">
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
                <CheckInRevisionPanelComponent
                  {currentMap}
                  onAccepted={handleAcceptedMap}
                  onPreview={handlePreview}
                  onRouteSelection={handleRouteSelection}
                />
              {/if}
            {:else if activeDock === 'evidence'}
              {#if SourceLibraryPanelComponent}
                <SourceLibraryPanelComponent />
              {/if}
            {:else}
              <WorkspaceDataPanel {currentMap} onImported={handleImportedMap} />
            {/if}
          </div>
        </section>
      </aside>
    </section>
  </main>
</div>

<style>
  :global(:root) {
    --pathway-bg: #262d35;
    --pathway-bg-strong: #1d232a;
    --pathway-panel: rgba(45, 54, 63, 0.92);
    --pathway-panel-strong: rgba(52, 63, 74, 0.96);
    --pathway-line: rgba(157, 171, 186, 0.16);
    --pathway-line-strong: rgba(183, 194, 206, 0.22);
    --pathway-ink: #edf2f8;
    --pathway-muted: #a5b2c2;
    --pathway-accent: #87aee8;
    --pathway-accent-strong: #bad2ff;
    --pathway-warm: #c69662;
    --pathway-danger: #ff9e86;
    --pathway-success: #8bd3ae;
    --pathway-panel-radius: 8px;
    --pathway-card-radius: 6px;
    --pathway-chip-radius: 4px;
    --pathway-shadow: 0 16px 34px rgba(3, 8, 13, 0.28);
  }

  :global(body) {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(116, 154, 220, 0.18), transparent 24%),
      linear-gradient(180deg, #2b333c 0%, #20262d 100%);
    color: var(--pathway-ink);
    font-family:
      'IBM Plex Sans', 'Pretendard Variable', 'Pretendard', system-ui, sans-serif;
  }

  .page {
    min-height: 100vh;
    padding: 0.75rem;
  }

  .app-shell {
    min-height: calc(100vh - 1.5rem);
    border: 1px solid rgba(207, 216, 226, 0.14);
    border-radius: 12px;
    background:
      linear-gradient(180deg, rgba(49, 59, 69, 0.96), rgba(34, 41, 49, 0.98));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.05),
      0 28px 60px rgba(0, 0, 0, 0.36);
    overflow: hidden;
  }

  .window-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 52px;
    border-bottom: 1px solid rgba(207, 216, 226, 0.1);
    background: rgba(17, 22, 28, 0.38);
    padding: 0 1rem;
  }

  .window-brand,
  .window-state,
  .workspace,
  .sidebar,
  .stage-column,
  .inspector-column,
  .nav-list,
  .stage-topbar,
  .stage-status,
  .inspector,
  .system-note-list {
    display: grid;
    gap: 0.75rem;
  }

  .window-brand {
    grid-auto-flow: column;
    align-items: center;
    justify-content: start;
    gap: 0.85rem;
  }

  .window-brand strong,
  .window-brand small,
  .label,
  .window-state span,
  .window-pill,
  .nav-item span,
  .nav-item strong,
  .stage-status span,
  .stage-status strong,
  .dock-tab-row button {
    font-family:
      'IBM Plex Mono', 'SFMono-Regular', 'Menlo', 'Monaco', monospace;
  }

  .window-brand strong {
    display: block;
    font-size: 0.86rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .window-brand small {
    color: var(--pathway-muted);
    display: block;
    font-size: 0.68rem;
    margin-top: 0.14rem;
  }

  .window-lights {
    display: flex;
    gap: 0.38rem;
  }

  .window-lights span {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
  }

  .window-lights span:first-child {
    background: #ff9072;
  }

  .window-lights span:nth-child(2) {
    background: #f6c863;
  }

  .window-lights span:last-child {
    background: #8dd6ae;
  }

  .window-state {
    grid-auto-flow: column;
    align-items: center;
    gap: 0.5rem;
  }

  .window-state span,
  .window-pill {
    border: 1px solid rgba(207, 216, 226, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: var(--pathway-muted);
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    padding: 0.34rem 0.48rem;
    text-transform: uppercase;
  }

  .window-pill.warn {
    color: #ffd3b0;
    background: rgba(198, 150, 98, 0.16);
  }

  .workspace {
    min-height: calc(100vh - 53px - 1.5rem);
    padding: 0.75rem;
  }

  .sidebar,
  .inspector-column {
    align-content: start;
  }

  .stage-column,
  .graph-board,
  .dock-surface {
    min-width: 0;
  }

  .nav-panel,
  .inspector-note,
  .loading-card {
    display: grid;
    gap: 0.8rem;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: rgba(20, 26, 32, 0.72);
    box-shadow: var(--pathway-shadow);
    padding: 0.95rem;
  }

  .nav-panel-header,
  .stage-copy {
    display: grid;
    gap: 0.35rem;
  }

  .nav-panel h1,
  .stage-copy h2,
  .loading-card h2,
  p {
    margin: 0;
  }

  .nav-panel h1 {
    font-size: clamp(1.15rem, 1.6vw, 1.5rem);
    line-height: 1.15;
  }

  .nav-list {
    gap: 0.45rem;
  }

  .nav-item {
    display: grid;
    gap: 0.16rem;
    border: 1px solid rgba(207, 216, 226, 0.12);
    background: rgba(255, 255, 255, 0.03);
    padding: 0.72rem;
  }

  .nav-item strong,
  .stage-status strong {
    font-size: 0.76rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .nav-item span,
  .stage-status span,
  .loading-card p:last-child,
  .system-note-list p {
    color: var(--pathway-muted);
    line-height: 1.5;
  }

  .label {
    color: var(--pathway-accent-strong);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .stage-topbar {
    grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
    align-items: stretch;
  }

  .stage-copy h2 {
    font-size: clamp(1rem, 1.4vw, 1.2rem);
    line-height: 1.45;
    font-weight: 500;
  }

  .stage-status {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stage-status article {
    display: grid;
    gap: 0.24rem;
    border: 1px solid var(--pathway-line-strong);
    background: rgba(18, 24, 30, 0.64);
    padding: 0.82rem;
  }

  .graph-board {
    min-height: 76vh;
  }

  .inspector-note {
    background: rgba(18, 24, 30, 0.72);
  }

  .system-note-list p {
    border-left: 2px solid rgba(186, 210, 255, 0.24);
    padding-left: 0.65rem;
  }

  .inspector {
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: rgba(20, 26, 32, 0.8);
    box-shadow: var(--pathway-shadow);
    overflow: hidden;
  }

  .dock-tab-row {
    display: flex;
    gap: 0.38rem;
    border-bottom: 1px solid var(--pathway-line);
    background: rgba(10, 14, 18, 0.42);
    padding: 0.65rem;
  }

  .dock-tab-row button {
    border: 1px solid rgba(207, 216, 226, 0.12);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.04);
    color: var(--pathway-muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    padding: 0.5rem 0.62rem;
    text-transform: uppercase;
  }

  .dock-tab-row button.active {
    border-color: rgba(186, 210, 255, 0.3);
    background: rgba(135, 174, 232, 0.14);
    color: var(--pathway-ink);
  }

  .dock-surface {
    min-height: 480px;
  }

  .dock-surface :global(section) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  @media (min-width: 1280px) {
    .workspace {
      grid-template-columns: minmax(280px, 320px) minmax(0, 1.5fr) minmax(320px, 360px);
      align-items: start;
    }

    .sidebar,
    .inspector-column {
      position: sticky;
      top: 0.75rem;
    }
  }

  @media (max-width: 1279px) {
    .stage-topbar,
    .stage-status {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 920px) {
    .window-bar,
    .window-state,
    .stage-topbar,
    .stage-status {
      grid-template-columns: minmax(0, 1fr);
    }

    .window-bar {
      display: grid;
      padding-block: 0.8rem;
    }

    .window-state {
      grid-auto-flow: row;
      justify-items: start;
    }
  }

  @media (max-width: 779px) {
    .page {
      padding: 0.45rem;
    }

    .workspace {
      padding: 0.55rem;
    }

    .app-shell {
      min-height: calc(100vh - 0.9rem);
    }
  }
</style>
