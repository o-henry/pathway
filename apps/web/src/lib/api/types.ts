import type { GraphBundle } from '$lib/graph/types';

export interface GeneratedMapResponse {
  id: string;
  title: string;
  goal_id: string;
  graph_bundle: GraphBundle;
  created_at: string;
  updated_at: string;
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

export interface RevisionProposalResponse {
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
