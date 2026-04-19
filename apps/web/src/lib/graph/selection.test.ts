import { describe, expect, it } from 'vitest';

import { exampleGraphBundle } from '$lib/fixtures/exampleGraphBundle';

import { getProgressionPathNodeIds } from './selection';

describe('getProgressionPathNodeIds', () => {
  it('returns the ancestor path for a selected node', () => {
    const ids = getProgressionPathNodeIds(exampleGraphBundle, 'n_switch_micro');

    expect(ids.has('n_goal')).toBe(true);
    expect(ids.has('n_route_self')).toBe(true);
    expect(ids.has('n_pressure_time')).toBe(true);
    expect(ids.has('n_switch_micro')).toBe(true);
  });
});
