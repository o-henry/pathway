<script lang="ts">
  import {
    Background,
    BackgroundVariant,
    Panel,
    SvelteFlow,
    type Edge,
    type Node
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import { exampleGraphBundle } from '$lib/fixtures/exampleGraphBundle';
  import { buildFlow } from '$lib/graph/flow';
  import { layoutFlow } from '$lib/graph/layout';
  import {
    cloneFlowEdges,
    cloneFlowNodes,
    getBundleCacheKey,
    getPreparedBundleArtifacts
  } from '$lib/graph/performance';
  import { getProgressionPathNodeIds } from '$lib/graph/selection';
  import type {
    GraphBundle,
    GraphNodeRecord,
    MindMapEdgeData,
    MindMapNodeData
  } from '$lib/graph/types';

  import { edgeTypes, nodeTypes } from './flowRegistry';
  import NodeDetailDrawer from './NodeDetailDrawer.svelte';

  type FlowNode = Node<MindMapNodeData>;
  type FlowEdge = Edge<MindMapEdgeData>;

  interface DiffOverlay {
    node_changes?: Array<{ node_id: string; change_type: string }>;
  }

  let {
    bundle = exampleGraphBundle,
    selectedRouteNodeId = null,
    diffOverlay = null,
    overlayMode = false
  }: {
    bundle?: GraphBundle;
    selectedRouteNodeId?: string | null;
    diffOverlay?: DiffOverlay | null;
    overlayMode?: boolean;
  } = $props();
  const backgroundVariant = BackgroundVariant.Dots;

  let flowNodes = $state.raw<FlowNode[]>([]);
  let flowEdges = $state.raw<FlowEdge[]>([]);
  let baseNodes = $state.raw<FlowNode[]>([]);
  let baseEdges = $state.raw<FlowEdge[]>([]);
  let selectedNodeId = $state<string | null>(null);
  let selectedNode = $state<GraphNodeRecord | null>(null);
  let layoutPass = 0;
  const layoutCache = new Map<string, { nodes: FlowNode[]; edges: FlowEdge[] }>();
  const preparedArtifacts = $derived(getPreparedBundleArtifacts(bundle));

  const progressionEdgeCount = $derived(
    bundle.edges.filter((edge) => {
      const edgeType = bundle.ontology.edge_types.find((item) => item.id === edge.type);
      return (edgeType?.role ?? 'reference') === 'progression';
    }).length
  );
  const riskNodeCount = $derived(
    bundle.nodes.filter((node) => (node.scores?.risk ?? 0) >= 0.55 || node.status === 'at_risk').length
  );
  const evidenceLinkedNodeCount = $derived(
    bundle.nodes.filter((node) => node.evidence_refs.length > 0).length
  );
  const changedNodeIds = $derived(
    new Set((diffOverlay?.node_changes ?? []).map((change) => change.node_id))
  );
  const selectedRoutePathNodeIds = $derived(
    selectedRouteNodeId
      ? getProgressionPathNodeIds(bundle, selectedRouteNodeId, preparedArtifacts.incomingProgression)
      : new Set<string>()
  );
  const laneGuides = $derived(preparedArtifacts.laneGuides);

  $effect(() => {
    const pass = ++layoutPass;
    const cacheKey = getBundleCacheKey(bundle);
    selectedNodeId = null;
    selectedNode = null;

    const cachedLayout = layoutCache.get(cacheKey);
    if (cachedLayout) {
      baseNodes = cloneFlowNodes(cachedLayout.nodes);
      baseEdges = cloneFlowEdges(cachedLayout.edges);
      applyDecoratedFlow();
      return;
    }

    const built = buildFlow(bundle);
    void layoutFlow(built.nodes, built.edges, bundle.map.goal_id).then((layoutResult) => {
      if (pass !== layoutPass) {
        return;
      }

      layoutCache.set(cacheKey, {
        nodes: cloneFlowNodes(layoutResult.nodes),
        edges: cloneFlowEdges(layoutResult.edges)
      });

      baseNodes = cloneFlowNodes(layoutResult.nodes);
      baseEdges = cloneFlowEdges(layoutResult.edges);
      applyDecoratedFlow();
    });
  });

  $effect(() => {
    if (baseNodes.length === 0) {
      return;
    }

    applyDecoratedFlow();
  });

  function syncEdgeState(hoveredEdgeId: string | null = null) {
    const activeNodeIds = getProgressionPathNodeIds(
      bundle,
      selectedNodeId,
      preparedArtifacts.incomingProgression
    );
    const nextEdges: FlowEdge[] = baseEdges.map((edge) => {
      const currentData = edge.data as MindMapEdgeData;

      return {
        ...edge,
        data: {
          ...currentData,
          hovered: edge.id === hoveredEdgeId,
          active: activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)
        }
      };
    });

    flowEdges = nextEdges;
  }

  function applyDecoratedFlow() {
    flowNodes = baseNodes.map((node) => ({
      ...node,
      position: { ...node.position },
      data: {
        ...node.data,
        selectedRoute: selectedRoutePathNodeIds.has(node.id),
        changedInPreview: changedNodeIds.has(node.id),
        overlayMode
      }
    }));
    syncEdgeState();
  }

  function handleNodeClick({ node }: { node: FlowNode; event: MouseEvent | TouchEvent }) {
    selectedNodeId = node.id;
    selectedNode = node.data.node;
    syncEdgeState();
  }

  function clearSelection() {
    selectedNodeId = null;
    selectedNode = null;
    syncEdgeState();
  }

  function handleEdgeHover(edgeId: string | null) {
    syncEdgeState(edgeId);
  }

  function selectNodeById(nodeId: string) {
    const node = bundle.nodes.find((item) => item.id === nodeId);
    if (!node) {
      return;
    }

    selectedNodeId = nodeId;
    selectedNode = node;
    syncEdgeState();
  }
</script>

<section class="map-panel">
  <div class:inspecting={Boolean(selectedNode)} class="flow-shell">
    <div class="lane-scaffold" aria-hidden="true">
      {#each laneGuides as lane, index (`${lane}-${index}`)}
        <div class="lane-guide">
          <span>{lane}</span>
        </div>
      {/each}
    </div>

    <div class="board-strip">
      <div class="board-strip-title">
        <p class="eyebrow">Pathway board</p>
        <h2>{bundle.map.title}</h2>
      </div>

      <div class="strip-metrics">
        <span>{bundle.nodes.length} nodes</span>
        <span>{progressionEdgeCount} routes</span>
        <span>{riskNodeCount} pressure points</span>
        {#if overlayMode}
          <span class="overlay-flag">Preview mode</span>
        {/if}
      </div>
    </div>

    <SvelteFlow
      {nodeTypes}
      {edgeTypes}
      nodes={flowNodes}
      edges={flowEdges}
      fitView
      fitViewOptions={{ padding: 0.015 }}
      minZoom={0.82}
      maxZoom={1.9}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      onnodeclick={handleNodeClick}
      onpaneclick={clearSelection}
      onedgepointerenter={({ edge }) => handleEdgeHover(edge.id)}
      onedgepointerleave={() => handleEdgeHover(null)}
    >
      <Background
        bgColor="transparent"
        patternColor="rgba(90, 89, 111, 0.06)"
        variant={backgroundVariant}
        gap={32}
        size={1}
      />
      <Panel position="top-left">
        <div class="legend">Select a node to inspect evidence, assumptions, and revision deltas.</div>
      </Panel>
    </SvelteFlow>

    <NodeDetailDrawer {bundle} node={selectedNode} onClose={clearSelection} />
  </div>

  {#if bundle.warnings.length > 0}
    <section class="warning-strip">
      {#each bundle.warnings as warning (warning)}
        <article>{warning}</article>
      {/each}
    </section>
  {/if}
</section>

<style>
  .map-panel {
    display: grid;
    gap: 0;
    min-height: 100%;
  }

  .eyebrow,
  h2,
  p {
    margin: 0;
  }

  .eyebrow {
    color: var(--pathway-accent-strong);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    font-size: clamp(1rem, 1.5vw, 1.18rem);
    line-height: 1.2;
    margin-top: 0.18rem;
  }

  .board-strip {
    position: absolute;
    top: 0.7rem;
    left: 0.7rem;
    right: 0.7rem;
    z-index: 7;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    pointer-events: none;
  }

  .lane-scaffold {
    position: absolute;
    inset: 0.7rem;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 0.7rem;
    pointer-events: none;
    z-index: 0;
  }

  .lane-guide {
    position: relative;
    border-left: 1px solid rgba(115, 109, 141, 0.08);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.02));
  }

  .lane-guide span {
    position: absolute;
    top: 4.8rem;
    left: 0.7rem;
    color: rgba(102, 98, 126, 0.5);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .board-strip-title {
    display: grid;
    gap: 0.08rem;
    border: 1px solid rgba(27, 31, 41, 0.08);
    background: rgba(248, 245, 240, 0.82);
    padding: 0.44rem 0.54rem;
    box-shadow: 0 8px 18px rgba(16, 18, 24, 0.08);
    backdrop-filter: blur(14px);
    pointer-events: auto;
  }

  .strip-metrics {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.42rem;
    pointer-events: auto;
  }

  .strip-metrics span,
  .legend {
    border: 1px solid var(--pathway-line);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.05);
    color: var(--pathway-paper-muted);
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.32rem 0.46rem;
    text-transform: uppercase;
  }

  .overlay-flag {
    color: #ffd3b0;
    background: rgba(198, 150, 98, 0.16);
  }

  .flow-shell {
    position: relative;
    height: calc(100vh - 152px);
    min-height: 720px;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background:
      radial-gradient(circle at top left, rgba(171, 172, 198, 0.08), transparent 26%),
      linear-gradient(var(--pathway-paper-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--pathway-paper-line) 1px, transparent 1px),
      linear-gradient(180deg, rgba(249, 247, 243, 0.98), rgba(237, 234, 229, 0.99));
    background-size: auto, 36px 36px, 36px 36px, auto;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.48),
      0 16px 34px rgba(9, 14, 20, 0.18);
    overflow: hidden;
  }

  .flow-shell.inspecting {
    padding-right: min(25vw, 360px);
  }

  .warning-strip {
    position: absolute;
    left: 0.8rem;
    right: 0.8rem;
    bottom: 0.8rem;
    z-index: 7;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    pointer-events: none;
  }

  .warning-strip article {
    border: 1px solid rgba(198, 150, 98, 0.28);
    background: rgba(255, 244, 226, 0.88);
    color: #765339;
    font-size: 0.68rem;
    padding: 0.34rem 0.5rem;
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }

  :global(.svelte-flow__attribution) {
    background: rgba(241, 237, 232, 0.94);
    border-radius: 0;
  }

  :global(.svelte-flow__background) {
    opacity: 0.32;
  }

  :global(.svelte-flow__panel) {
    margin: 5.2rem 0.9rem 0.9rem;
  }

  :global(.svelte-flow__edge-path) {
    filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.2));
  }

  @media (max-width: 900px) {
    .flow-shell.inspecting {
      padding-right: 0;
      padding-bottom: min(34vh, 280px);
    }

    .board-strip {
      display: grid;
      gap: 0.45rem;
      justify-content: start;
    }

    .strip-metrics {
      justify-content: flex-start;
    }

    .flow-shell {
      min-height: 640px;
    }

    :global(.svelte-flow__panel) {
      margin-top: 7.2rem;
    }
  }
</style>
