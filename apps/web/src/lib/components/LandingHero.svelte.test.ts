import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import LandingHero from './LandingHero.svelte';

describe('LandingHero', () => {
  it('renders the project headline', () => {
    render(LandingHero);

    expect(
      screen.getByRole('heading', {
        name: '목표를 말하면, 지금의 조건에서 갈라지는 경로와 그 대가를 함께 펼칩니다'
      })
    ).toBeTruthy();
  });
});
