import { test, expect, type Page } from '@playwright/test';

const markers = (page: Page) => page.locator('path.leaflet-interactive');

/** Where each marker is, as percent of the displayed image, from the top-left. */
async function markerPercents(page: Page) {
  const image = (await page.locator('img.leaflet-image-layer').boundingBox())!;
  const boxes = await markers(page).evaluateAll((paths) =>
    paths.map((p) => {
      const r = p.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }));
  return boxes
    .map((b) => ({
      x: ((b.x - image.x) / image.width) * 100,
      y: ((b.y - image.y) / image.height) * 100,
    }))
    .sort((a, b) => a.x - b.x);
}

async function hoverTexts(page: Page) {
  const texts: string[] = [];
  const count = await markers(page).count();
  for (let i = 0; i < count; i++) {
    await markers(page).nth(i).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(1);
    texts.push((await page.locator('.leaflet-tooltip').textContent())!);
    await page.mouse.move(0, 0);
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(0);
  }
  return texts.sort();
}

test.describe('locations (B-7)', () => {
  test('FR-1 markers appear on the map at the positions of the locations that are on it', async ({ page }) => {
    await page.goto('./');
    await expect(markers(page)).toHaveCount(2);
    const [first, second] = await markerPercents(page);
    // both-places [25, 75] and main-only [80, 20]
    expect(first.x).toBeCloseTo(25, 0);
    expect(first.y).toBeCloseTo(75, 0);
    expect(second.x).toBeCloseTo(80, 0);
    expect(second.y).toBeCloseTo(20, 0);
  });

  test('FR-1 another map shows its own markers, at their positions', async ({ page }) => {
    await page.goto('./#/?map=second-map');
    await expect(page.locator('img.leaflet-image-layer')).toHaveAttribute('src', /second-map/);
    await expect(markers(page)).toHaveCount(2);
    const [first, second] = await markerPercents(page);
    // second-only [10, 90] and both-places [50, 50]
    expect(first.x).toBeCloseTo(10, 0);
    expect(first.y).toBeCloseTo(90, 0);
    expect(second.x).toBeCloseTo(50, 0);
    expect(second.y).toBeCloseTo(50, 0);
  });

  test('FR-1 the markers stay at their positions when the map is zoomed in', async ({ page }) => {
    await page.goto('./');
    await expect(markers(page)).toHaveCount(2);
    await page.locator('.leaflet-control-zoom-in').click();
    // Wait for the zoom to settle: the image has grown.
    await page.waitForTimeout(500);
    const imageBox = (await page.locator('img.leaflet-image-layer').boundingBox())!;
    const first = (await markers(page).first().boundingBox())!;
    const cx = ((first.x + first.width / 2 - imageBox.x) / imageBox.width) * 100;
    const cy = ((first.y + first.height / 2 - imageBox.y) / imageBox.height) * 100;
    expect([cx, cy].map((n) => Math.round(n))).toEqual([25, 75]);
  });

  test('FR-9 the tooltip shows the name in the chosen language, with fallback', async ({ page }) => {
    await page.goto('./');
    await expect(markers(page)).toHaveCount(2);
    expect(await hoverTexts(page)).toEqual(['Main Only', 'Molemmat paikat']);

    await page.getByRole('button', { name: 'EN' }).click();
    expect(await hoverTexts(page)).toEqual(['Both Places', 'Main Only']);

    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect(page.locator('img.leaflet-image-layer')).toHaveAttribute('src', /second-map/);
    expect(await hoverTexts(page)).toEqual(['Both Places', 'Second Only']);
  });
});
