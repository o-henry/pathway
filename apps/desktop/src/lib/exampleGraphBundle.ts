import type { GraphBundle } from './types';

const baseExampleGraphBundle: GraphBundle = {
  schema_version: '1.0.0',
  bundle_id: 'pathway_desktop_demo',
  map: {
    title: '로컬 Pathway 데모',
    goal_id: 'demo-goal',
    summary: '그래프 우선 작업면에서 루트, 압력 지점, 체크포인트, 전환 루트를 미리 확인하는 데모입니다.'
  },
  ontology: {
    node_types: [
      {
        id: 'goal',
        label: '목표',
        description: '도달하려는 상태',
        default_style: { tone: 'sky', shape: 'rounded_card' },
        fields: [{ key: 'success_criteria', label: '성공 기준', value_type: 'markdown', required: true }]
      },
      {
        id: 'route',
        label: '루트',
        description: '주요 경로',
        default_style: { tone: 'lavender', shape: 'rounded_card' },
        fields: [{ key: 'fit_reason', label: '적합 이유', value_type: 'markdown', required: false }]
      },
      {
        id: 'checkpoint',
        label: '체크포인트',
        description: '검증 지점',
        default_style: { tone: 'yellow', shape: 'rounded_card' },
        fields: [{ key: 'checkpoint', label: '체크포인트', value_type: 'markdown', required: false }]
      },
      {
        id: 'pressure',
        label: '압력',
        description: '루트를 막는 요인',
        default_style: { tone: 'rose', shape: 'rounded_card' },
        fields: [{ key: 'impact', label: '영향', value_type: 'markdown', required: false }]
      },
      {
        id: 'switch',
        label: '전환',
        description: '대체 브랜치',
        default_style: { tone: 'mint', shape: 'rounded_card' },
        fields: [{ key: 'trigger', label: '전환 조건', value_type: 'markdown', required: false }]
      }
    ],
    edge_types: [
      { id: 'progresses_to', label: 'Progresses to', role: 'progression', default_style: { line: 'curved' } },
      { id: 'supported_by', label: 'Supported by', role: 'reference', default_style: { line: 'dotted' } }
    ]
  },
  nodes: [
    {
      id: 'goal',
      type: 'goal',
      label: '목표에 도달하기',
      summary: '활성 목표를 기준으로 현재 가능한 루트를 유지하고 현실 변화에 맞춰 갱신합니다.',
      data: { success_criteria: '하나의 활성 루트, 하나의 체크포인트, 하나의 핵심 압력 지점을 선명하게 유지합니다.' },
      evidence_refs: [],
      assumption_refs: ['assumption_capacity']
    },
    {
      id: 'route_direct',
      type: 'route',
      label: '직행 루트',
      summary: '속도는 빠르지만 반복 실행력이 안정적이어야 합니다.',
      data: { fit_reason: '현재 가용 시간이 일정하고 주 단위 진도를 유지할 수 있을 때 유리합니다.' },
      evidence_refs: ['evidence_feedback'],
      assumption_refs: []
    },
    {
      id: 'route_guided',
      type: 'route',
      label: '가이드 루트',
      summary: '지원 비용은 더 들지만 수정 신호를 빨리 얻을 수 있습니다.',
      data: { fit_reason: '방향 이탈 비용이 크고 외부 피드백이 중요한 목표에 적합합니다.' },
      evidence_refs: ['evidence_external'],
      assumption_refs: []
    },
    {
      id: 'checkpoint',
      type: 'checkpoint',
      label: '체크포인트',
      summary: '현재 루트가 아직 우선순위를 가질 만한지 다시 확인합니다.',
      data: { checkpoint: '다음 검증 항목, 현재 루트, 가장 강한 장애 요인을 함께 확인합니다.' },
      evidence_refs: [],
      assumption_refs: []
    },
    {
      id: 'pressure',
      type: 'pressure',
      label: '가용 자원 축소',
      summary: '시간이나 예산이 줄면 기존 브랜치가 빠르게 약해집니다.',
      data: { impact: '조용히 실패하기 전에 범위를 줄이거나 전환 루트를 열어야 합니다.' },
      evidence_refs: [],
      assumption_refs: []
    },
    {
      id: 'switch',
      type: 'switch',
      label: '범위 축소',
      summary: '조금 더 작지만 오래 유지 가능한 대안입니다.',
      data: { trigger: '실제 주간 시간이 여러 번 연속 계획보다 낮으면 이 루트로 전환합니다.' },
      evidence_refs: ['evidence_feedback'],
      assumption_refs: []
    }
  ],
  edges: [
    { id: 'e1', type: 'progresses_to', source: 'goal', target: 'route_direct', label: 'Primary start' },
    { id: 'e2', type: 'progresses_to', source: 'goal', target: 'route_guided', label: 'Alternative start' },
    { id: 'e3', type: 'progresses_to', source: 'route_direct', target: 'checkpoint' },
    { id: 'e4', type: 'progresses_to', source: 'route_direct', target: 'pressure' },
    { id: 'e5', type: 'progresses_to', source: 'pressure', target: 'switch' }
  ],
  evidence: [
    {
      id: 'evidence_feedback',
      source_id: 'note-1',
      title: '짧은 피드백 루프 반복',
      quote_or_summary: '짧은 검증 루프가 있어야 그래프가 오래되기 전에 루트 이탈을 발견할 수 있습니다.',
      url: null,
      reliability: 'user_saved_note'
    },
    {
      id: 'evidence_external',
      source_id: 'note-2',
      title: '외부 검토는 수정 속도를 높입니다',
      quote_or_summary: '잘못된 브랜치 비용이 큰 경우에는 가이드 검토 비용보다 교정 속도가 더 중요할 수 있습니다.',
      url: null,
      reliability: 'user_saved_note'
    }
  ],
  assumptions: [
    {
      id: 'assumption_capacity',
      text: '사용자는 매주 최소 한 번은 집중 작업 블록을 확보할 수 있습니다.',
      risk_if_false: '직행 루트가 약해지고 더 낮은 마찰의 루트가 현실적이 됩니다.'
    }
  ],
  warnings: ['이 그래프는 예측 엔진이 아니라 시나리오 작업면입니다.']
};

export function buildExampleGraphBundle(goalTitle?: string): GraphBundle {
  const next = structuredClone(baseExampleGraphBundle);
  if (goalTitle?.trim()) {
    next.map.title = `${goalTitle.trim()} 데모 경로`;
    next.nodes[0]!.label = goalTitle.trim();
  }
  return next;
}

export const exampleGraphBundle: GraphBundle = buildExampleGraphBundle();
