import { describe, expect, it } from 'vitest';

import {
  resolvePreferredPathwayGoalId,
  sortPathwayMapsNewestFirst,
} from './usePathwayGoalWorkspaceController';
import type { GoalRecord, LifeMap } from '../lib/types';

function goal(id: string): GoalRecord {
  return {
    category: 'general',
    created_at: '2026-01-01T00:00:00Z',
    description: id,
    id,
    success_criteria: 'done',
    title: id,
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function map(id: string, updatedAt: string | null, createdAt: string): LifeMap {
  return {
    created_at: createdAt,
    goal_id: 'goal-1',
    graph_bundle: {
      assumptions: [],
      edges: [],
      evidence: [],
      nodes: [],
      ontology: { edge_types: [], node_types: [] },
      version: '1',
      warnings: [],
    },
    id,
    title: id,
    updated_at: updatedAt,
  };
}

describe('resolvePreferredPathwayGoalId', () => {
  it('keeps the active goal when preserving selection and it still exists', () => {
    expect(
      resolvePreferredPathwayGoalId({
        activeGoalId: 'goal-2',
        goals: [goal('goal-1'), goal('goal-2')],
        pathwayNewGoalMode: false,
        preserveSelection: true,
      }),
    ).toBe('goal-2');
  });

  it('returns null while preserving an active new-goal composer', () => {
    expect(
      resolvePreferredPathwayGoalId({
        activeGoalId: 'goal-2',
        goals: [goal('goal-1'), goal('goal-2')],
        pathwayNewGoalMode: true,
        preserveSelection: true,
      }),
    ).toBeNull();
  });

  it('falls back to the first goal when active selection is missing', () => {
    expect(
      resolvePreferredPathwayGoalId({
        activeGoalId: 'deleted-goal',
        goals: [goal('goal-1'), goal('goal-2')],
        pathwayNewGoalMode: false,
        preserveSelection: true,
      }),
    ).toBe('goal-1');
  });
});

describe('sortPathwayMapsNewestFirst', () => {
  it('sorts maps by updated_at before created_at', () => {
    const sorted = sortPathwayMapsNewestFirst([
      map('old', null, '2026-01-01T00:00:00Z'),
      map('newest', '2026-03-01T00:00:00Z', '2026-01-02T00:00:00Z'),
      map('middle', null, '2026-02-01T00:00:00Z'),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['newest', 'middle', 'old']);
  });
});
