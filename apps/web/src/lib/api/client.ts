import type { GraphBundle } from '$lib/graph/types';

export interface ProfileRecord {
  id: string;
  display_name: string;
  age: number | null;
  weekly_free_hours: number | null;
  monthly_budget_amount: number | null;
  monthly_budget_currency: string | null;
  energy_level: string | null;
  preference_tags: string[];
  constraints: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GoalRecord {
  id: string;
  profile_id: string;
  title: string;
  description: string;
  category: string;
  deadline: string | null;
  success_criteria: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PathwayRecord {
  id: string;
  title: string;
  goal_id: string;
  graph_bundle: GraphBundle;
  created_at: string;
  updated_at: string;
}

export type GeneratedMapResponse = PathwayRecord;

export interface MapExportEnvelope {
  format_version: string;
  exported_at: string;
  profile: ProfileRecord | null;
  goal: GoalRecord;
  map: GeneratedMapResponse;
}

export interface StateUpdateRecord {
  id: string;
  goal_id: string;
  pathway_id: string | null;
  legacy_checkin_id: string | null;
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
  created_at: string;
}

export interface CheckInResponse {
  id: string;
  goal_id: string;
  map_id: string | null;
  checkin_date: string;
  actual_time_spent: number | null;
  actual_money_spent: number | null;
  mood: string | null;
  progress_summary: string;
  blockers: string;
  next_adjustment: string;
  created_at: string;
}

export interface CurrentStateSnapshot {
  id: string;
  goal_id: string;
  interview_answers: Record<string, unknown>;
  resource_values: Record<string, unknown>;
  active_constraints: string[];
  state_summary: string;
  derived_from_update_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface RouteSelectionRecord {
  id: string;
  goal_id: string;
  pathway_id: string;
  selected_node_id: string;
  rationale: string;
  created_at: string;
  updated_at: string;
}

export interface GraphNodeChange {
  node_id: string;
  change_type: 'added' | 'removed' | 'updated' | 'status_changed';
  label: string;
  reason: string;
  previous_status: string | null;
  next_status: string | null;
  fields_changed: string[];
}

export interface GraphEdgeChange {
  edge_id: string;
  change_type: 'added' | 'removed' | 'updated';
  source: string;
  target: string;
  label: string | null;
  reason: string;
}

export interface GraphWarningChange {
  change_type: 'added' | 'removed';
  warning: string;
}

export interface GraphDiff {
  summary: string[];
  node_changes: GraphNodeChange[];
  edge_changes: GraphEdgeChange[];
  warning_changes: GraphWarningChange[];
}

export interface RevisionPreviewResponse {
  id: string;
  goal_id: string;
  source_map_id: string;
  checkin_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  rationale: string;
  diff: GraphDiff;
  proposed_graph_bundle: GraphBundle;
  accepted_map_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export type RevisionProposalResponse = RevisionPreviewResponse;

export interface ResourceDimension {
  id: string;
  label: string;
  kind: string;
  value_type: string;
  question: string;
  relevance_reason: string;
}

export interface GoalAnalysisRecord {
  goal_id: string;
  analysis_summary: string;
  resource_dimensions: ResourceDimension[];
  research_questions: string[];
  followup_questions: Array<{
    id: string;
    label: string;
    question: string;
    why_needed: string;
    answer_type: string;
    required: boolean;
    maps_to: string[];
  }>;
  research_plan: {
    summary: string;
    collection_targets: Array<{
      id: string;
      label: string;
      layer: string;
      search_intent: string;
      example_queries: string[];
      preferred_collectors: string[];
      source_examples: string[];
      reason: string;
      max_sources: number;
    }>;
    verification_checks: string[];
    expected_graph_complexity: string;
  } | null;
}

const apiBaseUrl =
  (import.meta.env.PUBLIC_API_BASE_URL as string | undefined) || 'http://127.0.0.1:8000';

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      typeof payload?.detail === 'string' ? payload.detail : `Request failed (${response.status})`;
    throw new Error(detail);
  }

  return payload as T;
}

export async function readText(response: Response): Promise<string> {
  const text = await response.text();

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = text ? JSON.parse(text) : null;
      if (typeof payload?.detail === 'string') {
        detail = payload.detail;
      }
    } catch {
      // Ignore JSON parse errors and fall back to the generic message.
    }
    throw new Error(detail);
  }

  return text;
}

export function downloadTextFile(filename: string, content: string, contentType: string): void {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
