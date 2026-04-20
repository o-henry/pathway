<script lang="ts">
  import { BaseEdge, EdgeLabel, getBezierPath, type Edge, type EdgeProps } from '@xyflow/svelte';

  import type { MindMapEdgeData } from '$lib/graph/types';

  type MindMapFlowEdge = Edge<MindMapEdgeData>;

  let {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data
  }: EdgeProps<MindMapFlowEdge> = $props();

  let [edgePath, labelX, labelY] = $derived(
    getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY
    })
  );

  const edgeData = $derived(data as MindMapEdgeData);
  const stroke = $derived(
    edgeData.role === 'reference' ? '#7a8a92' : edgeData.active ? '#8a5a35' : '#5d6f74'
  );
  const strokeWidth = $derived(
    edgeData.active ? 2.8 : edgeData.role === 'reference' ? 1.5 : 2
  );
  const dash = $derived(edgeData.role === 'reference' ? '4 8' : undefined);
  const labelText = $derived(edgeData.edge.condition ?? edgeData.edge.label ?? '');
  const edgeStyle = $derived(
    `stroke:${stroke};stroke-width:${strokeWidth};opacity:${edgeData.hovered || edgeData.active ? 1 : 0.78};${dash ? `stroke-dasharray:${dash};` : ''}`
  );
</script>

<BaseEdge {id} path={edgePath} style={edgeStyle} />

{#if edgeData.hovered && labelText}
  <EdgeLabel x={labelX} y={labelY}>
    <div class="label nodrag nopan">{labelText}</div>
  </EdgeLabel>
{/if}

<style>
  .label {
    border: 1px solid rgba(23, 20, 17, 0.12);
    border-radius: 6px;
    background: rgba(248, 245, 238, 0.94);
    box-shadow: 0 8px 18px rgba(35, 30, 24, 0.1);
    color: #4b3d45;
    font-size: 0.74rem;
    font-weight: 600;
    padding: 0.28rem 0.56rem;
    white-space: nowrap;
  }
</style>
