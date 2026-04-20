<script lang="ts">
  import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    Panel,
    SvelteFlow,
    type Edge,
    type Node
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  import { exampleGraphBundle } from '$lib/fixtures/exampleGraphBundle';
  import { buildFlow } from '$lib/graph/flow';
  import { layoutFlow } from '$lib/graph/layout';
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
  let selectedNodeId = $state<string | null>(null);
  let selectedNode = $state<GraphNodeRecord | null>(null);
  let layoutPass = 0;

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
    selectedRouteNodeId ? getProgressionPathNodeIds(bundle, selectedRouteNodeId) : new Set<string>()
  );

  $effect(() => {
    const pass = ++layoutPass;
    const built = buildFlow(bundle);

    selectedNodeId = null;
    selectedNode = null;
    flowEdges = built.edges;

    void layoutFlow(built.nodes, built.edges, bundle.map.goal_id).then((layoutResult) => {
      if (pass !== layoutPass) {
        return;
      }
      flowNodes = layoutResult.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          selectedRoute: selectedRoutePathNodeIds.has(node.id),
          changedInPreview: changedNodeIds.has(node.id),
          overlayMode
        }
      }));
      flowEdges = layoutResult.edges;
      syncEdgeState();
    });
  });

  function syncEdgeState(hoveredEdgeId: string | null = null) {
    const activeNodeIds = getProgressionPathNodeIds(bundle, selectedNodeId);
    const nextEdges: FlowEdge[] = flowEdges.map((edge) => {
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

<div class="workspace">
  <section class="map-panel">
    <header class="map-header">
      <div class="header-strip">
        <div class="header-copy">
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
    </header>

    <div class="flow-shell">
      <SvelteFlow
        {nodeTypes}
        {edgeTypes}
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.6}
        maxZoom={1.6}
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
          patternColor="rgba(23, 20, 17, 0.12)"
          variant={backgroundVariant}
          gap={18}
          size={1.1}
        />
        <MiniMap pannable zoomable />
        <Controls showLock={false} />
        <Panel position="top-left">
          <div class="legend">Select a node to inspect evidence, assumptions, and revision changes.</div>
        </Panel>
      </SvelteFlow>
    </div>

    {#if bundle.warnings.length > 0}
      <section class="warning-strip">
        {#each bundle.warnings as warning (warning)}
          <article>{warning}</article>
        {/each}
      </section>
    {/if}
  </section>

  <NodeDetailDrawer {bundle} node={selectedNode} onClose={clearSelection} />
</div>

<style>
  .workspace {
    display: grid;
    gap: 1.25rem;
  }

  .map-panel {
    display: grid;
    gap: 0.7rem;
  }

  .map-header {
    display: grid;
    gap: 0.65rem;
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

  .header-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
    border: 1px solid var(--pathway-line-strong);
    background: rgba(15, 20, 26, 0.72);
    padding: 0.72rem 0.82rem;
  }

  .header-copy {
    display: grid;
    gap: 0.08rem;
  }

  .strip-metrics {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.42rem;
  }

  .strip-metrics span,
  .legend {
    border: 1px solid var(--pathway-line);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.04);
    color: var(--pathway-muted);
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
    height: min(76vh, 880px);
    min-height: 520px;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background:
      linear-gradient(rgba(154, 166, 181, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(154, 166, 181, 0.08) 1px, transparent 1px),
      linear-gradient(180deg, rgba(236, 240, 245, 0.98), rgba(224, 231, 238, 0.98));
    background-size: 24px 24px, 24px 24px, auto;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.55),
      0 18px 42px rgba(9, 14, 20, 0.22);
    overflow: hidden;
  }

  .warning-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .warning-strip article {
    border: 1px solid rgba(198, 150, 98, 0.28);
    background: rgba(198, 150, 98, 0.12);
    color: #ffdcb8;
    font-size: 0.74rem;
    padding: 0.5rem 0.65rem;
  }

  :global(.svelte-flow__attribution) {
    background: rgba(236, 240, 245, 0.94);
    border-radius: 0;
  }

  :global(.svelte-flow__controls) {
    border-radius: 0;
    overflow: hidden;
    box-shadow: 0 12px 24px rgba(13, 18, 25, 0.18);
  }

  :global(.svelte-flow__background) {
    opacity: 0.35;
  }

  :global(.svelte-flow__minimap) {
    background: rgba(255, 255, 255, 0.82);
    border-radius: 0;
  }

  :global(.svelte-flow__panel) {
    margin: 0.7rem;
  }

  @media (min-width: 1180px) {
    .workspace {
      grid-template-columns: minmax(0, 1.8fr) minmax(320px, 0.82fr);
      align-items: start;
    }
  }

  @media (max-width: 900px) {
    .header-strip {
      flex-direction: column;
      align-items: start;
    }

    .strip-metrics {
      justify-content: flex-start;
    }
  }
</style>
