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

  let { bundle = exampleGraphBundle }: { bundle?: GraphBundle } = $props();
  const backgroundVariant = BackgroundVariant.Dots;

  let flowNodes = $state.raw<FlowNode[]>([]);
  let flowEdges = $state.raw<FlowEdge[]>([]);
  let selectedNodeId = $state<string | null>(null);
  let selectedNode = $state<GraphNodeRecord | null>(null);
  let layoutPass = 0;

  $effect(() => {
    const pass = ++layoutPass;
    const built = buildFlow(bundle);

    selectedNodeId = null;
    selectedNode = null;
    flowEdges = built.edges;

    void layoutFlow(built.nodes, built.edges).then((laidOutNodes) => {
      if (pass !== layoutPass) {
        return;
      }
      flowNodes = laidOutNodes;
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
      <div>
        <p class="eyebrow">Static example map</p>
        <h2>{bundle.map.title}</h2>
        <p class="summary">{bundle.map.summary}</p>
      </div>

      <div class="pill-list">
        <span>{bundle.nodes.length} nodes</span>
        <span>{bundle.edges.length} edges</span>
        <span>{bundle.warnings.length} warnings</span>
      </div>
    </header>

    <div class="flow-shell">
      <SvelteFlow
        {nodeTypes}
        {edgeTypes}
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        minZoom={0.45}
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
          patternColor="#eadfce"
          variant={backgroundVariant}
          gap={18}
          size={1.2}
        />
        <MiniMap pannable zoomable />
        <Controls showLock={false} />
        <Panel position="top-left">
          <div class="legend">
            <span>Click a node to inspect its dynamic fields, evidence, and assumptions.</span>
          </div>
        </Panel>
      </SvelteFlow>
    </div>

    <section class="node-browser" aria-labelledby="node-browser-title">
      <div class="node-browser-header">
        <h3 id="node-browser-title">Keyboard node browser</h3>
        <p>그래프를 마우스로 탐색하지 않아도, 탭 이동으로 노드를 선택하고 상세 패널을 열 수 있습니다.</p>
      </div>

      <div class="node-button-grid">
        {#each bundle.nodes as node (node.id)}
          <button
            type="button"
            class:selected={selectedNodeId === node.id}
            onclick={() => selectNodeById(node.id)}
          >
            <strong>{node.label}</strong>
            <span>{node.type}</span>
          </button>
        {/each}
      </div>
    </section>

    <section class="warning-strip">
      {#each bundle.warnings as warning (warning)}
        <article>{warning}</article>
      {/each}
    </section>
  </section>

  <NodeDetailDrawer {bundle} node={selectedNode} onClose={clearSelection} />
</div>

<style>
  .workspace {
    display: grid;
    gap: 1.5rem;
  }

  .map-panel {
    display: grid;
    gap: 1rem;
  }

  .map-header {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }

  .eyebrow,
  h2,
  p {
    margin: 0;
  }

  .eyebrow {
    color: #8a5562;
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
  }

  h2 {
    font-size: clamp(1.55rem, 2.6vw, 2.4rem);
    line-height: 1.08;
  }

  .summary {
    color: #584955;
    margin-top: 0.4rem;
    max-width: 60ch;
  }

  .pill-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  .pill-list span,
  .legend {
    border: 1px solid rgba(94, 78, 92, 0.14);
    border-radius: 999px;
    background: rgba(255, 251, 245, 0.95);
    color: #4e404a;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.45rem 0.8rem;
  }

  .flow-shell {
    height: 70vh;
    min-height: 560px;
    border: 2px dashed rgba(102, 82, 92, 0.18);
    border-radius: 32px;
    background:
      radial-gradient(circle at top left, rgba(255, 241, 229, 0.8), transparent 20%),
      linear-gradient(180deg, rgba(255, 254, 250, 0.92), rgba(255, 250, 244, 0.9));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7), 0 16px 42px rgba(73, 55, 67, 0.08);
    overflow: hidden;
  }

  .warning-strip {
    display: grid;
    gap: 0.8rem;
  }

  .node-browser {
    display: grid;
    gap: 0.8rem;
    border-radius: 24px;
    background: rgba(255, 251, 245, 0.88);
    padding: 1rem;
  }

  .node-browser-header {
    display: grid;
    gap: 0.3rem;
  }

  .node-browser-header h3 {
    font-size: 1rem;
  }

  .node-browser-header p {
    color: #5a4a55;
    line-height: 1.5;
  }

  .node-button-grid {
    display: grid;
    gap: 0.7rem;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .node-button-grid button {
    display: grid;
    gap: 0.25rem;
    align-content: start;
    border: 1px solid rgba(94, 78, 92, 0.14);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.86);
    color: #2f2330;
    cursor: pointer;
    font: inherit;
    padding: 0.9rem;
    text-align: left;
  }

  .node-button-grid button.selected {
    border-color: rgba(110, 77, 91, 0.5);
    box-shadow: 0 0 0 3px rgba(110, 77, 91, 0.1);
  }

  .node-button-grid button strong {
    font-size: 0.95rem;
  }

  .node-button-grid button span {
    color: #6f5b67;
    font-size: 0.78rem;
    text-transform: uppercase;
  }

  .warning-strip article {
    border-left: 4px solid #d88a63;
    border-radius: 18px;
    background: rgba(255, 247, 238, 0.88);
    color: #624534;
    padding: 0.9rem 1rem;
  }

  :global(.svelte-flow__attribution) {
    background: rgba(255, 251, 245, 0.88);
    border-radius: 999px;
  }

  :global(.svelte-flow__controls) {
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(72, 57, 70, 0.1);
  }

  :global(.svelte-flow__background) {
    opacity: 0.55;
  }

  @media (min-width: 1180px) {
    .workspace {
      grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
      align-items: start;
    }
  }
</style>
