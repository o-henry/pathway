<script lang="ts">
  import { getApiBaseUrl, readJson } from '$lib/api/client';
  import type { GeneratedMapResponse, GoalRecord, StateUpdateRecord } from '$lib/api/client';

  interface GoalWorkspaceRecord {
    goal: GoalRecord;
    maps: GeneratedMapResponse[];
    stateUpdates: StateUpdateRecord[];
  }

  let {
    activeMapId = null,
    refreshKey = 0,
    onSelectMap
  }: {
    activeMapId?: string | null;
    refreshKey?: number;
    onSelectMap?: (map: GeneratedMapResponse) => void;
  } = $props();

  const apiBaseUrl = getApiBaseUrl();

  let historyItems = $state<GoalWorkspaceRecord[]>([]);
  let errorMessage = $state('');
  let isLoading = $state(false);

  async function loadWorkspaceHistory() {
    isLoading = true;
    errorMessage = '';

    try {
      const goals = await readJson<GoalRecord[]>(await fetch(`${apiBaseUrl}/goals`));
      const items = await Promise.all(
        goals.map(async (goal) => {
          const [maps, stateUpdates] = await Promise.all([
            readJson<GeneratedMapResponse[]>(await fetch(`${apiBaseUrl}/goals/${goal.id}/maps`)),
            readJson<StateUpdateRecord[]>(await fetch(`${apiBaseUrl}/goals/${goal.id}/state-updates`))
          ]);

          return {
            goal,
            maps,
            stateUpdates
          } satisfies GoalWorkspaceRecord;
        })
      );

      historyItems = items;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Failed to load workspace history';
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    const currentRefreshKey = refreshKey;
    void currentRefreshKey;
    void loadWorkspaceHistory();
  });
</script>

<section class="history-panel">
  <div class="section-header">
    <div>
      <p class="eyebrow">Branch history</p>
      <h2>Keep prior branches visible</h2>
      <p class="copy">
        A single goal can split into many saved maps over time. Re-open older snapshots and compare
        them against recent state changes without losing the current board.
      </p>
    </div>
    <button type="button" class="refresh-button" onclick={loadWorkspaceHistory} disabled={isLoading}>
      {#if isLoading}Refreshing...{:else}Refresh timeline{/if}
    </button>
  </div>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if historyItems.length === 0 && !isLoading}
    <p class="empty">No goals are stored yet. Generate a pathway to start a branch history.</p>
  {/if}

  <div class="history-grid">
    {#each historyItems as item (item.goal.id)}
      <article class="goal-card">
        <div class="goal-header">
          <div>
            <h3>{item.goal.title}</h3>
            <p>{item.goal.success_criteria}</p>
          </div>
          <span class="goal-status">{item.goal.status}</span>
        </div>

        <div class="meta-row">
          <span>{item.maps.length} pathways</span>
          <span>{item.stateUpdates.length} state updates</span>
          <span>{item.goal.category}</span>
        </div>

        <section class="subsection">
          <h4>Snapshots</h4>
          {#if item.maps.length === 0}
            <p class="empty">No saved pathway snapshots.</p>
          {:else}
            <div class="snapshot-list">
              {#each item.maps as map (map.id)}
                <button
                  type="button"
                  class:selected={activeMapId === map.id}
                  onclick={() => onSelectMap?.(map)}
                >
                  <strong>{map.title}</strong>
                  <span>{new Date(map.created_at).toLocaleString()}</span>
                  <small>
                    {map.graph_bundle.nodes.length} nodes · {map.graph_bundle.edges.length} edges
                  </small>
                </button>
              {/each}
            </div>
          {/if}
        </section>

        <section class="subsection">
          <h4>Recent state updates</h4>
          {#if item.stateUpdates.length === 0}
            <p class="empty">No state updates recorded yet.</p>
          {:else}
            <ul>
              {#each item.stateUpdates.slice(0, 3) as update (update.id)}
                <li>
                  <strong>{update.update_date}</strong>
                  <p>{update.progress_summary}</p>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </article>
    {/each}
  </div>
</section>

<style>
  .history-panel {
    display: grid;
    gap: 1rem;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    padding: 1rem;
  }

  .section-header,
  .history-grid,
  .goal-card,
  .subsection,
  .snapshot-list {
    display: grid;
    gap: 0.8rem;
  }

  .section-header {
    align-items: start;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .history-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  .eyebrow,
  h2,
  h3,
  h4,
  p,
  ul {
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
    line-height: 1.15;
  }

  .copy,
  .goal-header p,
  .empty,
  li p {
    color: var(--pathway-muted);
    line-height: 1.6;
  }

  .refresh-button,
  .snapshot-list button {
    font: inherit;
  }

  .refresh-button {
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-chip-radius);
    background: var(--pathway-ink);
    color: white;
    cursor: pointer;
    font-weight: 800;
    padding: 0.74rem 0.92rem;
  }

  .refresh-button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .goal-card {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.42);
    padding: 0.95rem;
  }

  .goal-header {
    display: flex;
    align-items: start;
    gap: 1rem;
    justify-content: space-between;
  }

  .goal-status,
  .meta-row span {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-chip-radius);
    background: rgba(255, 255, 255, 0.52);
    color: var(--pathway-muted);
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.28rem 0.52rem;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .snapshot-list button {
    display: grid;
    gap: 0.2rem;
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.58);
    color: var(--pathway-ink);
    cursor: pointer;
    padding: 0.85rem 0.9rem;
    text-align: left;
  }

  .snapshot-list button.selected {
    border-color: rgba(23, 68, 77, 0.42);
    box-shadow: inset 0 0 0 1px rgba(23, 68, 77, 0.2);
    background: rgba(226, 238, 239, 0.72);
  }

  .snapshot-list button span,
  .snapshot-list button small {
    color: var(--pathway-muted);
  }

  ul {
    display: grid;
    gap: 0.6rem;
    list-style: none;
    padding: 0;
  }

  li {
    border-left: 3px solid var(--pathway-line-strong);
    background: rgba(255, 255, 255, 0.55);
    padding: 0.75rem 0.85rem;
  }

  .error {
    border-left: 3px solid var(--pathway-danger);
    background: rgba(245, 230, 224, 0.9);
    color: #733624;
    padding: 0.8rem 0.9rem;
  }

  @media (max-width: 860px) {
    .section-header {
      grid-template-columns: 1fr;
    }
  }
</style>
