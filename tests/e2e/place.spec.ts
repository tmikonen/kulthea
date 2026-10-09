import { readdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { settled } from './helpers';

// The position helper runs on the dev server (the `place` project), on the ordinary fixtures.

const open = async (page: Page) => {
  await page.goto('place.html');
  await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
  await settled(page.locator('img.leaflet-image-layer'));
};

/** Clicks at a fraction of the image, from its top-left corner. */
const clickAt = async (page: Page, fx: number, fy: number) => {
  const box = (await page.locator('img.leaflet-image-layer').boundingBox())!;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
};

const readPosition = async (page: Page): Promise<[number, number]> => {
  const text = (await page.getByTestId('position').textContent())!;
  const [x, y] = JSON.parse(text) as [number, number];
  return [x, y];
};

test.describe('position helper (B-40)', () => {
  test('FR-1 the page shows the main map with the places that have a position as labelled dots', async ({ page }) => {
    await open(page);
    // Main map: both-places (fi name, the default language) and main-only.
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(2);
    await expect(page.locator('.leaflet-tooltip', { hasText: 'Molemmat paikat' })).toBeVisible();
    await expect(page.locator('.leaflet-tooltip', { hasText: 'Main Only' })).toBeVisible();
  });

  test('FR-1 a dot is where its position says it is on the image', async ({ page }) => {
    await open(page);
    const image = (await page.locator('img.leaflet-image-layer').boundingBox())!;
    const dot = (await page.locator('path.known-place').first().boundingBox())!;
    // both-places is [25, 75] on the main map.
    expect(dot.x + dot.width / 2).toBeCloseTo(image.x + image.width * 0.25, -0.5);
    expect(dot.y + dot.height / 2).toBeCloseTo(image.y + image.height * 0.75, -0.5);
  });

  test('FR-1 a click shows the position as percent with one decimal, from the top-left', async ({ page }) => {
    await open(page);
    await clickAt(page, 0.25, 0.6);
    const [x, y] = await readPosition(page);
    expect(Math.abs(x - 25)).toBeLessThan(0.3);
    expect(Math.abs(y - 60)).toBeLessThan(0.3);
    await expect(page.getByTestId('position')).toHaveText(/^\[\d+\.\d, \d+\.\d\]$/);
  });

  test('FR-1 a click on a dot gives its position, so the page agrees with the site', async ({ page }) => {
    await open(page);
    const dot = (await page.locator('path.known-place').nth(1).boundingBox())!;
    await page.mouse.click(dot.x + dot.width / 2, dot.y + dot.height / 2);
    const [x, y] = await readPosition(page);
    // main-only is [80, 20].
    expect(Math.abs(x - 80)).toBeLessThan(0.4);
    expect(Math.abs(y - 20)).toBeLessThan(0.4);
  });

  test('FR-1 the copy button puts the position on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await clickAt(page, 0.5, 0.5);
    const shown = await page.getByTestId('position').textContent();
    await page.getByRole('button', { name: 'Copy position' }).click();
    await expect(page.getByRole('status')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
  });

  test('FR-1 the list shows the places that have no position on the chosen map', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: /Vain toinen/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Molemmat paikat/ })).toHaveCount(0);
    await page.getByRole('combobox').selectOption('second-map');
    await expect(page.getByRole('button', { name: /Main Only/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Vain toinen/ })).toHaveCount(0);
  });

  test('FR-1 with a place chosen from the list, a click gives a snippet for its positions', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('snippet')).toHaveCount(0);
    await page.getByRole('button', { name: /Vain toinen/ }).click();
    await clickAt(page, 0.5, 0.5);
    await expect(page.getByTestId('snippet')).toHaveText(/^"second-only": \{ "main-map": \[\d+\.\d, \d+\.\d\] \}$/);
  });

  test('FR-1 changing the map clears the chosen place and the position', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Vain toinen/ }).click();
    await clickAt(page, 0.5, 0.5);
    await page.getByRole('combobox').selectOption('second-map');
    await expect(page.getByTestId('position')).toHaveCount(0);
    await expect(page.getByTestId('snippet')).toHaveCount(0);
  });

  test('FR-1 a click outside the image is ignored', async ({ page }) => {
    await open(page);
    const image = (await page.locator('img.leaflet-image-layer').boundingBox())!;
    const area = (await page.locator('.leaflet-container').boundingBox())!;
    // The 3000 x 1500 map is wider than it is tall, so there is room above or below it in a tall window only;
    // make sure of it by clicking in the part of the area that the image does not cover.
    const free = image.y - area.y > 10
      ? { x: image.x + image.width / 2, y: area.y + (image.y - area.y) / 2 }
      : image.x - area.x > 10
        ? { x: area.x + (image.x - area.x) / 2, y: image.y + image.height / 2 }
        : null;
    test.skip(free === null, 'the image fills the area in both directions');
    await page.mouse.click(free!.x, free!.y);
    await expect(page.getByTestId('position')).toHaveCount(0);
  });
});

test.describe('position helper, built site (B-40)', () => {
  test('FR-1 the built site has no place.html', async () => {
    for (const dir of ['dist-e2e', 'dist-e2e-focus', 'dist-e2e-routes']) {
      const files = readdirSync(dir, { recursive: true }).map(String);
      expect(files.filter((file) => file.endsWith('place.html') || file.includes('PlacePage'))).toEqual([]);
    }
  });
});
