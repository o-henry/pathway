import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import LandingHero from './LandingHero.svelte';

describe('LandingHero', () => {
  it('renders the project headline', () => {
    render(LandingHero);

    expect(
      screen.getByRole('heading', {
        name: '선택의 가지를 그려주는 개인용 시나리오 맵'
      })
    ).toBeTruthy();
  });
});
