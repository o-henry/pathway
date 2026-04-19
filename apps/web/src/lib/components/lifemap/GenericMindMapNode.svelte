<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte';

  import RoughAccent from './RoughAccent.svelte';
  import { tonePalette } from '$lib/graph/style';
  import type { MindMapNodeData } from '$lib/graph/types';

  type MindMapFlowNode = Node<MindMapNodeData, 'mindmapNode'>;

  let { data, selected = false }: NodeProps<MindMapFlowNode> = $props();

  const colors = $derived(tonePalette[data.tone]);
  const riskFlag = $derived((data.riskLevel ?? 0) >= 0.65);
  const compactFields = $derived(data.fieldPreview.slice(0, data.shape === 'circle' ? 1 : 2));
</script>

<div
  class:selected
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
      {#if data.evidenceCount > 0}
        <span class="chip">Evidence {data.evidenceCount}</span>
      {/if}
      {#if data.assumptionCount > 0}
        <span class="chip">Assumption {data.assumptionCount}</span>
      {/if}
      {#if data.node.status}
        <span class="chip">Status {data.node.status}</span>
      {/if}
    </div>
  {/if}

  <RoughAccent stroke={colors.accent} />
</div>

<style>
  .node-shell {
    width: 100%;
    border: 1px solid color-mix(in srgb, var(--node-border) 78%, #fff 22%);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--node-bg) 97%, #fff 3%), var(--node-bg)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 100%);
    box-shadow: 0 14px 32px rgba(35, 30, 24, 0.12);
    color: var(--node-text);
    padding: 0.82rem 0.86rem 0.72rem;
    position: relative;
  }

  .rounded {
    min-width: 230px;
    max-width: 240px;
    border-radius: 8px;
  }

  .pill {
    min-width: 190px;
    max-width: 200px;
    border-radius: 10px;
    padding-block: 0.76rem;
  }

  .circle {
    display: grid;
    place-items: center;
    width: 210px;
    min-width: 210px;
    min-height: 210px;
    border-radius: 999px;
    padding: 1.3rem;
    text-align: center;
  }

  .selected {
    box-shadow: 0 0 0 3px rgba(23, 68, 77, 0.12), 0 18px 34px rgba(35, 30, 24, 0.16);
    transform: translateY(-2px);
  }

  .risk::after {
    content: '!';
    position: absolute;
    top: -7px;
    right: -7px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1px solid rgba(163, 77, 32, 0.24);
    border-radius: 4px;
    background: #f0dac8;
    color: #8d4923;
    font-weight: 800;
    box-shadow: 0 8px 18px rgba(120, 78, 50, 0.12);
  }

  .node-type-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.55rem;
    margin-bottom: 0.48rem;
  }

  .circle .node-type-row {
    justify-content: center;
  }

  .type-label,
  .risk-pill,
  .chip,
  .signal-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(23, 20, 17, 0.08);
    border-radius: 5px;
    background: var(--node-chip);
    color: var(--node-text);
  }

  .type-label,
  .risk-pill,
  .chip {
    font-size: 0.67rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.22rem 0.44rem;
    text-transform: uppercase;
  }

  .risk-pill {
    background: #efd4cf;
    color: #7a3f36;
  }

  h3,
  p,
  strong,
  small {
    margin: 0;
  }

  h3 {
    font-size: 0.98rem;
    line-height: 1.18;
    margin-bottom: 0.32rem;
  }

  .circle h3 {
    font-size: 1.18rem;
    line-height: 1.12;
    max-width: 8ch;
  }

  .summary {
    color: color-mix(in srgb, var(--node-text) 84%, #fff 16%);
    font-size: 0.84rem;
    line-height: 1.42;
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
    margin-top: 0.72rem;
  }

  .signal-chip {
    align-items: start;
    gap: 0.2rem;
    justify-content: flex-start;
    padding: 0.3rem 0.42rem;
    text-align: left;
  }

  .signal-chip strong,
  .signal-chip small {
    display: block;
  }

  .signal-chip strong {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    opacity: 0.7;
    text-transform: uppercase;
  }

  .signal-chip small {
    font-size: 0.72rem;
    line-height: 1.28;
  }

  :global(.handle) {
    opacity: 0;
    pointer-events: none;
  }
</style>
