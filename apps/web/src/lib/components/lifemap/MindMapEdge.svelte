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
    edgeData.role === 'reference' ? '#9eabb6' : edgeData.active ? '#b76437' : '#7d6e82'
  );
  const strokeWidth = $derived(
    edgeData.active ? 3 : edgeData.role === 'reference' ? 1.6 : 2.2
  );
  const dash = $derived(
    edgeData.role === 'reference'
      ? '4 8'
      : edgeData.accent === 'sketch_arrow'
        ? '10 6'
        : undefined
  );
  const labelText = $derived(edgeData.edge.condition ?? edgeData.edge.label ?? '');
  const edgeStyle = $derived(
    `stroke:${stroke};stroke-width:${strokeWidth};opacity:${edgeData.hovered || edgeData.active ? 1 : 0.76};${dash ? `stroke-dasharray:${dash};` : ''}`
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
    border: 1px solid rgba(97, 78, 84, 0.18);
    border-radius: 999px;
    background: rgba(255, 252, 245, 0.95);
    box-shadow: 0 8px 18px rgba(92, 72, 84, 0.1);
    color: #4b3d45;
    font-size: 0.76rem;
    font-weight: 600;
    padding: 0.32rem 0.62rem;
    white-space: nowrap;
  }
</style>
