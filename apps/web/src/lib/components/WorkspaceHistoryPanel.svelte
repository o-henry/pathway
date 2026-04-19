<script lang="ts">
  import { getApiBaseUrl, readJson } from '$lib/api/client';
  import type { CheckInResponse, GeneratedMapResponse, GoalRecord } from '$lib/api/client';

  interface GoalWorkspaceRecord {
    goal: GoalRecord;
    maps: GeneratedMapResponse[];
    checkins: CheckInResponse[];
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
          const [maps, checkins] = await Promise.all([
            readJson<GeneratedMapResponse[]>(await fetch(`${apiBaseUrl}/goals/${goal.id}/maps`)),
            readJson<CheckInResponse[]>(await fetch(`${apiBaseUrl}/goals/${goal.id}/checkins`))
          ]);

          return {
            goal,
            maps,
            checkins
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
      <p class="eyebrow">Workspace history</p>
      <h2>Goal, snapshot, check-in 흐름을 잃지 않고 이어갑니다</h2>
      <p class="copy">
        각 goal 아래의 map snapshots와 최근 check-ins를 한 번에 보고, 원하는 snapshot을 다시 현재
        작업 맵으로 불러올 수 있습니다.
      </p>
    </div>
    <button type="button" class="refresh-button" onclick={loadWorkspaceHistory} disabled={isLoading}>
      {#if isLoading}Refreshing...{:else}Refresh history{/if}
    </button>
  </div>

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}

  {#if historyItems.length === 0 && !isLoading}
    <p class="empty">아직 기록된 goal이 없습니다. 먼저 목표를 만들거나 map을 생성해보세요.</p>
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
          <span>{item.maps.length} maps</span>
          <span>{item.checkins.length} check-ins</span>
          <span>{item.goal.category}</span>
        </div>

        <section class="subsection">
          <h4>Snapshots</h4>
          {#if item.maps.length === 0}
            <p class="empty">저장된 map snapshot이 없습니다.</p>
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
          <h4>Recent check-ins</h4>
          {#if item.checkins.length === 0}
            <p class="empty">아직 check-in이 없습니다.</p>
          {:else}
            <ul>
              {#each item.checkins.slice(0, 3) as checkin (checkin.id)}
                <li>
                  <strong>{checkin.checkin_date}</strong>
                  <p>{checkin.progress_summary}</p>
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
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 16px 34px rgba(84, 63, 77, 0.08);
    padding: 1.4rem;
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

  .copy,
  .goal-header p,
  .empty,
  li p {
    color: #584955;
    line-height: 1.6;
  }

  .refresh-button,
  .snapshot-list button {
    font: inherit;
  }

  .refresh-button {
    border: 0;
    border-radius: 999px;
    background: #2f2330;
    color: white;
    cursor: pointer;
    font-weight: 800;
    padding: 0.75rem 1rem;
  }

  .refresh-button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .goal-card {
    border-radius: 22px;
    background: rgba(255, 251, 246, 0.92);
    padding: 1rem;
  }

  .goal-header {
    display: flex;
    align-items: start;
    gap: 1rem;
    justify-content: space-between;
  }

  .goal-status,
  .meta-row span {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    color: #5b4651;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 0.35rem 0.65rem;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .snapshot-list button {
    display: grid;
    gap: 0.2rem;
    border: 1px solid rgba(94, 78, 92, 0.14);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.86);
    color: #2f2330;
    cursor: pointer;
    padding: 0.85rem 0.9rem;
    text-align: left;
  }

  .snapshot-list button.selected {
    border-color: rgba(110, 77, 91, 0.5);
    box-shadow: 0 0 0 3px rgba(110, 77, 91, 0.1);
  }

  .snapshot-list button span,
  .snapshot-list button small {
    color: #6e5966;
  }

  ul {
    display: grid;
    gap: 0.6rem;
    list-style: none;
    padding: 0;
  }

  li {
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.82);
    padding: 0.75rem 0.85rem;
  }

  .error {
    border-radius: 18px;
    background: rgba(255, 239, 236, 0.92);
    color: #7d352c;
    padding: 0.85rem 0.95rem;
  }

  @media (max-width: 860px) {
    .section-header {
      grid-template-columns: 1fr;
    }
  }
</style>
