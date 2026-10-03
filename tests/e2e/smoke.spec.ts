import { test, expect } from '@playwright/test';

test('smoke: the built site shows the title and the maps from the fixtures', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Testikampanja' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Maps' }).getByRole('listitem')).toHaveText([
    'Pääkartta (200 x 100)',
    'Second Map (120 x 80)',
  ]);
});
