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
      flowNodes = layoutResult.nodes;
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
      <div>
        <p class="eyebrow">Live pathway graph</p>
        <h2>{bundle.map.title}</h2>
        <p class="summary">{bundle.map.summary}</p>
      </div>

      <div class="pill-list">
        <span>{bundle.nodes.length} nodes</span>
        <span>{progressionEdgeCount} progression edges</span>
        <span>{riskNodeCount} pressure points</span>
        <span>{evidenceLinkedNodeCount} evidence-linked nodes</span>
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
          <div class="legend">
            Node를 클릭하면 dynamic fields, evidence, assumptions, revision meta가 오른쪽 dossier에 열립니다.
          </div>
        </Panel>
      </SvelteFlow>
    </div>

    <section class="node-browser" aria-labelledby="node-browser-title">
      <div class="node-browser-header">
        <h3 id="node-browser-title">Node index</h3>
        <p>그래프에서 눈에 띄는 갈래를 빠르게 다시 집는 용도의 keyboard-friendly index입니다.</p>
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
    gap: 1.25rem;
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
    color: var(--pathway-accent-strong);
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }

  h2 {
    font-size: clamp(1.45rem, 2.3vw, 2.2rem);
    line-height: 1.04;
  }

  .summary {
    color: var(--pathway-muted);
    margin-top: 0.35rem;
    max-width: 60ch;
    line-height: 1.55;
  }

  .pill-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }

  .pill-list span,
  .legend {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-chip-radius);
    background: rgba(248, 245, 238, 0.92);
    color: var(--pathway-muted);
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.38rem 0.62rem;
  }

  .flow-shell {
    height: min(78vh, 900px);
    min-height: 700px;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background:
      linear-gradient(var(--pathway-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--pathway-line) 1px, transparent 1px),
      linear-gradient(180deg, rgba(252, 249, 242, 0.92), rgba(244, 238, 227, 0.96));
    background-size:
      24px 24px,
      24px 24px,
      cover;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 18px 42px rgba(35, 30, 24, 0.08);
    overflow: hidden;
  }

  .warning-strip {
    display: grid;
    gap: 0.8rem;
  }

  .node-browser {
    display: grid;
    gap: 0.8rem;
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.42);
    padding: 0.95rem;
  }

  .node-browser-header {
    display: grid;
    gap: 0.3rem;
  }

  .node-browser-header h3 {
    font-size: 0.98rem;
  }

  .node-browser-header p {
    color: var(--pathway-muted);
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
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.58);
    color: var(--pathway-ink);
    cursor: pointer;
    font: inherit;
    padding: 0.9rem;
    text-align: left;
  }

  .node-button-grid button.selected {
    border-color: rgba(23, 68, 77, 0.42);
    box-shadow: inset 0 0 0 1px rgba(23, 68, 77, 0.2);
    background: rgba(226, 238, 239, 0.72);
  }

  .node-button-grid button strong {
    font-size: 0.95rem;
  }

  .node-button-grid button span {
    color: var(--pathway-muted);
    font-size: 0.76rem;
    text-transform: uppercase;
  }

  .warning-strip article {
    border-left: 3px solid var(--pathway-warm);
    background: rgba(245, 235, 223, 0.9);
    color: #624534;
    padding: 0.82rem 0.92rem;
  }

  :global(.svelte-flow__attribution) {
    background: rgba(248, 245, 238, 0.92);
    border-radius: var(--pathway-chip-radius);
  }

  :global(.svelte-flow__controls) {
    border-radius: var(--pathway-card-radius);
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(35, 30, 24, 0.1);
  }

  :global(.svelte-flow__background) {
    opacity: 0.6;
  }

  @media (min-width: 1180px) {
    .workspace {
      grid-template-columns: minmax(0, 1.8fr) minmax(320px, 0.82fr);
      align-items: start;
    }
  }
</style>
