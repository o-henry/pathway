export type EdgeRole = 'progression' | 'reference' | string;

export interface GraphFieldDefinition {
  key: string;
  label: string;
  value_type: string;
  required: boolean;
}

export interface GraphNodeTypeDefinition {
  id: string;
  label: string;
  description: string;
  default_style?: {
    tone?: string;
    shape?: string;
    accent?: string;
  };
  fields: GraphFieldDefinition[];
}

export interface GraphEdgeTypeDefinition {
  id: string;
  label: string;
  role: EdgeRole;
  default_style?: {
    line?: string;
    accent?: string;
  };
}

export interface GraphNodeRecord {
  id: string;
  type: string;
  label: string;
  summary: string;
  data: Record<string, unknown>;
  scores?: Record<string, number>;
  evidence_refs: string[];
  assumption_refs: string[];
  position?: { x: number; y: number };
  status?: string;
}

export interface GraphEdgeRecord {
  id: string;
  type: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface EvidenceItem {
  id: string;
  source_id: string;
  title: string;
  quote_or_summary: string;
  url: string | null;
  reliability: string;
}

export interface AssumptionItem {
  id: string;
  text: string;
  risk_if_false: string;
}

export interface GraphBundle {
  schema_version: string;
  bundle_id: string;
  map: {
    title: string;
    goal_id: string;
    summary: string;
  };
  ontology: {
    node_types: GraphNodeTypeDefinition[];
    edge_types: GraphEdgeTypeDefinition[];
  };
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  evidence: EvidenceItem[];
  assumptions: AssumptionItem[];
  warnings: string[];
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

export interface GoalAnalysisRecord {
  goal_id: string;
  analysis_summary: string;
  resource_dimensions: Array<{
    id: string;
    label: string;
    kind: string;
    value_type: string;
    question: string;
    relevance_reason: string;
  }>;
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

export interface LifeMap {
  id: string;
  title: string;
  goal_id: string;
  graph_bundle: GraphBundle;
  created_at: string;
  updated_at: string;
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

export interface RouteSelectionRecord {
  id: string;
  goal_id: string;
  pathway_id: string;
  selected_node_id: string;
  rationale: string;
  created_at: string;
  updated_at: string;
}

export type GraphNodePreviewChangeType = 'added' | 'removed' | 'updated' | 'status_changed';
export type GraphEdgePreviewChangeType = 'added' | 'removed' | 'updated';

export interface GraphNodeChangeRecord {
  node_id: string;
  change_type: GraphNodePreviewChangeType;
  label: string;
  reason: string;
  previous_status: string | null;
  next_status: string | null;
  fields_changed: string[];
}

export interface GraphEdgeChangeRecord {
  edge_id: string;
  change_type: GraphEdgePreviewChangeType;
  source: string;
  target: string;
  label: string | null;
  reason: string;
}

export interface GraphWarningChangeRecord {
  change_type: 'added' | 'removed';
  warning: string;
}

export interface GraphDiffRecord {
  summary: string[];
  node_changes: GraphNodeChangeRecord[];
  edge_changes: GraphEdgeChangeRecord[];
  warning_changes: GraphWarningChangeRecord[];
}

export interface RevisionProposalRecord {
  id: string;
  goal_id: string;
  source_map_id: string;
  checkin_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  rationale: string;
  diff: GraphDiffRecord;
  proposed_graph_bundle: GraphBundle;
  accepted_map_id: string | null;
  created_at: string;
  resolved_at: string | null;
}
