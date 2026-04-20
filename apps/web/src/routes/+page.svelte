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
  let leftRailOpen = $state(false);
  let rightRailOpen = $state(false);
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
    leftRailOpen = false;
  }

  function handleImportedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activePreview = null;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
    rightRailOpen = false;
  }

  function handleAcceptedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activePreview = null;
    activeBundle = map.graph_bundle;
    workspaceRefreshKey += 1;
    rightRailOpen = false;
  }

  function handleSelectedMap(map: GeneratedMapResponse) {
    currentMap = map;
    activePreview = null;
    activeBundle = map.graph_bundle;
  }

  function handlePreview(preview: RevisionPreviewResponse | null) {
    activePreview = preview;
    activeBundle = preview?.proposed_graph_bundle ?? currentMap?.graph_bundle ?? exampleGraphBundle;
    rightRailOpen = Boolean(preview);
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
    { label: 'Graph board', detail: 'Live route surface' },
    { label: 'Reality loop', detail: 'State and revision' },
    { label: 'Evidence desk', detail: 'Sources and grounding' },
    { label: 'Archive', detail: 'Saved branch snapshots' }
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
  const activeSurfaceLabel = $derived(
    activeDock === 'revision' ? 'Updates' : activeDock === 'evidence' ? 'Evidence' : 'Snapshots'
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
      <section class="stage-column">
        <section class="graph-board">
          <div class="graph-board-header">
            <div class="stage-copy">
              <p class="label">Graph board</p>
              <h1>{currentMap?.title ?? 'Adaptive pathway graph'}</h1>
              <h2>{currentMap?.graph_bundle.map.summary ?? 'Map the current route, inspect pressure points, and revise as reality changes.'}</h2>
            </div>

            <div class="stage-actions">
              <button
                type="button"
                class:active={leftRailOpen}
                class="rail-toggle"
                onclick={() => (leftRailOpen = !leftRailOpen)}
              >
                <span>Intake</span>
                <strong>{leftRailOpen ? 'Hide' : 'Open'}</strong>
              </button>
              <button
                type="button"
                class:active={rightRailOpen}
                class="rail-toggle"
                onclick={() => (rightRailOpen = !rightRailOpen)}
              >
                <span>{activeSurfaceLabel}</span>
                <strong>{rightRailOpen ? 'Hide' : 'Inspect'}</strong>
              </button>
            </div>
          </div>

          <div class="graph-overlay top-left">
            <article class="overlay-card route-card">
              <span>Current route</span>
              <strong>{currentRouteLabel}</strong>
            </article>
          </div>

          <div class="graph-overlay top-right">
            <article class="overlay-card mode-card">
              <span>Board mode</span>
              <strong>{activePreview ? 'Revision preview' : 'Live snapshot'}</strong>
            </article>
          </div>

          <aside class:open={leftRailOpen} class="floating-rail left-rail">
            <section class="nav-panel">
              <div class="nav-panel-header">
                <p class="label">Workspace</p>
                <h3>{currentMap?.title ?? 'Adaptive pathway graph'}</h3>
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

          <div class:shifted-left={leftRailOpen} class:shifted-right={rightRailOpen} class="graph-canvas">
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
          </div>

          <aside class:open={rightRailOpen} class="floating-rail right-rail">
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
      </section>
    </section>
  </main>
</div>

<style>
  :global(:root) {
    --pathway-bg: #1d2329;
    --pathway-bg-strong: #171c22;
    --pathway-panel: linear-gradient(180deg, rgba(36, 44, 52, 0.96), rgba(29, 36, 43, 0.98));
    --pathway-panel-strong: linear-gradient(180deg, rgba(41, 50, 59, 0.98), rgba(31, 38, 45, 1));
    --pathway-line: rgba(171, 184, 198, 0.12);
    --pathway-line-strong: rgba(202, 212, 223, 0.17);
    --pathway-ink: #edf2f8;
    --pathway-muted: #98a6b5;
    --pathway-accent: #90a7d7;
    --pathway-accent-strong: #ced8f0;
    --pathway-warm: #c2a06f;
    --pathway-danger: #eaa08d;
    --pathway-success: #8fcbb3;
    --pathway-panel-radius: 8px;
    --pathway-card-radius: 4px;
    --pathway-chip-radius: 3px;
    --pathway-shadow: 0 18px 40px rgba(3, 8, 13, 0.24);
    --pathway-paper: linear-gradient(180deg, rgba(247, 244, 239, 0.98), rgba(239, 236, 232, 0.98));
    --pathway-paper-line: rgba(94, 92, 118, 0.08);
    --pathway-paper-ink: #352f45;
    --pathway-paper-muted: #6a657f;
  }

  :global(body) {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(136, 156, 208, 0.16), transparent 28%),
      radial-gradient(circle at bottom right, rgba(194, 160, 111, 0.09), transparent 28%),
      linear-gradient(180deg, #232a31 0%, #1a1f25 100%);
    color: var(--pathway-ink);
    font-family:
      'IBM Plex Sans', 'Pretendard Variable', 'Pretendard', system-ui, sans-serif;
  }

  .page {
    min-height: 100vh;
    padding: 0.65rem;
  }

  .app-shell {
    min-height: calc(100vh - 1.3rem);
    border: 1px solid rgba(207, 216, 226, 0.1);
    border-radius: 10px;
    background:
      linear-gradient(180deg, rgba(41, 49, 57, 0.96), rgba(27, 33, 39, 0.99));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 26px 56px rgba(0, 0, 0, 0.34);
    overflow: hidden;
  }

  .window-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 48px;
    border-bottom: 1px solid rgba(207, 216, 226, 0.08);
    background: rgba(12, 16, 20, 0.4);
    padding: 0 0.85rem;
  }

  .window-brand,
  .window-state,
  .workspace,
  .stage-column,
  .nav-list,
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
    min-height: calc(100vh - 49px - 1.3rem);
    padding: 0.72rem;
    grid-template-columns: minmax(0, 1fr);
  }

  .stage-column,
  .graph-board,
  .dock-surface,
  .graph-canvas {
    min-width: 0;
  }

  .stage-column {
    gap: 0;
  }

  .nav-panel,
  .inspector-note,
  .inspector,
  .loading-card {
    display: grid;
    gap: 0.75rem;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: linear-gradient(180deg, rgba(28, 35, 42, 0.92), rgba(21, 27, 33, 0.96));
    box-shadow: 0 16px 34px rgba(4, 8, 13, 0.28);
    padding: 0.88rem;
    backdrop-filter: blur(20px);
  }

  .graph-board-header,
  .nav-panel-header,
  .stage-copy {
    display: grid;
    gap: 0.35rem;
  }

  .nav-panel h3,
  .stage-copy h1,
  .stage-copy h2,
  .loading-card h2,
  p {
    margin: 0;
  }

  .nav-panel h3,
  .stage-copy h1 {
    font-size: clamp(1.02rem, 1.25vw, 1.22rem);
    line-height: 1.2;
  }

  .nav-list {
    gap: 0.42rem;
  }

  .nav-item {
    display: grid;
    gap: 0.16rem;
    border: 1px solid rgba(207, 216, 226, 0.12);
    background: rgba(255, 255, 255, 0.025);
    padding: 0.56rem 0.62rem;
  }

  .nav-item strong,
  .rail-toggle strong,
  .overlay-card strong {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .nav-item span,
  .rail-toggle span,
  .overlay-card span,
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

  .stage-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rail-toggle,
  .overlay-card {
    display: grid;
    gap: 0.12rem;
    border: 1px solid rgba(207, 216, 226, 0.14);
    background: rgba(17, 22, 28, 0.72);
    color: var(--pathway-ink);
    font: inherit;
    padding: 0.56rem 0.68rem;
    backdrop-filter: blur(16px);
  }

  .rail-toggle {
    min-width: 112px;
    cursor: pointer;
  }

  .rail-toggle.active {
    border-color: rgba(186, 210, 255, 0.28);
    background: rgba(39, 47, 57, 0.86);
  }

  .graph-board {
    position: relative;
    min-height: calc(100vh - 88px);
    border: 1px solid rgba(208, 217, 227, 0.12);
    border-radius: 10px;
    background:
      radial-gradient(circle at top left, rgba(108, 129, 184, 0.08), transparent 22%),
      radial-gradient(circle at bottom right, rgba(213, 174, 110, 0.06), transparent 24%),
      linear-gradient(180deg, rgba(27, 33, 40, 0.6), rgba(17, 22, 27, 0.35));
    padding: 0.32rem;
    overflow: hidden;
  }

  .graph-board-header {
    position: absolute;
    top: 0.8rem;
    left: 0.8rem;
    right: 0.8rem;
    z-index: 8;
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    pointer-events: none;
  }

  .stage-copy {
    max-width: min(58vw, 720px);
    border: 1px solid rgba(207, 216, 226, 0.12);
    background: rgba(14, 19, 24, 0.76);
    padding: 0.62rem 0.74rem;
    backdrop-filter: blur(18px);
    pointer-events: auto;
  }

  .stage-copy h2 {
    font-size: clamp(0.88rem, 0.95vw, 0.98rem);
    line-height: 1.42;
    font-weight: 450;
    color: var(--pathway-muted);
  }

  .graph-canvas {
    min-height: inherit;
    padding-top: 4.8rem;
    transition:
      padding-left 180ms ease,
      padding-right 180ms ease;
  }

  .graph-canvas.shifted-left {
    padding-left: min(28vw, 340px);
  }

  .graph-canvas.shifted-right {
    padding-right: min(30vw, 360px);
  }

  .graph-overlay {
    position: absolute;
    z-index: 8;
    pointer-events: none;
  }

  .graph-overlay.top-left {
    top: 5.8rem;
    left: 0.85rem;
  }

  .graph-overlay.top-right {
    top: 5.8rem;
    right: 0.85rem;
  }

  .floating-rail {
    position: absolute;
    top: 0.8rem;
    bottom: 0.8rem;
    z-index: 9;
    display: grid;
    gap: 0.7rem;
    width: min(28vw, 340px);
    opacity: 0;
    pointer-events: none;
    transform: translateX(-16px);
    transition:
      opacity 180ms ease,
      transform 180ms ease;
  }

  .floating-rail.open {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
  }

  .left-rail {
    left: 0.8rem;
  }

  .right-rail {
    right: 0.8rem;
    width: min(30vw, 360px);
    transform: translateX(16px);
  }

  .right-rail.open {
    transform: translateX(0);
  }

  .inspector-note {
    background: var(--pathway-panel-strong);
  }

  .system-note-list p {
    border-left: 2px solid rgba(186, 210, 255, 0.24);
    padding-left: 0.65rem;
  }

  .inspector {
    overflow: hidden;
    min-height: 0;
    padding: 0;
  }

  .dock-tab-row {
    display: flex;
    gap: 0.32rem;
    border-bottom: 1px solid var(--pathway-line);
    background: rgba(10, 14, 18, 0.42);
    padding: 0.58rem;
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
    padding: 0.46rem 0.58rem;
    text-transform: uppercase;
  }

  .dock-tab-row button.active {
    border-color: rgba(186, 210, 255, 0.3);
    background: rgba(135, 174, 232, 0.14);
    color: var(--pathway-ink);
  }

  .dock-surface {
    min-height: 0;
    height: calc(100% - 54px);
    overflow: auto;
  }

  .dock-surface :global(section) {
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  @media (max-width: 920px) {
    .window-bar,
    .window-state {
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

    .stage-actions {
      width: 100%;
      justify-content: stretch;
    }

    .graph-board-header {
      position: absolute;
      inset: 0.7rem 0.7rem auto;
      display: grid;
      gap: 0.6rem;
    }

    .stage-copy {
      max-width: none;
    }

    .rail-toggle {
      flex: 1;
    }

    .floating-rail {
      top: auto;
      left: 0.6rem;
      right: 0.6rem;
      bottom: 0.6rem;
      width: auto;
      max-height: min(52vh, 520px);
    }

    .left-rail,
    .right-rail {
      transform: translateY(18px);
    }

    .left-rail.open,
    .right-rail.open {
      transform: translateY(0);
    }

    .graph-canvas.shifted-left,
    .graph-canvas.shifted-right {
      padding-left: 0;
      padding-right: 0;
      padding-bottom: min(54vh, 540px);
    }

    .graph-overlay.top-right {
      top: 8.6rem;
      right: 0.85rem;
    }

    .graph-overlay.top-left {
      top: 8.6rem;
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
