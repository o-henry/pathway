import type { GraphBundle } from './types';

export const exampleGraphBundle: GraphBundle = {
  schema_version: '1.0.0',
  bundle_id: 'pathway_desktop_demo',
  map: {
    title: 'Adaptive pathway workspace',
    goal_id: 'demo-goal',
    summary: 'A graph-first board showing routes, pressure points, checkpoints, and route switches.'
  },
  ontology: {
    node_types: [
      {
        id: 'goal',
        label: 'Goal',
        description: 'Target state',
        default_style: { tone: 'sky', shape: 'rounded_card' },
        fields: [{ key: 'success_criteria', label: 'Success criteria', value_type: 'markdown', required: true }]
      },
      {
        id: 'route',
        label: 'Route',
        description: 'Primary route',
        default_style: { tone: 'lavender', shape: 'rounded_card' },
        fields: [{ key: 'fit_reason', label: 'Why this route', value_type: 'markdown', required: false }]
      },
      {
        id: 'checkpoint',
        label: 'Checkpoint',
        description: 'Validation checkpoint',
        default_style: { tone: 'yellow', shape: 'rounded_card' },
        fields: [{ key: 'checkpoint', label: 'Checkpoint', value_type: 'markdown', required: false }]
      },
      {
        id: 'pressure',
        label: 'Pressure',
        description: 'A route blocker',
        default_style: { tone: 'rose', shape: 'rounded_card' },
        fields: [{ key: 'impact', label: 'Impact', value_type: 'markdown', required: false }]
      },
      {
        id: 'switch',
        label: 'Switch',
        description: 'Alternative branch',
        default_style: { tone: 'mint', shape: 'rounded_card' },
        fields: [{ key: 'trigger', label: 'Trigger', value_type: 'markdown', required: false }]
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
      label: 'Reach the goal',
      summary: 'Start from a live goal and keep the route updated as reality changes.',
      data: { success_criteria: 'One active route, one visible checkpoint, and one known pressure point.' },
      evidence_refs: [],
      assumption_refs: ['assumption_capacity']
    },
    {
      id: 'route_direct',
      type: 'route',
      label: 'Direct route',
      summary: 'Fast route with tighter execution loops.',
      data: { fit_reason: 'Works when current capacity is steady enough to sustain weekly progress.' },
      evidence_refs: ['evidence_feedback'],
      assumption_refs: []
    },
    {
      id: 'route_guided',
      type: 'route',
      label: 'Guided route',
      summary: 'Higher support cost but better correction signals.',
      data: { fit_reason: 'Useful when drift is expensive and outside feedback matters.' },
      evidence_refs: ['evidence_external'],
      assumption_refs: []
    },
    {
      id: 'checkpoint',
      type: 'checkpoint',
      label: 'Checkpoint',
      summary: 'Validate whether the current route still deserves priority.',
      data: { checkpoint: 'Clarify the next test, the current route, and the strongest blocker.' },
      evidence_refs: [],
      assumption_refs: []
    },
    {
      id: 'pressure',
      type: 'pressure',
      label: 'Shrinking capacity',
      summary: 'A resource drop weakens the original branch.',
      data: { impact: 'The route has to narrow or switch before it silently fails.' },
      evidence_refs: [],
      assumption_refs: []
    },
    {
      id: 'switch',
      type: 'switch',
      label: 'Reduce scope',
      summary: 'A smaller but more durable alternative.',
      data: { trigger: 'Switch when actual weekly time remains below plan for multiple updates.' },
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
      title: 'Repeated short feedback loops',
      quote_or_summary: 'Short validation loops keep route drift visible before the graph becomes stale.',
      url: null,
      reliability: 'user_saved_note'
    },
    {
      id: 'evidence_external',
      source_id: 'note-2',
      title: 'External review improves correction speed',
      quote_or_summary: 'Guided review helps when the cost of the wrong branch is higher than the added budget.',
      url: null,
      reliability: 'user_saved_note'
    }
  ],
  assumptions: [
    {
      id: 'assumption_capacity',
      text: 'The user can preserve at least one focused work block each week.',
      risk_if_false: 'The direct route weakens and a lower-friction route becomes more realistic.'
    }
  ],
  warnings: ['This graph is a scenario workspace, not a prediction engine.']
};
