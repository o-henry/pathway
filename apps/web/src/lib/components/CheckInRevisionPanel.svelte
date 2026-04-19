<script lang="ts">
  import type {
    CheckInResponse,
    GeneratedMapResponse,
    RevisionProposalResponse
  } from '$lib/api/types';

  let {
    currentMap,
    onAccepted
  }: {
    currentMap: GeneratedMapResponse | null;
    onAccepted?: (map: GeneratedMapResponse) => void;
  } = $props();

  const apiBaseUrl =
    (import.meta.env.PUBLIC_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';

  let progressSummary = $state('히라가나는 안정적이지만 문법 진입에서 흥미가 떨어지기 시작했다.');
  let blockers = $state('평일 저녁엔 피곤해서 길게 공부하기 어렵다.');
  let nextAdjustment = $state('주말 20분 speaking drill을 추가하고 평일엔 짧은 복습만 유지한다.');
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
      successMessage = 'Check-in을 저장했고 revision proposal을 생성했습니다.';
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
      successMessage = 'Revision proposal을 수락했고 새 map snapshot을 만들었습니다.';
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
      <p class="eyebrow">Phase 7</p>
      <h2>Check-ins + revisions</h2>
      <p class="copy">
        실제 진행 기록을 남기고, 현재 map과 비교한 revision proposal diff를 확인한 뒤 새 snapshot으로
        수락할 수 있습니다.
      </p>
    </div>
  </div>

  {#if !currentMap}
    <p class="empty">먼저 map을 생성하면 check-in과 revision flow를 이어서 사용할 수 있습니다.</p>
  {:else}
    <div class="grid">
      <article class="card">
        <h3>Create check-in</h3>
        <p class="muted">Current map: {currentMap.title}</p>
        <label>
          <span>Progress summary</span>
          <textarea bind:value={progressSummary} rows="3"></textarea>
        </label>
        <label>
          <span>Blockers</span>
          <textarea bind:value={blockers} rows="2"></textarea>
        </label>
        <label>
          <span>Next adjustment</span>
          <textarea bind:value={nextAdjustment} rows="2"></textarea>
        </label>
        <div class="compact-grid">
          <label>
            <span>Actual hours</span>
            <input bind:value={actualTimeSpent} inputmode="decimal" />
          </label>
          <label>
            <span>Actual spend</span>
            <input bind:value={actualMoneySpent} inputmode="decimal" />
          </label>
          <label>
            <span>Mood</span>
            <input bind:value={mood} />
          </label>
        </div>
        <button type="button" onclick={handleCreateCheckinAndProposal} disabled={isSubmitting}>
          {#if isSubmitting}Submitting...{:else}Save check-in + generate revision{/if}
        </button>
      </article>

      <article class="card">
        <h3>Recent check-ins</h3>
        {#if checkins.length === 0}
          <p class="empty">아직 check-in이 없습니다.</p>
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
      <h3>Revision proposal diff</h3>
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
            <h4>Edge + warning changes</h4>
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
            {#if isAccepting}Accepting...{:else}Accept revision{/if}
          </button>
          <button type="button" class="reject" onclick={handleReject} disabled={isRejecting}>
            {#if isRejecting}Rejecting...{:else}Reject revision{/if}
          </button>
        </div>
      {:else}
        <p class="empty">새 check-in을 저장하면 여기에서 proposal diff를 검토할 수 있습니다.</p>
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
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.72);
    box-shadow: 0 16px 34px rgba(84, 63, 77, 0.08);
    padding: 1.4rem;
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
  .muted,
  .empty {
    color: #584955;
    line-height: 1.6;
  }

  .card {
    border-radius: 22px;
    background: rgba(255, 252, 248, 0.9);
    padding: 1rem;
  }

  label {
    display: grid;
    gap: 0.4rem;
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

  button {
    border: 0;
    border-radius: 999px;
    background: #2f2330;
    color: white;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 800;
    padding: 0.8rem 1rem;
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

  .stack-list {
    list-style: none;
    padding: 0;
  }

  .stack-list li {
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.78);
    padding: 0.8rem 0.9rem;
  }

  .stack-list small {
    color: #7a6774;
    display: block;
    margin-top: 0.3rem;
  }

  .pill {
    border-radius: 999px;
    background: rgba(255, 240, 224, 0.95);
    color: #6d4c36;
    font-size: 0.76rem;
    font-weight: 800;
    padding: 0.35rem 0.7rem;
  }

  .accept {
    background: #2e5d45;
  }

  .reject {
    background: #7a575e;
  }

  .success,
  .error {
    border-left: 4px solid;
    border-radius: 18px;
    padding: 0.85rem 0.95rem;
  }

  .success {
    border-left-color: #4a8f6d;
    background: rgba(239, 255, 247, 0.92);
    color: #2f6e52;
  }

  .error {
    border-left-color: #d06b5d;
    background: rgba(255, 239, 236, 0.92);
    color: #7d352c;
  }

  @media (min-width: 980px) {
    .grid,
    .diff-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
