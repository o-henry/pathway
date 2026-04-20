import type {
  CurrentStateSnapshot,
  GoalAnalysisRecord,
  GoalRecord,
  GraphBundle,
  LifeMap,
  RevisionProposalRecord,
  RouteSelectionRecord,
  StateUpdateRecord
} from './types';

const API_BASE_URL = 'http://127.0.0.1:8000';

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      typeof payload?.detail === 'string' ? payload.detail : `Request failed (${response.status})`
    );
  }

  return payload as T;
}

export async function fetchGoals(): Promise<GoalRecord[]> {
  return parseJson<GoalRecord[]>(await fetch(`${API_BASE_URL}/goals`));
}

export async function createGoal(payload: {
  title: string;
  description: string;
  category: string;
  success_criteria: string;
}): Promise<GoalRecord> {
  return parseJson<GoalRecord>(
    await fetch(`${API_BASE_URL}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  );
}

export async function analyzeGoal(goalId: string): Promise<GoalAnalysisRecord> {
  return parseJson<GoalAnalysisRecord>(
    await fetch(`${API_BASE_URL}/goals/${goalId}/analysis`, {
      method: 'POST'
    })
  );
}

export async function fetchGoalMaps(goalId: string): Promise<LifeMap[]> {
  return parseJson<LifeMap[]>(await fetch(`${API_BASE_URL}/goals/${goalId}/maps`));
}

export async function generatePathway(goalId: string): Promise<LifeMap> {
  return parseJson<LifeMap>(
    await fetch(`${API_BASE_URL}/goals/${goalId}/pathways/generate`, {
      method: 'POST'
    })
  );
}

export async function fetchCurrentState(goalId: string): Promise<CurrentStateSnapshot | null> {
  return parseJson<CurrentStateSnapshot | null>(
    await fetch(`${API_BASE_URL}/goals/${goalId}/current-state`)
  );
}

export async function fetchStateUpdates(goalId: string): Promise<StateUpdateRecord[]> {
  return parseJson<StateUpdateRecord[]>(await fetch(`${API_BASE_URL}/goals/${goalId}/state-updates`));
}

export async function createStateUpdate(
  goalId: string,
  payload: {
    update_date: string;
    actual_time_spent: number | null;
    actual_money_spent: number | null;
    mood: string | null;
    progress_summary: string;
    blockers: string;
    next_adjustment: string;
    resource_deltas: Record<string, unknown>;
    learned_items: string[];
    source_refs: string[];
    pathway_id?: string | null;
  }
): Promise<StateUpdateRecord> {
  return parseJson<StateUpdateRecord>(
    await fetch(`${API_BASE_URL}/goals/${goalId}/state-updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  );
}

export async function fetchRouteSelection(pathwayId: string): Promise<RouteSelectionRecord | null> {
  return parseJson<RouteSelectionRecord | null>(
    await fetch(`${API_BASE_URL}/pathways/${pathwayId}/route-selection`)
  );
}

export async function updateRouteSelection(
  pathwayId: string,
  payload: { selected_node_id: string; rationale: string }
): Promise<RouteSelectionRecord> {
  return parseJson<RouteSelectionRecord>(
    await fetch(`${API_BASE_URL}/pathways/${pathwayId}/route-selection`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  );
}

export async function createRevisionPreview(
  mapId: string,
  payload: { checkin_id: string }
): Promise<RevisionProposalRecord> {
  return parseJson<RevisionProposalRecord>(
    await fetch(`${API_BASE_URL}/maps/${mapId}/revision-proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  );
}

export async function fetchRevisionPreview(proposalId: string): Promise<RevisionProposalRecord> {
  return parseJson<RevisionProposalRecord>(
    await fetch(`${API_BASE_URL}/revision-previews/${proposalId}`)
  );
}

export async function acceptRevisionPreview(proposalId: string): Promise<LifeMap> {
  return parseJson<LifeMap>(
    await fetch(`${API_BASE_URL}/revision-previews/${proposalId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '' })
    })
  );
}

export async function rejectRevisionPreview(proposalId: string): Promise<RevisionProposalRecord> {
  return parseJson<RevisionProposalRecord>(
    await fetch(`${API_BASE_URL}/revision-previews/${proposalId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '' })
    })
  );
}

export function getEvidenceForNode(bundle: GraphBundle, nodeId: string) {
  const node = bundle.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return [];
  }
  const ids = new Set(node.evidence_refs);
  return bundle.evidence.filter((item) => ids.has(item.id));
}

export function getAssumptionsForNode(bundle: GraphBundle, nodeId: string) {
  const node = bundle.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return [];
  }
  const ids = new Set(node.assumption_refs);
  return bundle.assumptions.filter((item) => ids.has(item.id));
}
