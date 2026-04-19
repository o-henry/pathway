<script lang="ts">
  import type { GraphBundle } from '$lib/graph/types';

  interface GeneratedMapResponse {
    id: string;
    title: string;
    goal_id: string;
    graph_bundle: GraphBundle;
    created_at: string;
    updated_at: string;
  }

  let { onGenerated }: { onGenerated?: (bundle: GraphBundle) => void } = $props();

  const apiBaseUrl =
    (import.meta.env.PUBLIC_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';

  let displayName = $state('Henry');
  let weeklyFreeHours = $state('5');
  let monthlyBudgetAmount = $state('100000');
  let goalTitle = $state('일본어 여행 회화');
  let goalDescription = $state('6개월 안에 여행 회화가 되도록 현실적인 루트를 찾고 싶다.');
  let successCriteria = $state('일본 여행에서 주문, 길 묻기, 간단한 대화가 가능하다.');
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let generatedMap = $state<GeneratedMapResponse | null>(null);

  async function readJson<T>(response: Response): Promise<T> {
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const detail =
        typeof payload?.detail === 'string' ? payload.detail : `Request failed (${response.status})`;
      throw new Error(detail);
    }

    return payload as T;
  }

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
              interface: 'mind_map_first',
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
      onGenerated?.(map.graph_bundle);
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
      <p class="eyebrow">Phase 6</p>
      <h2>Grounded graph generation</h2>
      <p class="copy">
        기본 프로필과 목표를 만든 뒤, 저장된 source library를 근거로 삼아 동적 ontology를 가진 새 Life Map을 생성합니다.
      </p>
    </div>
    <button type="button" class="generate-button" onclick={handleGenerate} disabled={isSubmitting}>
      {#if isSubmitting}생성 중...{:else}Generate map{/if}
    </button>
  </div>

  <div class="form-grid">
    <label>
      <span>Display name</span>
      <input bind:value={displayName} />
    </label>

    <label>
      <span>Weekly free hours</span>
      <input bind:value={weeklyFreeHours} inputmode="decimal" />
    </label>

    <label>
      <span>Monthly budget (KRW)</span>
      <input bind:value={monthlyBudgetAmount} inputmode="numeric" />
    </label>

    <label class="wide">
      <span>Goal title</span>
      <input bind:value={goalTitle} />
    </label>

    <label class="wide">
      <span>Goal description</span>
      <textarea bind:value={goalDescription} rows="3"></textarea>
    </label>

    <label class="wide">
      <span>Success criteria</span>
      <textarea bind:value={successCriteria} rows="2"></textarea>
    </label>
  </div>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if generatedMap}
    <div class="result">
      <div>
        <p class="eyebrow">Latest generated map</p>
        <h3>{generatedMap.title}</h3>
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
    gap: 1rem;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.74);
    box-shadow: 0 16px 34px rgba(84, 63, 77, 0.08);
    padding: 1.4rem;
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }

  .eyebrow,
  h2,
  h3,
  p,
  span {
    margin: 0;
  }

  .eyebrow {
    color: #8a5562;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin-top: 0.25rem;
    font-size: clamp(1.3rem, 1.6vw, 1.8rem);
  }

  .copy {
    margin-top: 0.45rem;
    color: #584955;
    max-width: 60ch;
    line-height: 1.6;
  }

  .generate-button {
    border: 0;
    border-radius: 999px;
    background: #2f2330;
    color: white;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 800;
    padding: 0.8rem 1.1rem;
  }

  .generate-button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .form-grid {
    display: grid;
    gap: 0.85rem;
  }

  label {
    display: grid;
    gap: 0.45rem;
  }

  label span {
    color: #5d4a56;
    font-size: 0.82rem;
    font-weight: 700;
  }

  input,
  textarea {
    border: 1px solid rgba(94, 78, 92, 0.14);
    border-radius: 16px;
    background: rgba(255, 251, 246, 0.94);
    color: #2f2330;
    font: inherit;
    padding: 0.8rem 0.9rem;
  }

  textarea {
    resize: vertical;
  }

  .error {
    border-left: 4px solid #d06b5d;
    border-radius: 18px;
    background: rgba(255, 239, 236, 0.92);
    color: #7d352c;
    padding: 0.85rem 0.95rem;
  }

  .result {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    border-top: 2px dashed rgba(94, 78, 92, 0.18);
    padding-top: 1rem;
  }

  h3 {
    margin-top: 0.25rem;
    font-size: 1.08rem;
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .stats span {
    border-radius: 999px;
    background: rgba(255, 246, 235, 0.95);
    color: #5b4651;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.45rem 0.75rem;
  }

  @media (min-width: 900px) {
    .form-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .wide {
      grid-column: 1 / -1;
    }
  }
</style>
