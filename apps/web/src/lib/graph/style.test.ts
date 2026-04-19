import { describe, expect, it } from 'vitest';

import { resolveNodeStyle } from './style';

describe('resolveNodeStyle', () => {
  it('falls back to slate for unknown tones', () => {
    const result = resolveNodeStyle({
      id: 'mystery',
      label: 'Mystery',
      description: 'Unknown node type',
      default_style: {
        tone: 'cosmic-purple',
        shape: 'weird-shape',
        accent: 'none'
      },
      fields: []
    });

    expect(result.tone).toBe('slate');
    expect(result.shape).toBe('rounded_card');
  });
});
