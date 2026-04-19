import type { GraphBundle } from '$lib/graph/types';

export const exampleGraphBundle: GraphBundle = {
  schema_version: '1.0.0',
  bundle_id: 'pathway_demo_japanese_002',
  map: {
    title: '일본어 여행 회화를 위한 Pathway',
    goal_id: 'goal_demo_001',
    summary:
      '주 5시간, 월 10만원, 평일 피로가 있는 조건에서 어느 루트가 버티고 어디서 비용이 터지는지 보여주는 분기 지도'
  },
  ontology: {
    node_types: [
      {
        id: 'central_goal',
        label: '중심 목표',
        description: '사용자가 이루고자 하는 최종 상태',
        default_style: {
          tone: 'sky',
          shape: 'circle',
          accent: 'sketch_border'
        },
        fields: [
          {
            key: 'success_criteria',
            label: '성공 기준',
            value_type: 'markdown',
            required: true
          }
        ]
      },
      {
        id: 'route_choice',
        label: '루트 선택',
        description: '목표에 접근하는 큰 전략 줄기',
        default_style: {
          tone: 'lavender',
          shape: 'rounded_card',
          accent: 'sketch_border'
        },
        fields: [
          {
            key: 'time_cost',
            label: '시간 비용',
            value_type: 'duration_range',
            required: false
          },
          {
            key: 'money_cost',
            label: '돈 비용',
            value_type: 'money_range',
            required: false
          },
          {
            key: 'fit_reason',
            label: '왜 이 루트인가',
            value_type: 'markdown',
            required: false
          }
        ]
      },
      {
        id: 'resource_pressure',
        label: '리소스 압박',
        description: '현재 상태가 분기를 닫게 만드는 압박 요인',
        default_style: {
          tone: 'rose',
          shape: 'pill',
          accent: 'pin'
        },
        fields: [
          {
            key: 'pressure_type',
            label: '압박 종류',
            value_type: 'string',
            required: true
          },
          {
            key: 'impact',
            label: '영향',
            value_type: 'markdown',
            required: true
          }
        ]
      },
      {
        id: 'switch_option',
        label: '전환 지점',
        description: '현재 조건을 반영해 루트를 바꾸는 선택지',
        default_style: {
          tone: 'mint',
          shape: 'rounded_card',
          accent: 'sketch_border'
        },
        fields: [
          {
            key: 'trigger',
            label: '전환 조건',
            value_type: 'markdown',
            required: true
          }
        ]
      },
      {
        id: 'missed_branch',
        label: '놓치는 것',
        description: '선택을 늦게 하거나 생략할 때 발생하는 손실',
        default_style: {
          tone: 'sand',
          shape: 'rounded_card',
          accent: 'sketch_border'
        },
        fields: [
          {
            key: 'loss',
            label: '손실',
            value_type: 'markdown',
            required: true
          }
        ]
      },
      {
        id: 'milestone',
        label: '도달 지점',
        description: '현재 조건에서 현실적으로 확인 가능한 중간 도달점',
        default_style: {
          tone: 'yellow',
          shape: 'rounded_card',
          accent: 'sketch_border'
        },
        fields: [
          {
            key: 'checkpoint',
            label: '체크포인트',
            value_type: 'markdown',
            required: true
          }
        ]
      }
    ],
    edge_types: [
      {
        id: 'branches_to',
        label: '분기',
        role: 'progression',
        default_style: {
          line: 'curved',
          accent: 'sketch_arrow'
        }
      },
      {
        id: 'progresses_to',
        label: '진행',
        role: 'progression',
        default_style: {
          line: 'curved',
          accent: 'sketch_arrow'
        }
      },
      {
        id: 'references',
        label: '근거',
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
      label: '일본어 여행 회화',
      summary: '6개월 뒤 일본 여행에서 길 묻기, 주문, 간단한 잡담을 무리 없이 주고받는 상태를 목표로 한다.',
      data: {
        success_criteria: '여행 상황에서 5분 안팎의 기본 회화를 끊기지 않고 이어갈 수 있다.'
      },
      scores: {
        uncertainty: 0.38
      },
      evidence_refs: [],
      assumption_refs: ['as_time'],
      position: {
        x: 0,
        y: 0
      },
      style_overrides: {}
    },
    {
      id: 'n_route_self',
      type: 'route_choice',
      label: '저비용 독학 루프',
      summary: '앱, 문장 암기, 짧은 speaking drill을 묶어 비용을 낮추되 스스로 유지해야 하는 루트다.',
      data: {
        time_cost: {
          min_hours_per_week: 4,
          max_hours_per_week: 6
        },
        money_cost: {
          min: 10000,
          max: 50000,
          currency: 'KRW',
          period: 'month'
        },
        fit_reason: '예산을 거의 늘리지 않고도 시작할 수 있지만, 꾸준함이 약하면 흔들리기 쉽다.'
      },
      scores: {
        time_load: 0.58,
        money_load: 0.2,
        energy_load: 0.52,
        uncertainty: 0.44
      },
      evidence_refs: ['ev_demo_001'],
      assumption_refs: ['as_time'],
      position: {
        x: -330,
        y: 160
      },
      style_overrides: {}
    },
    {
      id: 'n_route_tutor',
      type: 'route_choice',
      label: '회화 튜터 병행',
      summary: '주 1회 피드백을 넣어 말문이 트이기 쉽지만 돈이 가장 먼저 올라가는 루트다.',
      data: {
        time_cost: {
          min_hours_per_week: 3,
          max_hours_per_week: 5
        },
        money_cost: {
          min: 120000,
          max: 240000,
          currency: 'KRW',
          period: 'month'
        },
        fit_reason: '평일 집중력이 낮아도 피드백이 강제로 들어와서 출력 루프를 지키기 쉽다.'
      },
      scores: {
        time_load: 0.42,
        money_load: 0.78,
        energy_load: 0.36,
        uncertainty: 0.32
      },
      evidence_refs: ['ev_demo_002'],
      assumption_refs: ['as_budget'],
      position: {
        x: 320,
        y: 160
      },
      style_overrides: {}
    },
    {
      id: 'n_route_immersion',
      type: 'route_choice',
      label: '콘텐츠 침수 루프',
      summary: '애니, 유튜브, 짧은 쉐도잉으로 흥미는 살리지만 출력 루프를 늦게 붙이면 착시가 생긴다.',
      data: {
        time_cost: {
          min_hours_per_week: 4,
          max_hours_per_week: 7
        },
        money_cost: {
          min: 0,
          max: 30000,
          currency: 'KRW',
          period: 'month'
        },
        fit_reason: '흥미 유지에는 강하지만, 이해한 것과 말할 수 있는 것 사이의 간극이 남기 쉽다.'
      },
      scores: {
        time_load: 0.56,
        money_load: 0.12,
        energy_load: 0.3,
        uncertainty: 0.49
      },
      evidence_refs: ['ev_demo_001'],
      assumption_refs: [],
      position: {
        x: 0,
        y: 190
      },
      style_overrides: {}
    },
    {
      id: 'n_route_sprint',
      type: 'route_choice',
      label: '출국 직전 단기 부스트',
      summary: '당장 말이 나와야 할 때만 짧게 집중해서 압축하는 루트지만, 피로와 반동 비용이 같이 올라간다.',
      data: {
        time_cost: {
          min_hours_per_week: 6,
          max_hours_per_week: 9
        },
        money_cost: {
          min: 80000,
          max: 180000,
          currency: 'KRW',
          period: 'month'
        },
        fit_reason: '시간은 적지만 이벤트가 명확하게 다가와 있을 때 밀어붙이기 좋은 방식이다.'
      },
      scores: {
        time_load: 0.72,
        money_load: 0.54,
        energy_load: 0.7,
        uncertainty: 0.37
      },
      evidence_refs: ['ev_demo_002'],
      assumption_refs: ['as_budget'],
      position: {
        x: 240,
        y: 210
      },
      style_overrides: {}
    },
    {
      id: 'n_pressure_time',
      type: 'resource_pressure',
      label: '평일 피로 압박',
      summary: '퇴근 후 에너지가 낮아 긴 루틴을 유지하기 어려워지고, 경로 일부가 자동으로 닫히기 시작한다.',
      data: {
        pressure_type: 'time + energy',
        impact: '하루 40분 이상 루틴은 무너지기 쉽고, 출력 연습이 가장 먼저 밀린다.'
      },
      scores: {
        risk: 0.74,
        uncertainty: 0.36
      },
      evidence_refs: ['ev_demo_001'],
      assumption_refs: [],
      position: {
        x: -480,
        y: 330
      },
      style_overrides: {}
    },
    {
      id: 'n_switch_micro',
      type: 'switch_option',
      label: '10분 micro loop로 축소',
      summary: '루틴을 끊기지 않게 유지하기 위해 평일은 축소하고 주말에 출력 비중을 다시 얹는 전환점이다.',
      data: {
        trigger: '3주 이상 계획 대비 실제 시간이 절반 이하로 떨어질 때'
      },
      scores: {
        money_load: 0.16,
        energy_load: 0.28,
        uncertainty: 0.28
      },
      evidence_refs: ['ev_demo_001'],
      assumption_refs: [],
      position: {
        x: -300,
        y: 500
      },
      style_overrides: {}
    },
    {
      id: 'n_missed_output',
      type: 'missed_branch',
      label: '출력 루프를 늦게 붙였을 때 잃는 것',
      summary: '이해는 느는데 말문은 안 트여서, 실제 여행 회화 전환 시점이 뒤로 밀린다.',
      data: {
        loss: '같은 6개월을 써도 “이해는 되는데 말은 안 나오는” 상태가 길어진다.'
      },
      scores: {
        risk: 0.58,
        uncertainty: 0.41
      },
      evidence_refs: ['ev_demo_002'],
      assumption_refs: [],
      position: {
        x: 210,
        y: 500
      },
      style_overrides: {}
    },
    {
      id: 'n_switch_burst',
      type: 'switch_option',
      label: '출국 8주 전 단기 부스트',
      summary: '출국이 가까워졌을 때만 짧게 돈을 더 써서 회화 교정을 넣는 절충형 루트다.',
      data: {
        trigger: '예산은 빠듯하지만 출국 일정이 확정되어 말하기 불안을 줄여야 할 때'
      },
      scores: {
        money_load: 0.48,
        energy_load: 0.34,
        uncertainty: 0.31
      },
      evidence_refs: ['ev_demo_002'],
      assumption_refs: ['as_budget'],
      position: {
        x: 480,
        y: 340
      },
      style_overrides: {}
    },
    {
      id: 'n_milestone',
      type: 'milestone',
      label: '8주차 여행 문장 묶음 확보',
      summary: '핵심 문장을 먼저 묶어 두면 이후 분기에서 회화 자신감이 크게 무너지지 않는다.',
      data: {
        checkpoint: '자기소개, 주문, 길 묻기, 선호 말하기, 일정 확인 문장을 입 밖으로 낼 수 있다.'
      },
      scores: {
        uncertainty: 0.24
      },
      evidence_refs: ['ev_demo_001', 'ev_demo_002'],
      assumption_refs: [],
      position: {
        x: 0,
        y: 700
      },
      style_overrides: {}
    },
    {
      id: 'n_loss_burnout',
      type: 'missed_branch',
      label: '반동 피로로 잃는 것',
      summary: '짧게 몰아붙인 뒤 회복 루틴이 없으면 출국 직후 자신감이 다시 급격히 내려갈 수 있다.',
      data: {
        loss: '급하게 만든 회화 감각이 유지되지 않아, 다음 목표로 연결되는 장기 루프를 다시 처음부터 세워야 한다.'
      },
      scores: {
        risk: 0.62,
        uncertainty: 0.34
      },
      evidence_refs: ['ev_demo_002'],
      assumption_refs: [],
      position: {
        x: 480,
        y: 620
      },
      style_overrides: {}
    }
  ],
  edges: [
    {
      id: 'e_goal_self',
      type: 'branches_to',
      source: 'n_goal',
      target: 'n_route_self',
      label: '비용 최소화'
    },
    {
      id: 'e_goal_tutor',
      type: 'branches_to',
      source: 'n_goal',
      target: 'n_route_tutor',
      label: '피드백 우선'
    },
    {
      id: 'e_goal_immersion',
      type: 'branches_to',
      source: 'n_goal',
      target: 'n_route_immersion',
      label: '흥미 유지'
    },
    {
      id: 'e_goal_sprint',
      type: 'branches_to',
      source: 'n_goal',
      target: 'n_route_sprint',
      label: '단기 압축'
    },
    {
      id: 'e_self_pressure',
      type: 'progresses_to',
      source: 'n_route_self',
      target: 'n_pressure_time',
      condition: '평일 집중도 하락'
    },
    {
      id: 'e_pressure_switch',
      type: 'progresses_to',
      source: 'n_pressure_time',
      target: 'n_switch_micro',
      condition: '실제 투입 시간이 무너질 때'
    },
    {
      id: 'e_switch_milestone',
      type: 'progresses_to',
      source: 'n_switch_micro',
      target: 'n_milestone',
      label: '루틴 유지'
    },
    {
      id: 'e_immersion_loss',
      type: 'progresses_to',
      source: 'n_route_immersion',
      target: 'n_missed_output',
      condition: '출력 연습을 미룰 때'
    },
    {
      id: 'e_tutor_burst',
      type: 'progresses_to',
      source: 'n_route_tutor',
      target: 'n_switch_burst',
      label: '일정 압축'
    },
    {
      id: 'e_burst_milestone',
      type: 'progresses_to',
      source: 'n_switch_burst',
      target: 'n_milestone',
      label: '말하기 교정'
    },
    {
      id: 'e_sprint_loss',
      type: 'progresses_to',
      source: 'n_route_sprint',
      target: 'n_loss_burnout',
      condition: '회복 루틴 없이 몰아붙일 때'
    }
  ],
  evidence: [
    {
      id: 'ev_demo_001',
      source_id: 'src_manual_001',
      title: '직장인 일본어 회화 노트',
      quote_or_summary:
        '주 5시간 전후에서는 문법만 밀기보다 짧은 speaking drill을 일찍 넣을 때 이탈이 덜했다.',
      url: null,
      reliability: 'manual_note'
    },
    {
      id: 'ev_demo_002',
      source_id: 'src_manual_002',
      title: '출국 전 단기 회화 부스트 메모',
      quote_or_summary:
        '출국이 가까워질수록 짧은 기간의 피드백 루프가 회화 자신감을 올리는 데 효율적이었다.',
      url: null,
      reliability: 'manual_note'
    }
  ],
  assumptions: [
    {
      id: 'as_time',
      text: '주당 최소 4시간은 확보할 수 있다.',
      risk_if_false: '루틴이 너무 얇아져 milestone 도달 시점이 늦어질 수 있다.'
    },
    {
      id: 'as_budget',
      text: '필요 시 출국 직전 한시적으로 예산을 늘릴 수 있다.',
      risk_if_false: '피드백 기반 분기 대신 독학 루프를 더 오래 유지해야 한다.'
    }
  ],
  warnings: [
    '이 그래프는 예측이 아니라 시나리오 지도입니다.',
    '현재 상태가 바뀌면 열린 분기와 닫힌 분기가 함께 다시 계산되어야 합니다.'
  ]
};
