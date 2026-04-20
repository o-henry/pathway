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
    edgeData.role === 'reference' ? '#a89cb7' : edgeData.active ? '#7468be' : '#9187b1'
  );
  const strokeWidth = $derived(
    edgeData.active ? 2.5 : edgeData.role === 'reference' ? 1.35 : 1.9
  );
  const dash = $derived(edgeData.role === 'reference' ? '3 7' : undefined);
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
    border: 1px solid rgba(113, 104, 148, 0.14);
    border-radius: 999px;
    background: rgba(248, 244, 250, 0.94);
    box-shadow: 0 8px 18px rgba(35, 30, 24, 0.08);
    color: #655f84;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.24rem 0.54rem;
    white-space: nowrap;
  }
</style>
