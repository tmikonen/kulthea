import { test, expect, type Page } from '@playwright/test';

// These tests run on a site built from tests/fixtures-focus, where the main map (3000 x 1500) has a
// focus zoom of 2 steps, that is, twice the size of the whole map, and the second map (120 x 80) has none.

const image = (page: Page) => page.locator('img.leaflet-image-layer');
const current = (page: Page) => page.locator('path.current-marker');
const area = async (page: Page) => (await page.locator('.leaflet-container').boundingBox())!;
const next = (page: Page) => page.getByRole('button', { name: 'Seuraava' });
const previous = (page: Page) => page.getByRole('button', { name: 'Edellinen' });
const src = (page: Page) => image(page).getAttribute('src');

// The events in date order, and where each is on its map (percent).
const CENTRE = '6050-1-001-01-centre';       // (50, 50)
const RIGHT = '6050-1-002-01-right';         // (80, 30)
const ON_BOTH = '6050-1-003-01-on-both';     // main (30, 70), second (60, 40); shown on the second map
const SECOND_ONLY = '6050-1-004-01-second-only'; // n/a on the main map, second (20, 70)
const CORNER = '6050-1-005-01-corner';       // (3, 4)
const SAME = '6050-1-006-01-same-place';     // (3, 4)

/** The width of the whole map in the area, for a map with this width to height ratio. */
const fittedWidth = (a: { width: number; height: number }, ratio: number) => Math.min(a.width, a.height * ratio);

/**
 * Where the marker of a place should be on the screen when the view is focused on it: at the middle
 * of the area, unless the image's edge stops that.
 */
async function expectedMarker(page: Page, at: [number, number]) {
  const a = await area(page);
  const img = (await image(page).boundingBox())!;
  const width = img.width;
  const height = img.height;
  const fit = (value: number, size: number, view: number) =>
    size <= view ? size / 2 : Math.min(Math.max(value, view / 2), size - view / 2);
  const mx = (width * at[0]) / 100;
  const my = (height * at[1]) / 100;
  return {
    x: a.x + a.width / 2 + (mx - fit(mx, width, a.width)),
    y: a.y + a.height / 2 + (my - fit(my, height, a.height)),
  };
}

async function markerCentre(page: Page) {
  const box = (await current(page).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Waits until the view is the focused view of the place: twice the whole map, marker where it should be. */
async function expectFocused(page: Page, at: [number, number]) {
  await expect.poll(async () => {
    const a = await area(page);
    const img = (await image(page).boundingBox())!;
    if (Math.abs(img.width - 2 * fittedWidth(a, 2)) > 3) return `width ${Math.round(img.width)}`;
    const want = await expectedMarker(page, at);
    const got = await markerCentre(page);
    return Math.abs(got.x - want.x) <= 3 && Math.abs(got.y - want.y) <= 3 ? 'focused' : `marker ${Math.round(got.x)},${Math.round(got.y)} not ${Math.round(want.x)},${Math.round(want.y)}`;
  }, { timeout: 8000 }).toBe('focused');
}

/** Waits until the whole map is shown. */
async function expectWholeMap(page: Page, ratio: number) {
  await expect.poll(async () => {
    const a = await area(page);
    const img = (await image(page).boundingBox())!;
    return Math.abs(img.width - fittedWidth(a, ratio)) <= 2;
  }, { timeout: 8000 }).toBe(true);
}

const zoomOut = async (page: Page, clicks: number) => {
  for (let i = 0; i < clicks; i++) {
    await page.locator('.leaflet-control-zoom-out').click();
    await page.waitForTimeout(450);
  }
};

test.describe('focused view (B-33)', () => {
  test('FR-1 an event on a map with a focus zoom is shown zoomed in, with its marker in the middle', async ({ page }) => {
    await page.goto(`./#/event/${CENTRE}`);
    await expectFocused(page, [50, 50]);
    const a = await area(page);
    const marker = await markerCentre(page);
    expect(marker.x).toBeCloseTo(a.x + a.width / 2, -1);
    expect(marker.y).toBeCloseTo(a.y + a.height / 2, -1);
  });

  test('FR-1 stepping to the next event on the same map focuses on its marker, at the same zoom', async ({ page }) => {
    await page.goto(`./#/event/${CENTRE}`);
    await expectFocused(page, [50, 50]);
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(RIGHT));
    await expectFocused(page, [80, 30]);
  });

  test('FR-1 the move to the next event is animated, and takes about a second at the most', async ({ page }) => {
    await page.goto(`./#/event/${CENTRE}`);
    await expectFocused(page, [50, 50]);
    // Click in the page and sample the marker every frame, so that the movement can be seen.
    const samples = await page.evaluate(() => new Promise<{ t: number; x: number }[]>((resolve) => {
      const marker = () => document.querySelector('path.current-marker')!.getBoundingClientRect();
      const out: { t: number; x: number }[] = [];
      const start = performance.now();
      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.find((b) => b.textContent === 'Seuraava')!.click();
      const tick = () => {
        out.push({ t: performance.now() - start, x: marker().x });
        if (performance.now() - start < 1500) requestAnimationFrame(tick);
        else resolve(out);
      };
      requestAnimationFrame(tick);
    }));
    const xs = Array.from(new Set(samples.map((s) => Math.round(s.x))));
    expect(xs.length).toBeGreaterThan(5);
    const last = samples[samples.length - 1].x;
    const settled = samples.find((s) => Math.abs(s.x - last) < 1)!;
    expect(settled.t).toBeLessThan(1200);
    expect(settled.t).toBeGreaterThan(150);
  });

  test('FR-1 stepping focuses again after the user has zoomed out, and the user can zoom out to the whole map', async ({ page }) => {
    await page.goto(`./#/event/${CENTRE}`);
    await expectFocused(page, [50, 50]);
    await zoomOut(page, 2);
    await expectWholeMap(page, 2);
    await next(page).click();
    await expectFocused(page, [80, 30]);
  });

  test('FR-1 stepping focuses again after the user has zoomed in further', async ({ page }) => {
    await page.goto(`./#/event/${CENTRE}`);
    await expectFocused(page, [50, 50]);
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(450);
    const a = await area(page);
    expect((await image(page).boundingBox())!.width).toBeGreaterThan(2 * fittedWidth(a, 2) + 10);
    await next(page).click();
    await expectFocused(page, [80, 30]);
  });

  test('FR-1 the user\'s own panning lasts until the next step', async ({ page }) => {
    await page.goto(`./#/event/${CENTRE}`);
    await expectFocused(page, [50, 50]);
    await page.mouse.move(600, 300);
    await page.mouse.down();
    await page.mouse.move(400, 250, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const moved = await markerCentre(page);
    const a = await area(page);
    expect(Math.abs(moved.x - (a.x + a.width / 2))).toBeGreaterThan(20);
    await next(page).click();
    await expectFocused(page, [80, 30]);
  });

  test('FR-1 an event on a map without a focus zoom shows the whole map, and stepping back focuses again', async ({ page }) => {
    await page.goto(`./#/event/${RIGHT}`);
    await expectFocused(page, [80, 30]);
    await next(page).click(); // on both maps, shown on the second
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await expectWholeMap(page, 1.5);
    await expect(current(page)).toHaveCount(1);
    await previous(page).click();
    await expect.poll(() => src(page)).toMatch(/main-map/);
    await expectFocused(page, [80, 30]);
  });

  test('FR-1 a manual switch to the focused map focuses when the event has a place there', async ({ page }) => {
    await page.goto(`./#/event/${ON_BOTH}`);
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await page.getByRole('button', { name: 'Pääkartta' }).click();
    await expect.poll(() => src(page)).toMatch(/main-map/);
    await expectFocused(page, [30, 70]);
    await expect(page.getByRole('region', { name: 'Tapahtuma' }).getByRole('heading', { level: 2 })).toHaveText('Molemmilla kartoilla');
  });

  test('FR-1 a manual switch to the focused map shows the whole map when the event has no place there', async ({ page }) => {
    await page.goto(`./#/event/${SECOND_ONLY}`);
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await page.getByRole('button', { name: 'Pääkartta' }).click();
    await expect.poll(() => src(page)).toMatch(/main-map/);
    await expectWholeMap(page, 2);
    await expect(current(page)).toHaveCount(0);
  });

  test('FR-1 an event opened from an address, and after a reload, is shown focused, without moving', async ({ page }) => {
    await page.goto(`./#/event/${RIGHT}`);
    await expectFocused(page, [80, 30]);
    await page.reload();
    await expectFocused(page, [80, 30]);
    await page.goto(`./#/event/${CENTRE}?map=main-map`);
    await expectFocused(page, [50, 50]);
  });

  test('FR-1 near a corner the view stays inside the map, and the marker is in view', async ({ page }) => {
    await page.goto(`./#/event/${CORNER}`);
    await expectFocused(page, [3, 4]);
    const a = await area(page);
    const img = (await image(page).boundingBox())!;
    // The map fills the whole area, with no empty space at the top or the left.
    expect(img.x).toBeLessThanOrEqual(a.x + 1);
    expect(img.y).toBeLessThanOrEqual(a.y + 1);
    const marker = await markerCentre(page);
    expect(marker.x).toBeGreaterThan(a.x);
    expect(marker.y).toBeGreaterThan(a.y);
  });

  test('FR-1 two events at one place in a row are both shown focused', async ({ page }) => {
    await page.goto(`./#/event/${CORNER}`);
    await expectFocused(page, [3, 4]);
    await zoomOut(page, 1);
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(SAME));
    await expectFocused(page, [3, 4]);
  });

  test('FR-1 a window resize keeps the zoom', async ({ page }) => {
    await page.goto(`./#/event/${CENTRE}`);
    await expectFocused(page, [50, 50]);
    const before = (await image(page).boundingBox())!.width;
    await page.setViewportSize({ width: 1100, height: 760 });
    await page.waitForTimeout(500);
    expect(Math.abs((await image(page).boundingBox())!.width - before)).toBeLessThan(3);
    await page.setViewportSize({ width: 1280, height: 620 });
    await page.waitForTimeout(500);
    expect(Math.abs((await image(page).boundingBox())!.width - before)).toBeLessThan(3);
  });

  test('FR-1 the language does not change the view', async ({ page }) => {
    await page.goto(`./#/event/${RIGHT}`);
    await expectFocused(page, [80, 30]);
    const before = (await image(page).boundingBox())!;
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Event' })).toBeVisible();
    await page.waitForTimeout(300);
    const after = (await image(page).boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(2);
    expect(Math.abs(after.width - before.width)).toBeLessThan(2);
  });
});
