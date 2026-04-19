<script lang="ts">
  import { formatFieldValue, formatScoreLabel, getAssumptionItems, getEvidenceItems } from '$lib/graph/format';
  import { normalizeTone, tonePalette } from '$lib/graph/style';
  import type { GraphBundle, GraphNodeRecord } from '$lib/graph/types';

  let {
    bundle,
    node,
    onClose
  }: {
    bundle: GraphBundle;
    node: GraphNodeRecord | null;
    onClose: () => void;
  } = $props();

  const nodeType = $derived(
    node ? bundle.ontology.node_types.find((definition) => definition.id === node.type) : undefined
  );
  const drawerTone = $derived(nodeType ? normalizeTone(nodeType.default_style?.tone) : 'slate');
  const colors = $derived(tonePalette[drawerTone]);
  const evidenceItems = $derived(node ? getEvidenceItems(bundle, node) : []);
  const assumptionItems = $derived(node ? getAssumptionItems(bundle, node) : []);
</script>

<aside class:open={Boolean(node)} class="drawer" aria-hidden={!node}>
  {#if node}
    <div class="drawer-header" style={`--drawer-accent:${colors.accent};`}>
      <div>
        <p class="eyebrow">{nodeType?.label ?? `Unknown · ${node.type}`}</p>
        <h2>{node.label}</h2>
      </div>
      <button type="button" class="close-button" onclick={onClose}>닫기</button>
    </div>

    <p class="summary">{node.summary}</p>

    {#if node.status}
      <section>
        <h3>Route status</h3>
        <p class="summary">{node.status}</p>
      </section>
    {/if}

    {#if nodeType?.fields?.length}
      <section>
        <h3>Dynamic fields</h3>
        <dl class="field-list">
          {#each nodeType.fields as field (field.key)}
            <div>
              <dt>{field.label}</dt>
              <dd>{formatFieldValue(field, node.data[field.key])}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/if}

    {#if node.scores && Object.keys(node.scores).length > 0}
      <section>
        <h3>Scores</h3>
        <ul class="score-list">
          {#each Object.entries(node.scores) as [key, value] (key)}
            <li>
              <span>{formatScoreLabel(key)}</span>
              <strong>{Math.round(value * 100)}%</strong>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section>
      <h3>Evidence</h3>
      {#if evidenceItems.length > 0}
        <ul class="stack-list">
          {#each evidenceItems as item (item.id)}
            <li>
              <strong>{item.title}</strong>
              <p>{item.quote_or_summary}</p>
              <small>{item.reliability}</small>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">연결된 근거가 아직 없습니다.</p>
      {/if}
    </section>

    <section>
      <h3>Assumptions</h3>
      {#if assumptionItems.length > 0}
        <ul class="stack-list">
          {#each assumptionItems as item (item.id)}
            <li>
              <strong>{item.text}</strong>
              <p>{item.risk_if_false}</p>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">이 노드에 연결된 가정이 없습니다.</p>
      {/if}
    </section>

    {#if node.revision_meta && Object.keys(node.revision_meta).length > 0}
      <section>
        <h3>Revision meta</h3>
        <dl class="field-list">
          {#each Object.entries(node.revision_meta) as [key, value] (key)}
            <div>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/if}
  {/if}
</aside>

<style>
  .drawer {
    position: sticky;
    top: 1.5rem;
    align-self: start;
    display: none;
    border-radius: 28px;
    background: rgba(255, 252, 248, 0.94);
    box-shadow: 0 18px 38px rgba(70, 52, 65, 0.12);
    padding: 1.25rem;
  }

  .open {
    display: grid;
    gap: 1rem;
  }

  .drawer-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 2px dashed rgba(94, 78, 92, 0.2);
    padding-bottom: 0.8rem;
  }

  .eyebrow {
    margin: 0 0 0.25rem;
    color: var(--drawer-accent);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2,
  h3,
  p,
  dl,
  dt,
  dd,
  ul {
    margin: 0;
  }

  h2 {
    font-size: 1.35rem;
    line-height: 1.2;
  }

  .close-button {
    border: 0;
    border-radius: 999px;
    background: #efe6dc;
    color: #5e4a54;
    cursor: pointer;
    font-weight: 700;
    padding: 0.45rem 0.75rem;
  }

  .summary,
  .empty,
  .stack-list p,
  dd {
    color: #564754;
    line-height: 1.55;
  }

  section {
    display: grid;
    gap: 0.75rem;
  }

  h3 {
    font-size: 0.96rem;
  }

  .field-list,
  .stack-list,
  .score-list {
    display: grid;
    gap: 0.65rem;
    list-style: none;
    padding: 0;
  }

  .field-list div,
  .stack-list li,
  .score-list li {
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.74);
    padding: 0.8rem 0.9rem;
  }

  dt {
    font-size: 0.76rem;
    font-weight: 700;
    margin-bottom: 0.15rem;
    opacity: 0.72;
    text-transform: uppercase;
  }

  .score-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .stack-list strong {
    display: block;
    margin-bottom: 0.2rem;
  }

  small {
    color: #8b7682;
    display: block;
    margin-top: 0.35rem;
  }
</style>
