<script lang="ts">
  import { getApiBaseUrl, readJson } from '$lib/api/client';
  import type {
    RouteSelectionRecord,
    GeneratedMapResponse,
    RevisionPreviewResponse,
    StateUpdateRecord
  } from '$lib/api/client';

  let {
    currentMap,
    onAccepted,
    onPreview,
    onRouteSelection
  }: {
    currentMap: GeneratedMapResponse | null;
    onAccepted?: (map: GeneratedMapResponse) => void;
    onPreview?: (preview: RevisionPreviewResponse | null) => void;
    onRouteSelection?: (selection: RouteSelectionRecord | null) => void;
  } = $props();

  const apiBaseUrl = getApiBaseUrl();

  let progressSummary = $state('Execution is still moving, but the available focus window is shorter than expected and the work is drifting toward maintenance.');
  let blockers = $state('Long work blocks are hard to sustain, and weak external feedback is making prioritization less stable.');
  let nextAdjustment = $state('Reduce the weekday loop, then protect one focused review block for evidence and route correction.');
  let actualTimeSpent = $state('3');
  let actualMoneySpent = $state('0');
  let mood = $state('mixed');
  let errorMessage = $state('');
  let successMessage = $state('');
  let isSubmitting = $state(false);
  let isAccepting = $state(false);
  let isRejecting = $state(false);
  let stateUpdates = $state<StateUpdateRecord[]>([]);
  let preview = $state<RevisionPreviewResponse | null>(null);
  let routeSelection = $state<RouteSelectionRecord | null>(null);
  let selectedRouteNodeId = $state('');
  let routeRationale = $state('This is the route that still looks realistic under the current constraints.');

  async function refreshState(goalId: string, pathwayId: string) {
    const [updates, selection] = await Promise.all([
      readJson<StateUpdateRecord[]>(await fetch(`${apiBaseUrl}/goals/${goalId}/state-updates`)),
      readJson<RouteSelectionRecord | null>(
        await fetch(`${apiBaseUrl}/pathways/${pathwayId}/route-selection`)
      )
    ]);
    stateUpdates = updates;
    routeSelection = selection;
    onRouteSelection?.(selection);
    selectedRouteNodeId =
      selection?.selected_node_id ?? currentMap?.graph_bundle.nodes[0]?.id ?? '';
  }

  $effect(() => {
    if (!currentMap) {
      stateUpdates = [];
      preview = null;
      routeSelection = null;
      successMessage = '';
      errorMessage = '';
      onPreview?.(null);
      return;
    }

    void refreshState(currentMap.goal_id, currentMap.id).catch((error) => {
      errorMessage = error instanceof Error ? error.message : 'Failed to load state updates';
    });
  });

  async function persistRouteSelection() {
    if (!currentMap || !selectedRouteNodeId) {
      return;
    }

    routeSelection = await readJson<RouteSelectionRecord>(
      await fetch(`${apiBaseUrl}/pathways/${currentMap.id}/route-selection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_node_id: selectedRouteNodeId,
          rationale: routeRationale
        })
      })
    );
    onRouteSelection?.(routeSelection);
  }

  async function handleCreateCheckinAndProposal() {
    if (!currentMap) {
      return;
    }

    isSubmitting = true;
    errorMessage = '';
    successMessage = '';

    try {
      await persistRouteSelection();

      const createdUpdate = await readJson<StateUpdateRecord>(
        await fetch(`${apiBaseUrl}/goals/${currentMap.goal_id}/state-updates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pathway_id: currentMap.id,
            actual_time_spent: Number(actualTimeSpent),
            actual_money_spent: Number(actualMoneySpent),
            mood,
            progress_summary: progressSummary,
            blockers,
            next_adjustment: nextAdjustment,
            resource_deltas: {
              energy_pattern: mood,
              recent_time_spent_hours: Number(actualTimeSpent)
            },
            learned_items: [progressSummary],
            source_refs: []
          })
        })
      );
      await refreshState(currentMap.goal_id, currentMap.id);

      preview = await readJson<RevisionPreviewResponse>(
        await fetch(`${apiBaseUrl}/pathways/${currentMap.id}/revision-previews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkin_id: createdUpdate.id })
        })
      );
      onPreview?.(preview);
      successMessage = 'Saved the update and generated a revision preview for the current conditions.';
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : 'Unknown state update or revision failure';
    } finally {
      isSubmitting = false;
    }
  }

  async function handleAccept() {
    if (!preview) {
      return;
    }
    isAccepting = true;
    errorMessage = '';

    try {
      const acceptedMap = await readJson<GeneratedMapResponse>(
        await fetch(`${apiBaseUrl}/revision-previews/${preview.id}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'accepted from UI' })
        })
      );
      preview = null;
      onPreview?.(null);
      successMessage = 'Accepted the revision preview and created a new pathway snapshot.';
      onAccepted?.(acceptedMap);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown accept failure';
    } finally {
      isAccepting = false;
    }
  }

  async function handleReject() {
    if (!preview) {
      return;
    }
    isRejecting = true;
    errorMessage = '';

    try {
      preview = await readJson<RevisionPreviewResponse>(
        await fetch(`${apiBaseUrl}/revision-previews/${preview.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'rejected from UI' })
        })
      );
      onPreview?.(null);
      successMessage = 'Held the revision preview without replacing the current snapshot.';
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
      <h2>When reality changes, the graph should change too</h2>
      <p class="copy">
        The product is not a static plan. Log what actually happened, record the new constraints,
        and inspect how the route map should branch again.
      </p>
    </div>
  </div>

  {#if !currentMap}
    <p class="empty">Generate a pathway first to activate updates and revision previews.</p>
  {:else}
    <div class="grid">
      <article class="card">
        <h3>Record what actually happened</h3>
        <p class="muted">Current pathway: {currentMap.title}</p>
        <label>
          <span>Current trunk / route</span>
          <select bind:value={selectedRouteNodeId}>
            {#each currentMap.graph_bundle.nodes as node (node.id)}
              <option value={node.id}>{node.label}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Why this is your current route</span>
          <textarea bind:value={routeRationale} rows="2"></textarea>
        </label>
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
          {#if isSubmitting}Submitting...{:else}Generate revision preview{/if}
        </button>
      </article>

      <article class="card">
        <h3>Recent state updates</h3>
        {#if routeSelection}
          <p class="muted">Current route: {routeSelection.selected_node_id}</p>
        {/if}
        {#if stateUpdates.length === 0}
          <p class="empty">No state updates recorded yet.</p>
        {:else}
          <ul class="stack-list">
            {#each stateUpdates as update (update.id)}
              <li>
                <strong>{update.update_date}</strong>
                <p>{update.progress_summary}</p>
                {#if update.blockers}
                  <small>Blockers: {update.blockers}</small>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </article>
    </div>

    <article class="card proposal-card">
      <h3>What this revision would reshape</h3>
      {#if preview}
        <p class="muted">{preview.rationale}</p>

        {#if preview.diff.summary.length > 0}
          <div class="pill-row">
            {#each preview.diff.summary as item (item)}
              <span class="pill">{item}</span>
            {/each}
          </div>
        {/if}

        <div class="diff-grid">
          <section>
            <h4>Node changes</h4>
            {#if preview.diff.node_changes.length === 0}
              <p class="empty">No node changes.</p>
            {:else}
              <ul class="stack-list">
                {#each preview.diff.node_changes as change (`${change.change_type}-${change.node_id}`)}
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
              {#each preview.diff.edge_changes as change (`edge-${change.change_type}-${change.edge_id}`)}
                <li>
                  <strong>{change.change_type} · {change.edge_id}</strong>
                  <p>{change.source} → {change.target}</p>
                  <small>{change.reason}</small>
                </li>
              {/each}
              {#each preview.diff.warning_changes as change (`warning-${change.change_type}-${change.warning}`)}
                <li>
                  <strong>{change.change_type} warning</strong>
                  <p>{change.warning}</p>
                </li>
              {/each}
              {#if preview.diff.edge_changes.length === 0 && preview.diff.warning_changes.length === 0}
                <li>
                  <p class="empty">No edge or warning changes.</p>
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
        <p class="empty">Save a fresh state update to inspect the next pathway diff here.</p>
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
  textarea,
  select {
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
