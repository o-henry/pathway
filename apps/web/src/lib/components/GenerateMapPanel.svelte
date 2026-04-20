<script lang="ts">
  import {
    getApiBaseUrl,
    readJson,
    type GeneratedMapResponse,
    type GoalAnalysisRecord
  } from '$lib/api/client';

  let { onGenerated }: { onGenerated?: (map: GeneratedMapResponse) => void } = $props();

  const apiBaseUrl = getApiBaseUrl();

  let displayName = $state('User');
  let weeklyFreeHours = $state('6');
  let monthlyBudgetAmount = $state('300000');
  let monthlyBudgetCurrency = $state('USD');
  let energyPattern = $state('');
  let motivationPattern = $state('');
  let practiceEnvironment = $state('');
  let goalTitle = $state('');
  let goalDescription = $state('');
  let successCriteria = $state('');
  let showAdvanced = $state(false);
  let isSubmitting = $state(false);
  let errorMessage = $state('');
  let generatedMap = $state<GeneratedMapResponse | null>(null);
  let goalAnalysis = $state<GoalAnalysisRecord | null>(null);

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
            monthly_budget_currency: monthlyBudgetCurrency,
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

      const analysis = await readJson<GoalAnalysisRecord>(
        await fetch(`${apiBaseUrl}/goals/${goal.id}/analysis`, {
          method: 'POST'
        })
      );
      goalAnalysis = analysis;

      await readJson(
        await fetch(`${apiBaseUrl}/goals/${goal.id}/current-state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interview_answers: {
              time_budget: weeklyFreeHours,
              money_budget: `${monthlyBudgetAmount} ${monthlyBudgetCurrency}`,
              energy_pattern: energyPattern,
              motivation_pattern: motivationPattern,
              practice_environment: practiceEnvironment
            },
            resource_values: {
              time_budget: Number(weeklyFreeHours),
              money_budget: Number(monthlyBudgetAmount),
              energy_pattern: energyPattern,
              motivation_pattern: motivationPattern,
              practice_environment: practiceEnvironment
            },
            active_constraints: ['local-first', 'graph-first', 'pathways should revise when reality changes'],
            state_summary: `${goalTitle || 'This goal'} should be evaluated against limited time, a finite monthly budget, and an execution pattern that may shift week to week.`,
            derived_from_update_ids: []
          })
        })
      );

      const map = await readJson<GeneratedMapResponse>(
        await fetch(`${apiBaseUrl}/goals/${goal.id}/pathways/generate`, {
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
      <p class="eyebrow">Create pathway</p>
      <h2>Generate the first route map from a live goal</h2>
      <p class="copy">
        Start with the smallest useful context. Once the first map exists, the workflow shifts to
        updates, evidence, and revision.
      </p>
    </div>
    <button type="button" class="generate-button" onclick={handleGenerate} disabled={isSubmitting}>
      {#if isSubmitting}Generating...{:else}Generate initial pathway{/if}
    </button>
  </div>

  <div class="form-grid">
    <label>
      <span>Goal</span>
      <input bind:value={goalTitle} placeholder="Describe the outcome you want to reach" />
    </label>

    <label>
      <span>Success criteria</span>
      <textarea
        bind:value={successCriteria}
        rows="2"
        placeholder="What observable result would count as success?"
      ></textarea>
    </label>

    <div class="compact-grid">
      <label>
        <span>Weekly time budget</span>
        <input bind:value={weeklyFreeHours} inputmode="decimal" />
      </label>

      <label>
        <span>Monthly budget</span>
        <input bind:value={monthlyBudgetAmount} inputmode="numeric" />
      </label>

      <label>
        <span>Currency</span>
        <input bind:value={monthlyBudgetCurrency} maxlength="8" />
      </label>
    </div>

    <label>
      <span>Why now</span>
      <textarea
        bind:value={goalDescription}
        rows="3"
        placeholder="What makes this goal important right now?"
      ></textarea>
    </label>

    <button
      type="button"
      class="secondary-toggle"
      aria-expanded={showAdvanced}
      onclick={() => (showAdvanced = !showAdvanced)}
    >
      {#if showAdvanced}Hide advanced context{:else}Show advanced context{/if}
    </button>

    {#if showAdvanced}
      <div class="advanced-grid">
        <label>
          <span>User label</span>
          <input bind:value={displayName} />
        </label>

        <label>
          <span>Energy pattern</span>
          <textarea bind:value={energyPattern} rows="2"></textarea>
        </label>

        <label>
          <span>Motivation pattern</span>
          <textarea bind:value={motivationPattern} rows="2"></textarea>
        </label>

        <label>
          <span>Execution environment</span>
          <textarea bind:value={practiceEnvironment} rows="2"></textarea>
        </label>
      </div>
    {/if}
  </div>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if generatedMap}
    <div class="result">
      <div>
        <p class="eyebrow">Latest pathway</p>
        <h3>{generatedMap.title}</h3>
        <p class="result-copy">
          This snapshot is the current branch built from the inputs you provided just now.
        </p>
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

  {#if goalAnalysis}
    <div class="result">
      <div>
        <p class="eyebrow">Goal analysis</p>
        <h3>Resource lenses that matter first</h3>
        <p class="result-copy">{goalAnalysis.analysis_summary}</p>
      </div>
      <div class="stats">
        {#each goalAnalysis.resource_dimensions as dimension (dimension.id)}
          <span>{dimension.label}</span>
        {/each}
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

  .header,
  .form-grid,
  .compact-grid,
  .advanced-grid {
    display: grid;
    gap: 0.8rem;
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
    font-size: clamp(1.15rem, 1.35vw, 1.5rem);
    line-height: 1.18;
  }

  .copy {
    margin-top: 0.25rem;
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

  .secondary-toggle {
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-chip-radius);
    background: rgba(246, 249, 253, 0.95);
    color: var(--pathway-accent-strong);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    padding: 0.72rem 0.82rem;
    text-align: left;
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
    background: rgba(255, 255, 255, 0.9);
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
    background: rgba(255, 255, 255, 0.6);
    color: var(--pathway-muted);
    font-size: 0.76rem;
    font-weight: 700;
    padding: 0.32rem 0.5rem;
  }

  @media (min-width: 720px) {
    .header {
      grid-template-columns: minmax(0, 1fr);
    }

    .compact-grid,
    .advanced-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
