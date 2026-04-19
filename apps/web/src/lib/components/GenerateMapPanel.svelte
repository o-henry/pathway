<script lang="ts">
  import { getApiBaseUrl, readJson, type GeneratedMapResponse } from '$lib/api/client';

  let { onGenerated }: { onGenerated?: (map: GeneratedMapResponse) => void } = $props();

  const apiBaseUrl = getApiBaseUrl();

  let displayName = $state('Henry');
  let weeklyFreeHours = $state('5');
  let monthlyBudgetAmount = $state('100000');
  let goalTitle = $state('일본어 여행 회화');
  let goalDescription = $state('6개월 안에 여행 회화가 되도록 현실적인 루트를 찾고 싶다.');
  let successCriteria = $state('일본 여행에서 주문, 길 묻기, 간단한 대화가 가능하다.');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let generatedMap = $state<GeneratedMapResponse | null>(null);

  async function handleGenerate() {
    isSubmitting = true;
    errorMessage = '';
    generatedMap = null;

    try {
      await readJson(
        await fetch(`${apiBaseUrl}/profiles/default`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: displayName,
            weekly_free_hours: Number(weeklyFreeHours),
            monthly_budget_amount: Number(monthlyBudgetAmount),
            monthly_budget_currency: 'KRW',
            energy_level: 'medium',
            preference_tags: ['solo', 'reflective'],
            constraints: {
              interface: 'graph_first',
              privacy: 'local_first'
            }
          })
        })
      );

      const goal = await readJson<{ id: string }>(
        await fetch(`${apiBaseUrl}/goals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile_id: 'default',
            title: goalTitle,
            description: goalDescription,
            category: 'general',
            success_criteria: successCriteria,
            status: 'active'
          })
        })
      );

      const map = await readJson<GeneratedMapResponse>(
        await fetch(`${apiBaseUrl}/goals/${goal.id}/maps/generate`, {
          method: 'POST'
        })
      );

      generatedMap = map;
      onGenerated?.(map);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown generation failure';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<section class="generate-panel">
  <div class="header">
    <div>
      <p class="eyebrow">Goal intake</p>
      <h2>먼저 목표를 말하면, Pathway가 지금 중요한 제약부터 붙잡습니다</h2>
      <p class="copy">
        현재 빌드는 아직 좁은 초기 intake만 묻지만, 구조의 방향은 분명합니다. 목표를 먼저 받고,
        그 목표에 실제로 영향을 주는 resource lens만 후속 질문으로 파고든 뒤 초기 Pathway를
        생성해야 합니다.
      </p>
    </div>
    <button type="button" class="generate-button" onclick={handleGenerate} disabled={isSubmitting}>
      {#if isSubmitting}Generating...{:else}Generate initial pathway{/if}
    </button>
  </div>

  <div class="form-grid">
    <label>
      <span>Operator</span>
      <input bind:value={displayName} />
    </label>

    <label>
      <span>Weekly time budget</span>
      <input bind:value={weeklyFreeHours} inputmode="decimal" />
    </label>

    <label>
      <span>Monthly money budget (KRW)</span>
      <input bind:value={monthlyBudgetAmount} inputmode="numeric" />
    </label>

    <label class="wide">
      <span>Goal statement</span>
      <input bind:value={goalTitle} />
    </label>

    <label class="wide">
      <span>Why now</span>
      <textarea bind:value={goalDescription} rows="3"></textarea>
    </label>

    <label class="wide">
      <span>Observable success criteria</span>
      <textarea bind:value={successCriteria} rows="2"></textarea>
    </label>
  </div>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if generatedMap}
    <div class="result">
      <div>
        <p class="eyebrow">Latest pathway</p>
        <h3>{generatedMap.title}</h3>
        <p class="result-copy">이 snapshot은 지금 입력한 조건을 기준으로 잠정 생성된 첫 번째 분기 지도입니다.</p>
      </div>
      <div class="stats">
        <span>{generatedMap.graph_bundle.nodes.length} nodes</span>
        <span>{generatedMap.graph_bundle.edges.length} edges</span>
        <span>{generatedMap.graph_bundle.ontology.node_types.length} node types</span>
        <span>{generatedMap.graph_bundle.evidence.length} evidence refs</span>
        <span>{generatedMap.graph_bundle.assumptions.length} assumptions</span>
      </div>
    </div>
  {/if}
</section>

<style>
  .generate-panel {
    display: grid;
    gap: 0.9rem;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    padding: 1rem;
  }

  .header {
    display: grid;
    gap: 0.85rem;
  }

  .eyebrow,
  h2,
  h3,
  p,
  span {
    margin: 0;
  }

  .eyebrow {
    color: var(--pathway-accent-strong);
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin-top: 0.2rem;
    font-size: clamp(1.2rem, 1.45vw, 1.7rem);
  }

  .copy {
    margin-top: 0.35rem;
    color: var(--pathway-muted);
    line-height: 1.6;
  }

  .generate-button {
    width: 100%;
    border: 1px solid var(--pathway-accent-strong);
    border-radius: var(--pathway-chip-radius);
    background: var(--pathway-accent-strong);
    color: white;
    cursor: pointer;
    font-size: 0.94rem;
    font-weight: 800;
    padding: 0.82rem 1rem;
  }

  .generate-button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .form-grid {
    display: grid;
    gap: 0.8rem;
  }

  label {
    display: grid;
    gap: 0.35rem;
  }

  label span {
    color: var(--pathway-muted);
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  input,
  textarea {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.62);
    color: var(--pathway-ink);
    font: inherit;
    padding: 0.78rem 0.82rem;
  }

  textarea {
    resize: vertical;
  }

  .error {
    border-left: 3px solid var(--pathway-danger);
    background: rgba(246, 233, 228, 0.92);
    color: #7f3f30;
    padding: 0.8rem 0.85rem;
  }

  .result {
    display: grid;
    gap: 0.8rem;
    border-top: 1px solid var(--pathway-line);
    padding-top: 0.9rem;
  }

  h3 {
    margin-top: 0.2rem;
    font-size: 1.03rem;
  }

  .result-copy {
    margin-top: 0.3rem;
    color: var(--pathway-muted);
    line-height: 1.55;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .stats span {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-chip-radius);
    background: rgba(255, 255, 255, 0.5);
    color: var(--pathway-muted);
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.32rem 0.5rem;
  }

  @media (min-width: 900px) {
    .header {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
