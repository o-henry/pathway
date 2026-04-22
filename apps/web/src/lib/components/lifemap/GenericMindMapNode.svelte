<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte';

  import { tonePalette } from '$lib/graph/style';
  import type { MindMapNodeData } from '$lib/graph/types';

  type MindMapFlowNode = Node<MindMapNodeData, 'mindmapNode'>;

  let { data, selected = false }: NodeProps<MindMapFlowNode> = $props();

  const colors = $derived(tonePalette[data.tone]);
  const riskFlag = $derived((data.riskLevel ?? 0) >= 0.65);
  const compactFields = $derived(data.fieldPreview.slice(0, 1));
  const isGoalNode = $derived(
    (data.nodeType?.id ?? data.node.type).toLowerCase().includes('goal')
  );
</script>

<div
  class:selected
  class:selected-route={Boolean(data.selectedRoute)}
  class:changed-in-preview={Boolean(data.changedInPreview)}
  class:goal-node={isGoalNode}
  class:pill={data.shape === 'pill'}
  class:rounded={data.shape === 'rounded_card'}
  class:circle={data.shape === 'circle'}
  class:risk={riskFlag}
  class="node-shell"
  style={`--node-bg:${colors.background}; --node-border:${colors.border}; --node-accent:${colors.accent}; --node-text:${colors.text}; --node-chip:${colors.chip};`}
>
  <Handle id="target-top" type="target" position={Position.Top} class="handle" />
  <Handle id="target-right" type="target" position={Position.Right} class="handle" />
  <Handle id="target-bottom" type="target" position={Position.Bottom} class="handle" />
  <Handle id="target-left" type="target" position={Position.Left} class="handle" />

  <Handle id="source-top" type="source" position={Position.Top} class="handle" />
  <Handle id="source-right" type="source" position={Position.Right} class="handle" />
  <Handle id="source-bottom" type="source" position={Position.Bottom} class="handle" />
  <Handle id="source-left" type="source" position={Position.Left} class="handle" />

  <div class="node-type-row">
    <span class="type-label">{data.typeLabel}</span>
    {#if riskFlag}
      <span class="risk-pill">Pressure</span>
    {/if}
    {#if data.changedInPreview}
      <span class="preview-pill">Changed</span>
    {/if}
  </div>

  <h3>{data.node.label}</h3>

  {#if data.shape === 'circle'}
    <p class="summary centered">{data.node.summary}</p>
  {:else}
    <p class="summary">{data.node.summary}</p>

    {#if compactFields.length > 0}
      <div class="signal-row">
        {#each compactFields as field (field.key)}
          <span class="signal-chip">
            <strong>{field.label}</strong>
            <small>{field.value}</small>
          </span>
        {/each}
      </div>
    {/if}

    <div class="chip-row">
      {#if data.node.status}
        <span class="chip">Status {data.node.status}</span>
      {/if}
      {#if data.evidenceCount > 0}
        <span class="chip">Evidence</span>
      {/if}
      {#if data.changedInPreview}
        <span class="chip">Updated</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .node-shell {
    width: 100%;
    border: 1px solid color-mix(in srgb, var(--node-border) 74%, #fff 26%);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--node-bg) 96%, #fff 4%),
        color-mix(in srgb, var(--node-bg) 90%, #fff 10%)
      );
    box-shadow: 0 8px 18px rgba(26, 22, 35, 0.08);
    color: var(--node-text);
    padding: 0.54rem 0.62rem 0.52rem;
    position: relative;
  }

  .rounded {
    min-width: 196px;
    max-width: 208px;
    border-radius: 9px;
  }

  .circle {
    display: grid;
    place-items: center;
    width: 190px;
    min-width: 190px;
    min-height: 190px;
    border-radius: 999px;
    padding: 1rem;
    text-align: center;
  }

  .selected {
    box-shadow: 0 0 0 2px rgba(86, 110, 170, 0.14), 0 14px 24px rgba(18, 24, 33, 0.12);
    transform: translateY(-2px);
  }

  .selected-route {
    box-shadow: 0 0 0 2px rgba(92, 90, 164, 0.18), 0 14px 24px rgba(18, 24, 33, 0.12);
  }

  .changed-in-preview {
    border-color: #2f6f53;
    box-shadow: 0 0 0 2px rgba(47, 111, 83, 0.14), 0 12px 24px rgba(18, 24, 33, 0.1);
  }

  .node-type-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.34rem;
  }

  .circle .node-type-row {
    justify-content: center;
  }

  .type-label,
  .risk-pill,
  .preview-pill,
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(23, 20, 17, 0.1);
    border-radius: 999px;
    background: var(--node-chip);
    color: var(--node-text);
  }

  .type-label,
  .risk-pill,
  .preview-pill,
  .chip {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.18rem 0.42rem;
    text-transform: uppercase;
  }

  .risk-pill {
    background: #efd4cf;
    color: #7a3f36;
  }

  .preview-pill {
    background: #d9e8dc;
    color: #2e6644;
  }

  h3,
  p,
  strong,
  small {
    margin: 0;
  }

  h3 {
    font-size: 0.84rem;
    line-height: 1.24;
    margin-bottom: 0.18rem;
  }

  .circle h3 {
    font-size: 1.04rem;
    line-height: 1.12;
    max-width: 9ch;
  }

  .summary {
    color: color-mix(in srgb, var(--node-text) 84%, #fff 16%);
    font-size: 0.69rem;
    line-height: 1.34;
    display: -webkit-box;
    overflow: hidden;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
  }

  .centered {
    max-width: 15ch;
    line-clamp: 4;
    -webkit-line-clamp: 4;
  }

  .signal-row,
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.38rem;
    margin-top: 0.38rem;
  }

  .signal-chip {
    display: grid;
    align-items: start;
    gap: 0.2rem;
    justify-content: flex-start;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0;
    text-align: left;
  }

  .signal-chip strong,
  .signal-chip small {
    display: block;
  }

  .signal-chip strong {
    font-size: 0.58rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    opacity: 0.7;
    text-transform: uppercase;
  }

  .signal-chip small {
    font-size: 0.68rem;
    line-height: 1.28;
  }

  .goal-node {
    border-color: rgba(108, 120, 175, 0.4);
    background:
      linear-gradient(180deg, rgba(109, 116, 176, 0.92), rgba(92, 98, 152, 0.96));
    color: #f9fbff;
    box-shadow: 0 14px 26px rgba(59, 59, 106, 0.22);
  }

  .goal-node .type-label,
  .goal-node .chip {
    background: rgba(255, 255, 255, 0.16);
    border-color: rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.88);
  }

  .goal-node .summary {
    color: rgba(245, 247, 255, 0.82);
  }

  .goal-node .signal-chip {
    background: transparent;
    border-color: transparent;
    color: rgba(255, 255, 255, 0.9);
  }

  .goal-node .signal-chip strong,
  .goal-node .signal-chip small {
    color: inherit;
  }

  :global(.handle) {
    opacity: 0;
    pointer-events: none;
  }
</style>
