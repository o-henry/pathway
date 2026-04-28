export type ToneToken =
  | 'mint'
  | 'lavender'
  | 'peach'
  | 'sky'
  | 'rose'
  | 'sand'
  | 'yellow'
  | 'slate';

export type NodeShape = 'rounded_card' | 'pill' | 'circle';
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
    tone?: ToneToken | string;
    shape?: NodeShape | string;
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
  style_overrides?: Record<string, unknown>;
  status?: string;
  created_from?: string;
  revision_meta?: Record<string, unknown>;
}

export interface GraphEdgeRecord {
  id: string;
  type: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
  weight?: number;
  style_overrides?: Record<string, unknown>;
}

export interface EvidenceItem {
  id: string;
  source_id: string;
  title: string;
  quote_or_summary: string;
  url: string | null;
  reliability: string;
  rank_score?: number | null;
  query_labels?: string[];
  source_layer?: string | null;
  ranking_reason?: string | null;
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

export interface FieldPreview {
  key: string;
  label: string;
  value: string;
}

export interface MindMapNodeData {
  [key: string]: unknown;
  node: GraphNodeRecord;
  nodeType?: GraphNodeTypeDefinition;
  tone: ToneToken;
  shape: NodeShape;
  typeLabel: string;
  accent: string;
  evidenceCount: number;
  assumptionCount: number;
  fieldPreview: FieldPreview[];
  riskLevel: number | null;
  selectedRoute?: boolean;
  changedInPreview?: boolean;
  overlayMode?: boolean;
}

export interface MindMapEdgeData {
  [key: string]: unknown;
  edge: GraphEdgeRecord;
  edgeType?: GraphEdgeTypeDefinition;
  role: EdgeRole;
  line: string;
  accent: string;
  hovered: boolean;
  active: boolean;
}
