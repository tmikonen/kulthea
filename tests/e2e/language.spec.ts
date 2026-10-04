import { test, expect } from '@playwright/test';

const title = (name: string) => ({ level: 1 as const, name });

test.describe('interface languages (B-6)', () => {
  test('FR-9 the switch changes the texts and keeps the map, without reloading', async ({ page }) => {
    await page.goto('./#/?map=second-map');
    await expect(page.getByRole('heading', title('Testikampanja'))).toBeVisible();
    await expect(page.getByRole('group', { name: 'Kartta' })).toBeVisible();
    await page.evaluate(() => { (window as unknown as { marker: number }).marker = 1; });

    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('heading', title('Test Campaign'))).toBeVisible();
    await expect(page.getByRole('group', { name: 'Map' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Main Map' })).toBeVisible();
    await expect(page).toHaveURL(/map=second-map/);
    await expect(page).toHaveURL(/lang=en/);
    await expect(page.locator('img.leaflet-image-layer')).toHaveAttribute('src', /second-map/);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);

    await page.getByRole('button', { name: 'FI', exact: true }).click();
    await expect(page.getByRole('heading', title('Testikampanja'))).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pääkartta' })).toBeVisible();
  });

  test('FR-9 the lang parameter opens the page in that language, and an unknown one in Finnish', async ({ page }) => {
    await page.goto('./#/?lang=en');
    await expect(page.getByRole('heading', title('Test Campaign'))).toBeVisible();
    await page.goto('./#/?lang=xx');
    await expect(page.getByRole('heading', title('Testikampanja'))).toBeVisible();
    await page.goto('./');
    await expect(page.getByRole('heading', title('Testikampanja'))).toBeVisible();
  });

  test('FR-9 the page lang attribute follows the language', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.goto('./#/?lang=fi');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fi');
  });

  test('FR-9 a name with no English text falls back to the default language', async ({ page }) => {
    await page.goto('./#/?lang=en');
    await expect(page.getByRole('button', { name: 'Second Map' })).toBeVisible();
  });
});
