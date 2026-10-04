import { test, expect } from '@playwright/test';

const titles = (page: import('@playwright/test').Page) =>
  page.getByRole('navigation', { name: /Tapahtumat|Events/ }).getByRole('listitem').allTextContents();

test.describe('events list (B-8)', () => {
  test('FR-2 the list shows the fixture events in date order', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('navigation', { name: 'Tapahtumat' })).toBeVisible();
    expect(await titles(page)).toEqual([
      'Ensimmäinen', 'Toinen', 'Yhdeksäs', 'Toisella kartalla', 'Eroon', 'Yksin', 'Hyppy',
    ]);
  });

  test('FR-9 the titles follow the language, falling back to the default', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page.getByRole('navigation', { name: 'Events' })).toBeVisible();
    expect(await titles(page)).toEqual([
      'First', 'Toinen', 'Yhdeksäs', 'On the second map', 'Split', 'Yksin', 'Hyppy',
    ]);
  });

  test('FR-1 the map is still fitted to its area with the list under it', async ({ page }) => {
    await page.goto('./');
    const image = page.locator('img.leaflet-image-layer');
    await expect(image).toBeVisible();
    await expect.poll(async () => {
      const area = (await page.locator('.leaflet-container').boundingBox())!;
      const list = (await page.getByRole('navigation', { name: 'Tapahtumat' }).boundingBox())!;
      return area.y + area.height <= list.y + 1;
    }).toBe(true);
  });
});
