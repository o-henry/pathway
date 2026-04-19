import { expect, test } from '@playwright/test';

const generatedBundle = {
  schema_version: '1.0.0',
  bundle_id: 'bundle-generated-1',
  map: {
    title: 'Grounded Japanese Travel Pathway',
    goal_id: 'goal-1',
    summary: 'Initial grounded pathway for travel conversation.'
  },
  ontology: {
    node_types: [
      {
        id: 'goal',
        label: 'Goal',
        description: 'Goal node',
        fields: []
      },
      {
        id: 'route_choice',
        label: 'Route Choice',
        description: 'Choice node',
        fields: []
      }
    ],
    edge_types: [
      {
        id: 'progresses_to',
        label: 'Progresses To',
        role: 'progression'
      }
    ]
  },
  nodes: [
    {
      id: 'node-goal',
      type: 'goal',
      label: '일본어 여행 회화',
      summary: '주문, 길 묻기, 간단한 대화를 목표로 한다.',
      data: {},
      evidence_refs: [],
      assumption_refs: [],
      scores: {},
      style_overrides: {}
    },
    {
      id: 'node-route',
      type: 'route_choice',
      label: '저비용 독학 + 짧은 speaking',
      summary: '앱 복습과 주말 speaking drill을 섞는다.',
      data: {
        fit_reason: '예산을 낮게 유지하면서 출력 루프를 추가한다.'
      },
      evidence_refs: ['evidence-1'],
      assumption_refs: ['assumption-1'],
      scores: {
        risk: 0.42
      },
      style_overrides: {}
    }
  ],
  edges: [
    {
      id: 'edge-1',
      type: 'progresses_to',
      source: 'node-goal',
      target: 'node-route',
      label: 'start'
    }
  ],
  evidence: [
    {
      id: 'evidence-1',
      source_id: 'source-1',
      title: 'Saved note',
      quote_or_summary: 'Speaking drill early lowers boredom.',
      url: null,
      reliability: 'manual_note'
    }
  ],
  assumptions: [
    {
      id: 'assumption-1',
      text: 'The user can sustain 5 hours a week.',
      risk_if_false: 'The map needs a lighter loop.'
    }
  ],
  warnings: ['This graph is a scenario map, not a prediction.']
};

const acceptedBundle = {
  ...generatedBundle,
  bundle_id: 'bundle-accepted-1',
  map: {
    ...generatedBundle.map,
    title: 'Revised Japanese Travel Pathway',
    summary: 'Accepted revision adds an explicit weekend speaking loop.'
  },
  nodes: generatedBundle.nodes.map((node) =>
    node.id === 'node-route'
      ? {
          ...node,
          summary: '주말 speaking drill을 명시적으로 붙여 지루함 리스크를 낮춘다.',
          status: 'at_risk',
          data: {
            fit_reason: '체크인에 나온 boredom 패턴을 반영해 출력 루프를 강화한다.'
          }
        }
      : node
  )
};

test('user can generate a map, create a check-in, and accept a revision', async ({ page }) => {
  const checkins: Array<Record<string, unknown>> = [];

  await page.route('http://127.0.0.1:8000/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const bodyText = request.postData() ?? '';
    const jsonBody = bodyText ? JSON.parse(bodyText) : null;

    if (request.method() === 'PUT' && pathname === '/profiles/default') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'default',
          created_at: '2026-04-20T00:00:00Z',
          updated_at: '2026-04-20T00:00:00Z',
          ...jsonBody
        })
      });
      return;
    }

    if (request.method() === 'POST' && pathname === '/goals') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'goal-1',
          created_at: '2026-04-20T00:00:00Z',
          updated_at: '2026-04-20T00:00:00Z',
          ...jsonBody
        })
      });
      return;
    }

    if (request.method() === 'POST' && pathname === '/goals/goal-1/maps/generate') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'map-1',
          title: 'Grounded Japanese Travel Pathway',
          goal_id: 'goal-1',
          graph_bundle: generatedBundle,
          created_at: '2026-04-20T00:00:00Z',
          updated_at: '2026-04-20T00:00:00Z'
        })
      });
      return;
    }

    if (request.method() === 'GET' && pathname === '/goals/goal-1/checkins') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(checkins)
      });
      return;
    }

    if (request.method() === 'POST' && pathname === '/goals/goal-1/checkins') {
      const checkin = {
        id: 'checkin-1',
        goal_id: 'goal-1',
        map_id: 'map-1',
        checkin_date: '2026-04-20',
        actual_time_spent: jsonBody.actual_time_spent,
        actual_money_spent: jsonBody.actual_money_spent,
        mood: jsonBody.mood,
        progress_summary: jsonBody.progress_summary,
        blockers: jsonBody.blockers,
        next_adjustment: jsonBody.next_adjustment,
        created_at: '2026-04-20T00:00:00Z'
      };
      checkins.unshift(checkin);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(checkin)
      });
      return;
    }

    if (request.method() === 'POST' && pathname === '/maps/map-1/revision-proposals') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'proposal-1',
          goal_id: 'goal-1',
          source_map_id: 'map-1',
          checkin_id: 'checkin-1',
          status: 'pending',
          rationale: 'Weekday boredom appeared, so the map adds a short weekend speaking loop.',
          diff: {
            summary: ['1 node updated', '1 status flag changed'],
            node_changes: [
              {
                node_id: 'node-route',
                change_type: 'updated',
                label: '저비용 독학 + 짧은 speaking',
                reason: 'The route now adds an explicit speaking loop.',
                previous_status: null,
                next_status: 'at_risk',
                fields_changed: ['summary', 'fit_reason']
              }
            ],
            edge_changes: [],
            warning_changes: []
          },
          proposed_graph_bundle: acceptedBundle,
          accepted_map_id: null,
          created_at: '2026-04-20T00:00:00Z',
          resolved_at: null
        })
      });
      return;
    }

    if (request.method() === 'POST' && pathname === '/revision-proposals/proposal-1/accept') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'map-2',
          title: 'Revised Japanese Travel Pathway',
          goal_id: 'goal-1',
          graph_bundle: acceptedBundle,
          created_at: '2026-04-20T00:10:00Z',
          updated_at: '2026-04-20T00:10:00Z'
        })
      });
      return;
    }

    await route.abort();
  });

  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: '목표를 말하면, 지금의 조건에서 갈라지는 경로와 그 대가를 함께 펼칩니다' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Generate initial pathway' }).click();

  await expect(
    page.getByRole('heading', { level: 2, name: 'Grounded Japanese Travel Pathway' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Node index' })).toBeVisible();
  await expect(page.getByRole('button', { name: /저비용 독학 \+ 짧은 speaking/i })).toBeVisible();

  await page.getByRole('button', { name: 'Generate revision proposal' }).click();

  await expect(page.getByText('현실 기록을 저장했고, 현재 조건에 맞춘 Pathway revision proposal을 만들었습니다.')).toBeVisible();
  await expect(page.getByText('Weekday boredom appeared, so the map adds a short weekend speaking loop.')).toBeVisible();

  await page.getByRole('button', { name: 'Accept new Pathway' }).click();

  await expect(page.getByText('Revision proposal을 수락했고 새 Pathway snapshot을 만들었습니다.')).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Revised Japanese Travel Pathway' })
  ).toBeVisible();
  await expect(
    page.getByText('주말 speaking drill을 명시적으로 붙여 지루함 리스크를 낮춘다.')
  ).toBeVisible();
});
