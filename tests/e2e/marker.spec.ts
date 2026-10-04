import { test, expect, type Page } from '@playwright/test';

const current = (page: Page) => page.locator('path.current-marker');
const image = (page: Page) => page.locator('img.leaflet-image-layer');
const next = (page: Page) => page.getByRole('button', { name: 'Seuraava' });

/** The centre of the current marker, as percent of the displayed image from its top-left corner. */
async function markerPercent(page: Page) {
  const img = (await image(page).boundingBox())!;
  const box = (await current(page).boundingBox())!;
  return {
    x: ((box.x + box.width / 2 - img.x) / img.width) * 100,
    y: ((box.y + box.height / 2 - img.y) / img.height) * 100,
  };
}

/**
 * Whether the place at `at` (percent of the image) is inside the visible map area. It is worked out
 * from the image's box, because Leaflet does not draw a path far outside the view.
 */
const inView = async (page: Page, at: [number, number]) => {
  const area = (await page.locator('.leaflet-container').boundingBox())!;
  const img = (await image(page).boundingBox())!;
  const cx = img.x + (img.width * at[0]) / 100;
  const cy = img.y + (img.height * at[1]) / 100;
  return cx >= area.x && cx <= area.x + area.width && cy >= area.y && cy <= area.y + area.height;
};

test.describe('current event marker (B-13)', () => {
  // The fixture events in date order: the map each is shown on and where its marker is.
  const STEPS: { map: string; at: [number, number] }[] = [
    { map: 'main-map', at: [80, 20] },   // first, main-only
    { map: 'main-map', at: [25, 75] },   // second, both-places
    { map: 'main-map', at: [80, 20] },   // ninth, main-only
    { map: 'second-map', at: [10, 90] }, // on-second-map: n/a on the main map, second-only on the second
    { map: 'second-map', at: [30, 30] }, // split: a one-off position on the second map
    { map: 'main-map', at: [25, 75] },   // standalone, both-places
    { map: 'main-map', at: [10, 10] },   // jump: a one-off position on the main map
  ];

  test('FR-1 the marker is at the place of each event, on the map that the event is shown on', async ({ page }) => {
    await page.goto('./');
    for (let i = 0; i < STEPS.length; i++) {
      await expect(image(page)).toHaveAttribute('src', new RegExp(STEPS[i].map));
      await expect(current(page)).toHaveCount(1);
      await expect.poll(async () => {
        const p = await markerPercent(page);
        return [Math.round(p.x), Math.round(p.y)];
      }).toEqual(STEPS[i].at);
      if (i < STEPS.length - 1) await next(page).click();
    }
  });

  test('FR-1 stepping back moves the marker back', async ({ page }) => {
    await page.goto('./#/event/6050-2-070-01-standalone');
    await expect.poll(async () => Math.round((await markerPercent(page)).y)).toBe(75);
    await page.getByRole('button', { name: 'Edellinen' }).click();
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expect.poll(async () => Math.round((await markerPercent(page)).x)).toBe(30);
  });

  test('FR-1 the marker is larger and a different colour than the dots, and above them', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second'); // the first event's place is a dot
    await expect(current(page)).toHaveCount(1);
    await expect(page.locator('path.visited-dot')).toHaveCount(1);
    const big = (await current(page).boundingBox())!;
    const small = (await page.locator('path.visited-dot').boundingBox())!;
    expect(big.width).toBeGreaterThan(small.width * 1.5);
    const fills = await page.evaluate(() => [
      getComputedStyle(document.querySelector('path.current-marker')!).fill,
      getComputedStyle(document.querySelector('path.visited-dot')!).fill,
    ]);
    expect(fills[0]).not.toBe(fills[1]);
    // The marker is in a pane above the one with the dots.
    const above = await page.evaluate(() => {
      const z = (selector: string) => Number(getComputedStyle(document.querySelector(selector)!.closest('.leaflet-pane')!).zIndex);
      return z('path.current-marker') > z('path.visited-dot');
    });
    expect(above).toBe(true);
  });

  test('FR-1 the hover text is the name of the location, in the chosen language', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    await current(page).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Molemmat paikat');
    await page.goto('./#/event/6050-1-001-02-second?lang=en');
    await current(page).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Both Places');
  });

  test('FR-1 a one-off position has no hover text', async ({ page }) => {
    await page.goto('./#/event/6050-3-001-01-jump');
    await current(page).hover({ force: true });
    await page.waitForTimeout(300);
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(0);
  });

  test('FR-1 a map where the event\'s location has no position has no marker, and the event does not change', async ({ page }) => {
    // main-only is a location with a position on the main map only.
    await page.goto('./#/event/6050-1-001-01-first');
    await expect(current(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expect(current(page)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Tapahtuma' }).getByRole('heading', { level: 2 })).toHaveText('Ensimmäinen');
    await page.getByRole('button', { name: 'Pääkartta' }).click();
    await expect(current(page)).toHaveCount(1);
  });

  test('FR-1 a map where the event\'s location has a position has a marker there, though the event is not shown on it (B-34)', async ({ page }) => {
    // both-places has a position on the second map, at (50, 50), so the event at it has a marker there.
    await page.goto('./#/event/6050-1-001-02-second');
    await expect(current(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expect(current(page)).toHaveCount(1);
    await expect.poll(async () => {
      const p = await markerPercent(page);
      return [Math.round(p.x), Math.round(p.y)];
    }).toEqual([50, 50]);
    await current(page).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Molemmat paikat');
    await expect(page.getByRole('region', { name: 'Tapahtuma' }).getByRole('heading', { level: 2 })).toHaveText('Toinen');
  });

  test('FR-1 an event that is n/a on the main map has no marker there', async ({ page }) => {
    await page.goto('./#/event/6050-1-10-01-on-second-map?map=main-map');
    await expect(image(page)).toHaveAttribute('src', /main-map/);
    await expect(current(page)).toHaveCount(0);
  });

  test('FR-1 a one-off position has a marker only on its own map', async ({ page }) => {
    await page.goto('./#/event/6050-3-001-01-jump');
    await expect(current(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expect(current(page)).toHaveCount(0);
  });

  test('FR-1 the language does not move the marker', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    const before = await markerPercent(page);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Event' })).toBeVisible();
    const after = await markerPercent(page);
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });
});

test.describe('the view follows the marker (B-13)', () => {
  const zoomIn = async (page: Page, clicks: number) => {
    // A click during the zoom animation of the one before is ignored, so wait for each to finish.
    for (let i = 0; i < clicks; i++) {
      await page.locator('.leaflet-control-zoom-in').click();
      await page.waitForTimeout(450);
    }
  };
  const imageWidth = async (page: Page) => (await image(page).boundingBox())!.width;

  test('FR-1 when the marker is outside the view, the map pans to it, and the zoom stays', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-01-first');
    await expect(current(page)).toHaveCount(1);
    await zoomIn(page, 4);
    const zoomed = await imageWidth(page);
    // The centre of the zoomed view is the centre of the map, so the markers at (80, 20) and (25, 75) are out of view.
    expect(await inView(page, [80, 20])).toBe(false);

    await next(page).click(); // second: marker at (25, 75)
    await expect.poll(() => inView(page, [25, 75])).toBe(true);
    await expect(current(page)).toHaveCount(1);
    expect(await imageWidth(page)).toBeCloseTo(zoomed, 0);

    await next(page).click(); // ninth: marker at (80, 20), far from the last one
    await expect.poll(() => inView(page, [80, 20])).toBe(true);
    expect(await imageWidth(page)).toBeCloseTo(zoomed, 0);
  });

  test('FR-1 stepping back also brings the marker into view', async ({ page }) => {
    await page.goto('./#/event/6050-1-9-01-ninth');
    await zoomIn(page, 4);
    expect(await inView(page, [80, 20])).toBe(false);
    await page.getByRole('button', { name: 'Edellinen' }).click(); // the second event's marker is at (25, 75)
    await expect.poll(() => inView(page, [25, 75])).toBe(true);
  });

  test('FR-1 when the marker is already in view, the map does not move', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-01-first');
    await expect(current(page)).toHaveCount(1);
    await zoomIn(page, 1); // a little closer: both markers stay well inside the view
    expect(await inView(page, [80, 20])).toBe(true);
    expect(await inView(page, [25, 75])).toBe(true);
    const before = (await image(page).boundingBox())!;
    await next(page).click();
    await page.waitForTimeout(700);
    const after = (await image(page).boundingBox())!;
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
    expect(after.width).toBeCloseTo(before.width, 0);
  });

  test('FR-1 at the fitted zoom the map does not move', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-01-first');
    await expect(current(page)).toHaveCount(1);
    const before = (await image(page).boundingBox())!;
    await next(page).click();
    await next(page).click();
    await page.waitForTimeout(700);
    const after = (await image(page).boundingBox())!;
    expect(after).toEqual(before);
  });
});
