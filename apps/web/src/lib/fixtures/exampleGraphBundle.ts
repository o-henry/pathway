import type { GraphBundle } from '$lib/graph/types';

export const exampleGraphBundle: GraphBundle = {
  schema_version: '1.0.0',
  bundle_id: 'pathway_demo_generic_003',
  map: {
    title: 'Adaptive goal pathway',
    goal_id: 'goal_demo_001',
    summary:
      'A generic route map showing how a goal can branch, tighten, and recover as time, budget, and feedback conditions change.'
  },
  ontology: {
    node_types: [
      {
        id: 'central_goal',
        label: 'Goal',
        description: 'The target state the user is trying to reach.',
        default_style: {
          tone: 'sky',
          shape: 'circle',
          accent: 'none'
        },
        fields: [
          {
            key: 'success_criteria',
            label: 'Success criteria',
            value_type: 'markdown',
            required: true
          }
        ]
      },
      {
        id: 'route_choice',
        label: 'Route',
        description: 'A major path toward the goal.',
        default_style: {
          tone: 'lavender',
          shape: 'rounded_card',
          accent: 'none'
        },
        fields: [
          { key: 'time_cost', label: 'Time cost', value_type: 'duration_range', required: false },
          { key: 'money_cost', label: 'Budget range', value_type: 'money_range', required: false },
          { key: 'fit_reason', label: 'Why this route', value_type: 'markdown', required: false }
        ]
      },
      {
        id: 'resource_pressure',
        label: 'Pressure',
        description: 'A condition that weakens or blocks a route.',
        default_style: {
          tone: 'rose',
          shape: 'rounded_card',
          accent: 'none'
        },
        fields: [
          { key: 'pressure_type', label: 'Pressure type', value_type: 'string', required: true },
          { key: 'impact', label: 'Impact', value_type: 'markdown', required: true }
        ]
      },
      {
        id: 'switch_option',
        label: 'Switch',
        description: 'A route change triggered by new constraints or evidence.',
        default_style: {
          tone: 'mint',
          shape: 'rounded_card',
          accent: 'none'
        },
        fields: [
          { key: 'trigger', label: 'Trigger', value_type: 'markdown', required: true }
        ]
      },
      {
        id: 'milestone',
        label: 'Checkpoint',
        description: 'A concrete state worth validating before moving forward.',
        default_style: {
          tone: 'yellow',
          shape: 'rounded_card',
          accent: 'none'
        },
        fields: [
          { key: 'checkpoint', label: 'Checkpoint', value_type: 'markdown', required: true }
        ]
      },
      {
        id: 'missed_branch',
        label: 'Opportunity cost',
        description: 'What is lost when a route is delayed or ignored.',
        default_style: {
          tone: 'sand',
          shape: 'rounded_card',
          accent: 'none'
        },
        fields: [{ key: 'loss', label: 'Loss', value_type: 'markdown', required: true }]
      }
    ],
    edge_types: [
      {
        id: 'branches_to',
        label: 'Branches to',
        role: 'progression',
        default_style: {
          line: 'curved',
          accent: 'none'
        }
      },
      {
        id: 'progresses_to',
        label: 'Progresses to',
        role: 'progression',
        default_style: {
          line: 'curved',
          accent: 'none'
        }
      },
      {
        id: 'references',
        label: 'References',
        role: 'reference',
        default_style: {
          line: 'dotted',
          accent: 'none'
        }
      }
    ]
  },
  nodes: [
    {
      id: 'n_goal',
      type: 'central_goal',
      label: 'Reach the chosen goal',
      summary: 'Turn a broad objective into a route that can survive changing resources and real-world feedback.',
      data: {
        success_criteria: 'The user can name a working route, a live checkpoint, and the next decision triggered by real evidence.'
      },
      scores: {
        uncertainty: 0.32
      },
      evidence_refs: [],
      assumption_refs: ['as_time_window'],
      position: { x: 0, y: 0 },
      style_overrides: {}
    },
    {
      id: 'n_route_direct',
      type: 'route_choice',
      label: 'Direct execution route',
      summary: 'Move quickly through a narrow execution loop and validate with short feedback cycles.',
      data: {
        time_cost: { min_hours_per_week: 4, max_hours_per_week: 8 },
        money_cost: { min: 0, max: 250, currency: 'USD', period: 'month' },
        fit_reason: 'Works when speed matters more than breadth and the user can keep a compact weekly loop alive.'
      },
      scores: {
        time_load: 0.58,
        money_load: 0.22,
        energy_load: 0.51,
        uncertainty: 0.38
      },
      evidence_refs: ['ev_feedback_cycles'],
      assumption_refs: ['as_time_window'],
      position: { x: 0, y: 0 },
      style_overrides: {}
    },
    {
      id: 'n_route_guided',
      type: 'route_choice',
      label: 'Guided feedback route',
      summary: 'Add structured outside feedback earlier to reduce direction drift and tighten prioritization.',
      data: {
        time_cost: { min_hours_per_week: 3, max_hours_per_week: 6 },
        money_cost: { min: 80, max: 300, currency: 'USD', period: 'month' },
        fit_reason: 'Useful when confidence is low or the cost of choosing the wrong route is higher than the added expense.'
      },
      scores: {
        time_load: 0.44,
        money_load: 0.56,
        energy_load: 0.36,
        uncertainty: 0.27
      },
      evidence_refs: ['ev_external_feedback'],
      assumption_refs: ['as_budget_buffer'],
      position: { x: 0, y: 0 },
      style_overrides: {}
    },
    {
      id: 'n_pressure_capacity',
      type: 'resource_pressure',
      label: 'Shrinking weekly capacity',
      summary: 'The available deep-work window drops and the current route starts to over-assume consistency.',
      data: {
        pressure_type: 'time compression',
        impact: 'Longer execution loops become fragile and route confidence drops unless the scope is reduced.'
      },
      scores: {
        risk: 0.74,
        uncertainty: 0.22
      },
      evidence_refs: [],
      assumption_refs: [],
      position: { x: 0, y: 0 },
      status: 'at_risk',
      style_overrides: {}
    },
    {
      id: 'n_switch_reduce_scope',
      type: 'switch_option',
      label: 'Reduce scope and keep the loop alive',
      summary: 'Compress the route into a smaller weekly system instead of waiting for ideal conditions.',
      data: {
        trigger: 'Use this switch when the actual weekly time budget stays below plan for several consecutive updates.'
      },
      scores: {
        time_load: 0.34,
        uncertainty: 0.24
      },
      evidence_refs: ['ev_feedback_cycles'],
      assumption_refs: [],
      position: { x: 0, y: 0 },
      style_overrides: {}
    },
    {
      id: 'n_checkpoint_clarity',
      type: 'milestone',
      label: 'Checkpoint: route clarity',
      summary: 'The user can explain the active route, the next test, and the current pressure points in one compact brief.',
      data: {
        checkpoint: 'One live route, one clear checkpoint, one explicit reason for why this branch is still open.'
      },
      scores: {
        uncertainty: 0.16
      },
      evidence_refs: [],
      assumption_refs: [],
      position: { x: 0, y: 0 },
      style_overrides: {}
    },
    {
      id: 'n_cost_delay_feedback',
      type: 'missed_branch',
      label: 'Opportunity cost: delayed feedback',
      summary: 'Execution can continue, but weak feedback means the graph may look active while route quality silently drops.',
      data: {
        loss: 'Time is spent preserving motion without proving whether the active branch still deserves priority.'
      },
      scores: {
        risk: 0.62,
        uncertainty: 0.34
      },
      evidence_refs: ['ev_external_feedback'],
      assumption_refs: [],
      position: { x: 0, y: 0 },
      style_overrides: {}
    },
    {
      id: 'n_switch_add_review',
      type: 'switch_option',
      label: 'Add a review cadence',
      summary: 'Introduce a recurring evidence review or outside checkpoint before the route hardens into habit.',
      data: {
        trigger: 'Use this switch when progress exists but confidence is not improving, or when route rationale starts repeating itself.'
      },
      scores: {
        uncertainty: 0.21
      },
      evidence_refs: ['ev_external_feedback'],
      assumption_refs: [],
      position: { x: 0, y: 0 },
      style_overrides: {}
    },
    {
      id: 'n_checkpoint_revision',
      type: 'milestone',
      label: 'Checkpoint: revision readiness',
      summary: 'The workspace can absorb a new state update and clearly show which routes tightened, opened, or weakened.',
      data: {
        checkpoint: 'A fresh state update results in a visible graph revision instead of a stale plan.'
      },
      scores: {
        uncertainty: 0.14
      },
      evidence_refs: [],
      assumption_refs: [],
      position: { x: 0, y: 0 },
      style_overrides: {}
    }
  ],
  edges: [
    {
      id: 'e_goal_route_direct',
      source: 'n_goal',
      target: 'n_route_direct',
      type: 'branches_to',
      label: 'Faster start',
      condition: 'Prefer a compact route',
      style_overrides: {}
    },
    {
      id: 'e_goal_route_guided',
      source: 'n_goal',
      target: 'n_route_guided',
      type: 'branches_to',
      label: 'Lower drift',
      condition: 'Need more structured feedback',
      style_overrides: {}
    },
    {
      id: 'e_route_direct_pressure',
      source: 'n_route_direct',
      target: 'n_pressure_capacity',
      type: 'progresses_to',
      label: 'Can tighten',
      condition: 'Capacity drops',
      style_overrides: {}
    },
    {
      id: 'e_pressure_switch_scope',
      source: 'n_pressure_capacity',
      target: 'n_switch_reduce_scope',
      type: 'progresses_to',
      label: 'Recover the loop',
      condition: 'Scope is still adjustable',
      style_overrides: {}
    },
    {
      id: 'e_switch_scope_checkpoint',
      source: 'n_switch_reduce_scope',
      target: 'n_checkpoint_clarity',
      type: 'progresses_to',
      label: 'Stabilize',
      condition: 'The reduced route is sustainable',
      style_overrides: {}
    },
    {
      id: 'e_route_guided_cost',
      source: 'n_route_guided',
      target: 'n_cost_delay_feedback',
      type: 'progresses_to',
      label: 'Avoid drift',
      condition: 'Feedback is delayed or skipped',
      style_overrides: {}
    },
    {
      id: 'e_cost_switch_review',
      source: 'n_cost_delay_feedback',
      target: 'n_switch_add_review',
      type: 'progresses_to',
      label: 'Correct course',
      condition: 'Confidence remains soft',
      style_overrides: {}
    },
    {
      id: 'e_switch_review_checkpoint',
      source: 'n_switch_add_review',
      target: 'n_checkpoint_revision',
      type: 'progresses_to',
      label: 'Revision ready',
      condition: 'A review cadence is active',
      style_overrides: {}
    },
    {
      id: 'e_reference_feedback',
      source: 'n_route_direct',
      target: 'n_switch_add_review',
      type: 'references',
      label: 'Evidence link',
      style_overrides: {}
    }
  ],
  evidence: [
    {
      id: 'ev_feedback_cycles',
      source_id: 'src_manual_001',
      title: 'Short feedback loops protect route durability',
      reliability: 'medium',
      quote_or_summary:
        'When available time is inconsistent, shorter loops with visible checkpoints stay alive longer than broad plans that depend on perfect weeks.',
      url: null
    },
    {
      id: 'ev_external_feedback',
      source_id: 'src_manual_002',
      title: 'Outside review reduces silent route drift',
      reliability: 'medium',
      quote_or_summary:
        'Weak feedback can keep a route moving without proving it is the right one. Light review cadence improves route confidence before large commitments form.',
      url: null
    }
  ],
  assumptions: [
    {
      id: 'as_time_window',
      text: 'A recurring weekly work window still exists, even if it is smaller than planned.',
      risk_if_false: 'If no repeatable time window exists, the route should collapse into a holding pattern rather than stay in active execution.'
    },
    {
      id: 'as_budget_buffer',
      text: 'The user can spend a modest amount when structured feedback clearly reduces route uncertainty.',
      risk_if_false: 'If no budget buffer exists, guided routes may need to be replaced with lighter review mechanisms.'
    }
  ],
  warnings: [
    'This graph is a scenario map, not a prediction.',
    'Route viability should change when the user updates time, money, confidence, or evidence.'
  ]
};
