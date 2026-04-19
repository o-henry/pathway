<script lang="ts">
  import { getApiBaseUrl, readJson } from '$lib/api/client';
  import type {
    CheckInResponse,
    GeneratedMapResponse,
    RevisionProposalResponse
  } from '$lib/api/client';

  let {
    currentMap,
    onAccepted
  }: {
    currentMap: GeneratedMapResponse | null;
    onAccepted?: (map: GeneratedMapResponse) => void;
  } = $props();

  const apiBaseUrl = getApiBaseUrl();

  let progressSummary = $state('문자 복습은 유지되지만 평일 피로 때문에 문법 진입 속도가 크게 떨어지고 있다.');
  let blockers = $state('퇴근 후에는 길게 몰입하기 어려워 speaking이나 drill이 빠지기 쉽다.');
  let nextAdjustment = $state('평일은 10분짜리 micro loop로 줄이고, 주말에 speaking drill을 명시적으로 넣는다.');
  let actualTimeSpent = $state('3');
  let actualMoneySpent = $state('0');
  let mood = $state('mixed');
  let errorMessage = $state('');
  let successMessage = $state('');
  let isSubmitting = $state(false);
  let isAccepting = $state(false);
  let isRejecting = $state(false);
  let checkins = $state<CheckInResponse[]>([]);
  let proposal = $state<RevisionProposalResponse | null>(null);

  async function refreshCheckins(goalId: string) {
    checkins = await readJson<CheckInResponse[]>(await fetch(`${apiBaseUrl}/goals/${goalId}/checkins`));
  }

  $effect(() => {
    if (!currentMap) {
      checkins = [];
      proposal = null;
      successMessage = '';
      errorMessage = '';
      return;
    }

    void refreshCheckins(currentMap.goal_id).catch((error) => {
      errorMessage = error instanceof Error ? error.message : 'Failed to load check-ins';
    });
  });

  async function handleCreateCheckinAndProposal() {
    if (!currentMap) {
      return;
    }

    isSubmitting = true;
    errorMessage = '';
    successMessage = '';

    try {
      const createdCheckin = await readJson<CheckInResponse>(
        await fetch(`${apiBaseUrl}/goals/${currentMap.goal_id}/checkins`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            map_id: currentMap.id,
            actual_time_spent: Number(actualTimeSpent),
            actual_money_spent: Number(actualMoneySpent),
            mood,
            progress_summary: progressSummary,
            blockers,
            next_adjustment: nextAdjustment
          })
        })
      );
      await refreshCheckins(currentMap.goal_id);

      proposal = await readJson<RevisionProposalResponse>(
        await fetch(`${apiBaseUrl}/maps/${currentMap.id}/revision-proposals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkin_id: createdCheckin.id })
        })
      );
      successMessage = '현실 기록을 저장했고, 현재 조건에 맞춘 Pathway revision proposal을 만들었습니다.';
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Unknown check-in or revision failure';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleAccept() {
    if (!proposal) {
      return;
    }
    isAccepting = true;
    errorMessage = '';

    try {
      const acceptedMap = await readJson<GeneratedMapResponse>(
        await fetch(`${apiBaseUrl}/revision-proposals/${proposal.id}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'accepted from UI' })
        })
      );
      proposal = null;
      successMessage = 'Revision proposal을 수락했고 새 Pathway snapshot을 만들었습니다.';
      onAccepted?.(acceptedMap);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown accept failure';
    } finally {
      isAccepting = false;
    }
  }

  async function handleReject() {
    if (!proposal) {
      return;
    }
    isRejecting = true;
    errorMessage = '';

    try {
      proposal = await readJson<RevisionProposalResponse>(
        await fetch(`${apiBaseUrl}/revision-proposals/${proposal.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'rejected from UI' })
        })
      );
      successMessage = 'Revision proposal을 보류했습니다.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown reject failure';
    } finally {
      isRejecting = false;
    }
  }
</script>

<section class="revision-panel">
  <div class="section-header">
    <div>
      <p class="eyebrow">Reality revision loop</p>
      <h2>현재가 바뀌면 Pathway도 다시 그려져야 합니다</h2>
      <p class="copy">
        이 서비스의 핵심은 계획이 아니라 수정입니다. 실제 시간, 돈, 감정, 실패 패턴을 기록하면
        그래프는 그 현실을 반영해 다시 갈라져야 합니다.
      </p>
    </div>
  </div>

  {#if !currentMap}
    <p class="empty">먼저 Pathway를 생성하면 reality check-in과 revision loop가 활성화됩니다.</p>
  {:else}
    <div class="grid">
      <article class="card">
        <h3>Record what actually happened</h3>
        <p class="muted">Current snapshot: {currentMap.title}</p>
        <label>
          <span>What changed in reality</span>
          <textarea bind:value={progressSummary} rows="3"></textarea>
        </label>
        <label>
          <span>Pressure / blockers</span>
          <textarea bind:value={blockers} rows="2"></textarea>
        </label>
        <label>
          <span>What you want to try next</span>
          <textarea bind:value={nextAdjustment} rows="2"></textarea>
        </label>
        <div class="compact-grid">
          <label>
            <span>Hours spent</span>
            <input bind:value={actualTimeSpent} inputmode="decimal" />
          </label>
          <label>
            <span>Money spent</span>
            <input bind:value={actualMoneySpent} inputmode="decimal" />
          </label>
          <label>
            <span>Mood</span>
            <input bind:value={mood} />
          </label>
        </div>
        <button type="button" onclick={handleCreateCheckinAndProposal} disabled={isSubmitting}>
          {#if isSubmitting}Submitting...{:else}Generate revision proposal{/if}
        </button>
      </article>

      <article class="card">
        <h3>Recent reality checks</h3>
        {#if checkins.length === 0}
          <p class="empty">아직 기록된 reality check가 없습니다.</p>
        {:else}
          <ul class="stack-list">
            {#each checkins as checkin (checkin.id)}
              <li>
                <strong>{checkin.checkin_date}</strong>
                <p>{checkin.progress_summary}</p>
                {#if checkin.blockers}
                  <small>Blockers: {checkin.blockers}</small>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </article>
    </div>

    <article class="card proposal-card">
      <h3>What this revision would reshape</h3>
      {#if proposal}
        <p class="muted">{proposal.rationale}</p>

        {#if proposal.diff.summary.length > 0}
          <div class="pill-row">
            {#each proposal.diff.summary as item (item)}
              <span class="pill">{item}</span>
            {/each}
          </div>
        {/if}

        <div class="diff-grid">
          <section>
            <h4>Node changes</h4>
            {#if proposal.diff.node_changes.length === 0}
              <p class="empty">Node changes 없음</p>
            {:else}
              <ul class="stack-list">
                {#each proposal.diff.node_changes as change (`${change.change_type}-${change.node_id}`)}
                  <li>
                    <strong>{change.change_type} · {change.label}</strong>
                    <p>{change.reason}</p>
                    {#if change.previous_status || change.next_status}
                      <small>Status: {change.previous_status ?? 'none'} → {change.next_status ?? 'none'}</small>
                    {/if}
                    {#if change.fields_changed.length > 0}
                      <small>Fields: {change.fields_changed.join(', ')}</small>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </section>

          <section>
            <h4>Edges, warnings, and pressure</h4>
            <ul class="stack-list">
              {#each proposal.diff.edge_changes as change (`edge-${change.change_type}-${change.edge_id}`)}
                <li>
                  <strong>{change.change_type} · {change.edge_id}</strong>
                  <p>{change.source} → {change.target}</p>
                  <small>{change.reason}</small>
                </li>
              {/each}
              {#each proposal.diff.warning_changes as change (`warning-${change.change_type}-${change.warning}`)}
                <li>
                  <strong>{change.change_type} warning</strong>
                  <p>{change.warning}</p>
                </li>
              {/each}
              {#if proposal.diff.edge_changes.length === 0 && proposal.diff.warning_changes.length === 0}
                <li>
                  <p class="empty">Edge/warning changes 없음</p>
                </li>
              {/if}
            </ul>
          </section>
        </div>

        <div class="action-row">
          <button type="button" class="accept" onclick={handleAccept} disabled={isAccepting}>
            {#if isAccepting}Accepting...{:else}Accept new Pathway{/if}
          </button>
          <button type="button" class="reject" onclick={handleReject} disabled={isRejecting}>
            {#if isRejecting}Rejecting...{:else}Hold proposal{/if}
          </button>
        </div>
      {:else}
        <p class="empty">새 reality check를 저장하면 여기에서 Pathway diff를 검토할 수 있습니다.</p>
      {/if}
    </article>
  {/if}

  {#if successMessage}
    <p class="success">{successMessage}</p>
  {/if}

  {#if errorMessage}
    <p class="error">{errorMessage}</p>
  {/if}
</section>

<style>
  .revision-panel {
    display: grid;
    gap: 1rem;
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-panel-radius);
    background: var(--pathway-panel);
    box-shadow: var(--pathway-shadow);
    padding: 1rem;
  }

  .section-header,
  .card,
  .grid,
  .diff-grid,
  .stack-list {
    display: grid;
    gap: 0.8rem;
  }

  .eyebrow,
  h2,
  h3,
  h4,
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
    line-height: 1.15;
  }

  .copy,
  .muted,
  .empty {
    color: var(--pathway-muted);
    line-height: 1.6;
  }

  .card {
    border: 1px solid var(--pathway-line);
    border-radius: var(--pathway-card-radius);
    background: rgba(255, 255, 255, 0.42);
    padding: 0.95rem;
  }

  label {
    display: grid;
    gap: 0.4rem;
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

  button {
    border: 1px solid var(--pathway-line-strong);
    border-radius: var(--pathway-chip-radius);
    background: var(--pathway-ink);
    color: white;
    cursor: pointer;
    font-size: 0.93rem;
    font-weight: 800;
    padding: 0.76rem 0.92rem;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.7;
  }

  .compact-grid,
  .action-row,
  .pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .compact-grid label {
    min-width: 140px;
    flex: 1 1 140px;
  }

  .stack-list {
    list-style: none;
    padding: 0;
  }

  .stack-list li {
    border-left: 3px solid var(--pathway-line-strong);
    background: rgba(255, 255, 255, 0.55);
    padding: 0.8rem 0.9rem;
  }

  .stack-list small {
    color: var(--pathway-muted);
    display: block;
    margin-top: 0.3rem;
  }

  .pill {
    border: 1px solid rgba(138, 90, 53, 0.22);
    border-radius: var(--pathway-chip-radius);
    background: rgba(240, 226, 208, 0.92);
    color: #6d4c36;
    font-size: 0.74rem;
    font-weight: 800;
    padding: 0.32rem 0.62rem;
  }

  .accept {
    background: #274b38;
  }

  .reject {
    background: rgba(23, 20, 17, 0.78);
  }

  .success,
  .error {
    border-left: 3px solid;
    padding: 0.8rem 0.9rem;
  }

  .success {
    border-left-color: var(--pathway-success);
    background: rgba(232, 242, 233, 0.9);
    color: #254b31;
  }

  .error {
    border-left-color: var(--pathway-danger);
    background: rgba(245, 230, 224, 0.9);
    color: #733624;
  }

  @media (min-width: 980px) {
    .grid,
    .diff-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
