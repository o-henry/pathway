import { expect, test } from '@playwright/test';

test('landing page renders project messaging', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: '선택의 가지를 그려주는 개인용 시나리오 맵' })
  ).toBeVisible();
  await expect(page.getByText('Local-first Life Map')).toBeVisible();
});
