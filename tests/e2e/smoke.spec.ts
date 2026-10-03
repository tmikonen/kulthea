import { test, expect } from '@playwright/test';

test('smoke: the built site shows the heading', async ({ page }) => {
  await page.goto('./');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Kulthea Campaign Chronicles' }),
  ).toBeVisible();
});
