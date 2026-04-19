<script lang="ts">
  import { Handle, Position, type Node, type NodeProps } from '@xyflow/svelte';

  import RoughAccent from './RoughAccent.svelte';
  import { tonePalette } from '$lib/graph/style';
  import type { MindMapNodeData } from '$lib/graph/types';

  type MindMapFlowNode = Node<MindMapNodeData, 'mindmapNode'>;

  let { data, selected = false }: NodeProps<MindMapFlowNode> = $props();

  const colors = $derived(tonePalette[data.tone]);
  const riskFlag = $derived((data.riskLevel ?? 0) >= 0.65);
</script>

<div
  class:selected
  class:pill={data.shape === 'pill'}
  class:rounded={data.shape !== 'pill'}
  class:risk={riskFlag}
  class="node-shell"
  style={`--node-bg:${colors.background}; --node-border:${colors.border}; --node-accent:${colors.accent}; --node-text:${colors.text}; --node-chip:${colors.chip};`}
>
  <Handle type="target" position={Position.Left} class="handle" />
  <Handle type="source" position={Position.Right} class="handle" />

  <div class="node-type-row">
    <span class="type-label">{data.typeLabel}</span>
    {#if riskFlag}
      <span class="risk-pill">Risk</span>
    {/if}
  </div>

  <h3>{data.node.label}</h3>
  <p class="summary">{data.node.summary}</p>

  {#if data.fieldPreview.length > 0}
    <dl class="preview-list">
      {#each data.fieldPreview as field (field.key)}
        <div>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}

  <div class="chip-row">
    {#if data.evidenceCount > 0}
      <span class="chip">Evidence {data.evidenceCount}</span>
    {/if}
    {#if data.assumptionCount > 0}
      <span class="chip">Assumptions {data.assumptionCount}</span>
    {/if}
  </div>

  <RoughAccent stroke={colors.accent} />
</div>

<style>
  .node-shell {
    width: 100%;
    min-width: 220px;
    max-width: 290px;
    border: 2px solid color-mix(in srgb, var(--node-border) 70%, #fff 30%);
    background: linear-gradient(180deg, color-mix(in srgb, var(--node-bg) 94%, #fff 6%), var(--node-bg));
    box-shadow: 0 18px 35px rgba(72, 57, 70, 0.12);
    color: var(--node-text);
    padding: 0.95rem 1rem 0.75rem;
    position: relative;
  }

  .rounded {
    border-radius: 28px;
  }

  .pill {
    border-radius: 999px;
    min-width: 220px;
    padding-block: 1rem;
  }

  .selected {
    box-shadow: 0 0 0 4px rgba(72, 57, 70, 0.08), 0 20px 42px rgba(72, 57, 70, 0.16);
    transform: translateY(-1px);
  }

  .risk::after {
    content: '!';
    position: absolute;
    top: -10px;
    right: -8px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: #ffddc8;
    color: #a34d20;
    font-weight: 800;
    box-shadow: 0 8px 18px rgba(163, 77, 32, 0.15);
  }

  .node-type-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.55rem;
  }

  .type-label,
  .risk-pill,
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--node-chip);
    color: var(--node-text);
    font-size: 0.73rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.28rem 0.65rem;
    text-transform: uppercase;
  }

  .risk-pill {
    background: #ffe0d9;
    color: #8a3455;
  }

  h3,
  p,
  dl,
  dt,
  dd {
    margin: 0;
  }

  h3 {
    font-size: 1.05rem;
    line-height: 1.2;
    margin-bottom: 0.4rem;
  }

  .summary {
    color: color-mix(in srgb, var(--node-text) 80%, #fff 20%);
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .preview-list {
    display: grid;
    gap: 0.45rem;
    margin-top: 0.8rem;
  }

  .preview-list div {
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.46);
    padding: 0.55rem 0.7rem;
  }

  dt {
    font-size: 0.72rem;
    font-weight: 700;
    opacity: 0.72;
    text-transform: uppercase;
    margin-bottom: 0.15rem;
  }

  dd {
    font-size: 0.86rem;
    line-height: 1.35;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.9rem;
  }

  :global(.handle) {
    opacity: 0;
    pointer-events: none;
  }
</style>
