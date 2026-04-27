import type {
  AssumptionItem,
  EvidenceItem,
  GraphBundle,
  GraphNodeRecord,
  RevisionProposalRecord,
  StateUpdateRecord,
} from '../lib/types';

const ACTION_FIELD_LABELS: Record<string, string> = {
  user_step: '먼저 할 일',
  how_to_do_it: '하는 방법',
  practice_step: '연습 방식',
  next_action: '다음 행동',
  success_check: '성공 확인',
  verification_step: '검증',
  record_after: '기록할 것',
  checkpoint: '체크포인트',
  switch_condition: '전환 조건',
  evidence_basis: '근거 신호',
};

const ACTION_FIELD_ORDER = Object.keys(ACTION_FIELD_LABELS);

export function formatFieldValue(value: unknown): string {
  if (value == null) {
    return '데이터 없음';
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function cleanCollectorMessage(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function truncateCollectorMessage(value: string, maxLength = 220): string {
  const clean = cleanCollectorMessage(value);
  if (clean.length <= maxLength) {
    return clean;
  }
  return `${clean.slice(0, maxLength - 1)}…`;
}

export function isMetadataOnlyEvidence(item: EvidenceItem): boolean {
  return item.reliability === 'public_url_metadata' || /metadata-only|candidate source/i.test(item.quote_or_summary);
}

export function evidenceReliabilityLabel(item: EvidenceItem): string {
  if (isMetadataOnlyEvidence(item)) {
    return '후보 URL · 원문 미수집';
  }
  if (item.reliability === 'public_url_allowed') {
    return '원문 수집됨';
  }
  if (item.reliability === 'manual_note') {
    return '사용자/수동 노트';
  }
  return item.reliability;
}

function formatActionFieldValue(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map(formatActionFieldValue).filter(Boolean).join(' / ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => `${key.replaceAll('_', ' ')}: ${formatActionFieldValue(entryValue)}`)
      .filter((line) => line.trim())
      .join(' / ');
  }
  return String(value).replace(/\s+/g, ' ').trim();
}

function extractActionableNodeEntries(node: GraphNodeRecord): string[] {
  const data = node.data ?? {};
  return ACTION_FIELD_ORDER
    .map((key) => {
      const value = formatActionFieldValue(data[key]);
      return value ? `${ACTION_FIELD_LABELS[key]}: ${value}` : '';
    })
    .filter(Boolean)
    .slice(0, 6);
}

export function buildNodeActionGuidance(
  node: GraphNodeRecord,
  evidence: EvidenceItem[],
  assumptions: AssumptionItem[],
): { title: string; steps: string[]; note: string } {
  const actionableEntries = extractActionableNodeEntries(node);
  const contentEvidence = evidence.filter((item) => !isMetadataOnlyEvidence(item));
  const metadataEvidence = evidence.filter(isMetadataOnlyEvidence);
  const steps = actionableEntries;
  const missingActionDetail = steps.length === 0;
  if (missingActionDetail) {
    steps.push('이 노드는 실행 지침이 생성되지 않았습니다. 이 상태로는 따라 할 step으로 쓰기 어렵습니다.');
    steps.push('그래프를 다시 생성하거나 업데이트 입력으로 “이 노드의 구체 실행 단계를 근거 기반으로 보강”하라고 요청하세요.');
  }
  if (metadataEvidence.length > 0 && contentEvidence.length === 0) {
    steps.push('후보 URL만 붙어 있으므로, 실행 전에 근거로 쓸 만한 자료인지 먼저 확인합니다.');
  }
  if (assumptions.length > 0) {
    steps.push(`이 노드는 전제 ${assumptions.length}개에 기대고 있습니다. 틀릴 가능성이 큰 전제 하나를 먼저 확인합니다.`);
  }
  return {
    title: missingActionDetail
      ? '실행 지침 없음'
      : '근거 기반 실행 단계',
    steps: steps.slice(0, 4),
    note: missingActionDetail
      ? '이건 정상적인 최종 상태가 아닙니다. 새로 생성되는 그래프는 주요 노드마다 실행 필드를 갖도록 백엔드 계약을 강화했습니다.'
      : '실행 후 결과를 기록하면 다음 리비전에서 이 경로를 유지할지, 약화할지, 다른 루트로 돌릴지 판단할 수 있습니다.',
  };
}

export function mergePreviewBundle(baseBundle: GraphBundle, proposal: RevisionProposalRecord | null): GraphBundle {
  if (!proposal) {
    return baseBundle;
  }

  const proposedBundle = proposal.proposed_graph_bundle;
  const mergedNodeTypes = new Map(
    [...baseBundle.ontology.node_types, ...proposedBundle.ontology.node_types].map((item) => [item.id, item])
  );
  const mergedEdgeTypes = new Map(
    [...baseBundle.ontology.edge_types, ...proposedBundle.ontology.edge_types].map((item) => [item.id, item])
  );
  const mergedEvidence = new Map(
    [...baseBundle.evidence, ...proposedBundle.evidence].map((item) => [item.id, item])
  );
  const mergedAssumptions = new Map(
    [...baseBundle.assumptions, ...proposedBundle.assumptions].map((item) => [item.id, item])
  );
  const mergedNodes = new Map(proposedBundle.nodes.map((item) => [item.id, item]));
  const mergedEdges = new Map(proposedBundle.edges.map((item) => [item.id, item]));

  for (const change of proposal.diff.node_changes) {
    if (change.change_type !== 'removed') {
      continue;
    }
    const existingNode = baseBundle.nodes.find((item) => item.id === change.node_id);
    if (existingNode) {
      mergedNodes.set(existingNode.id, existingNode);
    }
  }

  for (const change of proposal.diff.edge_changes) {
    if (change.change_type !== 'removed') {
      continue;
    }
    const existingEdge = baseBundle.edges.find(
      (item) =>
        item.id === change.edge_id ||
        (item.source === change.source && item.target === change.target)
    );
    if (existingEdge) {
      mergedEdges.set(existingEdge.id, existingEdge);
    }
  }

  return {
    ...proposedBundle,
    ontology: {
      node_types: [...mergedNodeTypes.values()],
      edge_types: [...mergedEdgeTypes.values()],
    },
    nodes: [...mergedNodes.values()],
    edges: [...mergedEdges.values()],
    evidence: [...mergedEvidence.values()],
    assumptions: [...mergedAssumptions.values()],
  };
}

export function findSelectedNode(
  bundle: GraphBundle | null,
  selectedNodeId: string | null
): GraphNodeRecord | null {
  if (!bundle || !selectedNodeId) {
    return null;
  }
  return bundle.nodes.find((node) => node.id === selectedNodeId) ?? null;
}

export function getVisibleNodeFields(node: GraphNodeRecord): Array<[string, unknown]> {
  return Object.entries(node.data).filter(([key]) => !key.startsWith('__'));
}

function normalizeProgressMatchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeProgressText(value: string): string[] {
  return [...new Set(normalizeProgressMatchText(value).split(' ').filter((token) => token.length >= 2))];
}

function buildNodeSearchText(node: GraphNodeRecord): string {
  return normalizeProgressMatchText([
    node.label,
    node.summary,
    ...Object.values(node.data ?? {}).map((value) => {
      if (value == null) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    })
  ].join(' '));
}

export function stateUpdateMatchesNode(update: StateUpdateRecord, node: GraphNodeRecord): boolean {
  if (normalizeProgressMatchText((node.data as Record<string, unknown>)?.pathway_display_role) === 'terminal_goal') {
    return false;
  }
  const updateText = normalizeProgressMatchText([
    update.progress_summary,
    update.blockers,
    update.next_adjustment,
    update.mood,
  ].join(' '));
  if (!updateText) {
    return false;
  }
  const nodeText = buildNodeSearchText(node);
  const labelText = normalizeProgressMatchText(node.label);
  if (labelText && (updateText.includes(labelText) || labelText.includes(updateText))) {
    return true;
  }
  const updateTokens = tokenizeProgressText(updateText);
  if (updateTokens.length === 0) {
    return false;
  }
  const matchedTokenCount = updateTokens.filter((token) => nodeText.includes(token)).length;
  return matchedTokenCount >= Math.min(2, updateTokens.length);
}

export function sortStateUpdatesNewestFirst(updates: StateUpdateRecord[]): StateUpdateRecord[] {
  return [...updates].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.update_date) || Date.parse(left.update_date) || 0;
    const rightTime = Date.parse(right.created_at ?? right.update_date) || Date.parse(right.update_date) || 0;
    return rightTime - leftTime;
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function formatUiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (/authorization is required|unauthorized|401/i.test(message)) {
    return 'Pathway 로컬 API 인증 토큰이 맞지 않습니다. pnpm dev를 재시작하면 desktop shell이 API를 같은 토큰으로 다시 띄웁니다.';
  }
  if (/failed to fetch|networkerror|load failed|local API is not reachable|readiness check timed out|local backend is not reachable/i.test(message)) {
    return 'Pathway 로컬 API에 연결하지 못해 그래프 생성을 시작하지 않았습니다. pnpm dev가 API까지 같이 띄우도록 설정되어 있으니 앱을 재시작한 뒤 바로 다시 시도해 주세요.';
  }
  return message || fallback;
}

export function isLocalApiTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|networkerror|load failed|Pathway local backend is not reachable|Pathway local API is not reachable|readiness check timed out/i.test(message);
}

export function buildIntakeGoalTitle(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '새 Pathway 목표';
  }
  return normalized.length > 72 ? `${normalized.slice(0, 72).trim()}...` : normalized;
}

export function buildIntakeSuccessCriteria(input: string): string {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '상담을 통해 성공 기준을 구체화한다.';
  }
  return normalized.length > 160 ? `${normalized.slice(0, 160).trim()}...` : normalized;
}

export function isTauriUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /tauri runtime unavailable|__tauri|tauri|ipc|invoke/i.test(message);
}
