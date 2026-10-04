import { test, expect, type Page } from '@playwright/test';

const dots = (page: Page) => page.locator('path.visited-dot');
const current = (page: Page) => page.locator('path.current-marker');
const image = (page: Page) => page.locator('img.leaflet-image-layer');
const next = (page: Page) => page.getByRole('button', { name: 'Seuraava' });

/** The centres of the dots, as percent of the displayed image, sorted from the left. */
async function dotPercents(page: Page) {
  const img = (await image(page).boundingBox())!;
  const centres = await dots(page).evaluateAll((paths) =>
    paths.map((p) => {
      const r = p.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }));
  return centres
    .map((c) => [Math.round(((c.x - img.x) / img.width) * 100), Math.round(((c.y - img.y) / img.height) * 100)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** The dot whose centre is at the given percent of the image width. */
async function dotAt(page: Page, percentX: number) {
  const img = (await image(page).boundingBox())!;
  for (let i = 0; i < (await dots(page).count()); i++) {
    const box = (await dots(page).nth(i).boundingBox())!;
    if (Math.round(((box.x + box.width / 2 - img.x) / img.width) * 100) === percentX) return dots(page).nth(i);
  }
  throw new Error(`no dot at ${percentX}%`);
}

test.describe('visited places (B-14)', () => {
  // The fixture events in date order: the map shown, and the dots on it (percent of the image).
  const STEPS: { map: string; dots: number[][] }[] = [
    { map: 'main-map', dots: [] },                         // first (80, 20)
    { map: 'main-map', dots: [[80, 20]] },                 // second (25, 75)
    { map: 'main-map', dots: [[25, 75]] },                 // ninth (80, 20): the first place again, so it is the marker
    { map: 'second-map', dots: [[50, 50]] },               // on-second-map (10, 90): the second event's location is on this map too
    { map: 'second-map', dots: [[10, 90], [50, 50]] },     // split (30, 30)
    { map: 'main-map', dots: [[80, 20]] },                 // standalone (25, 75): the second place is the marker
    { map: 'main-map', dots: [[25, 75], [80, 20]].sort((a, b) => a[0] - b[0]) }, // jump (10, 10)
  ];

  test('FR-1 the first event has only the current marker and nothing else on the map', async ({ page }) => {
    await page.goto('./');
    await expect(current(page)).toHaveCount(1);
    await expect(dots(page)).toHaveCount(0);
    await expect(page.locator('path.leaflet-interactive')).toHaveCount(1);
  });

  test('FR-1 the dots at each step are the places of the earlier events on that map, at their positions', async ({ page }) => {
    await page.goto('./');
    for (let i = 0; i < STEPS.length; i++) {
      await expect(image(page)).toHaveAttribute('src', new RegExp(STEPS[i].map));
      await expect(dots(page)).toHaveCount(STEPS[i].dots.length);
      await expect.poll(() => dotPercents(page)).toEqual(STEPS[i].dots);
      if (i < STEPS.length - 1) await next(page).click();
    }
  });

  test('FR-1 stepping back takes the dots away in the same order', async ({ page }) => {
    await page.goto('./#/event/6050-3-001-01-jump');
    await expect(dots(page)).toHaveCount(2);
    await page.getByRole('button', { name: 'Edellinen' }).click(); // standalone
    await expect(dots(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Edellinen' }).click(); // split, on the second map
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expect(dots(page)).toHaveCount(2);
    await page.getByRole('button', { name: 'Edellinen' }).click(); // on-second-map
    await expect(dots(page)).toHaveCount(1);
  });

  test('FR-1 the dots are the same when an event is opened directly', async ({ page }) => {
    await page.goto('./#/event/6050-2-070-01-standalone');
    await expect.poll(() => dotPercents(page)).toEqual([[80, 20]]);
    await page.reload();
    await expect.poll(() => dotPercents(page)).toEqual([[80, 20]]);
  });

  test('FR-1 no place the story has not reached is shown, though it is a known location', async ({ page }) => {
    // second-only and both-places are locations with positions on the second map, but not yet visited.
    await page.goto('./#/event/6050-1-001-01-first?map=second-map');
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expect(dots(page)).toHaveCount(0);
    await expect(current(page)).toHaveCount(0);
  });

  test('FR-1 a manual map switch shows the dots of the earlier events that were on that map', async ({ page }) => {
    await page.goto('./#/event/6050-2-003-01-split'); // shown on the second map
    await expect.poll(() => dotPercents(page)).toEqual([[10, 90], [50, 50]]);
    await page.getByRole('button', { name: 'Pääkartta' }).click();
    await expect(image(page)).toHaveAttribute('src', /main-map/);
    // The earlier events were at (80, 20) and (25, 75). The split event is also placed at (80, 20) on the
    // main map, so that is its current marker, and only (25, 75) is a dot.
    await expect.poll(() => dotPercents(page)).toEqual([[25, 75]]);
    await expect(current(page)).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Tapahtuma' }).getByRole('heading', { level: 2 })).toHaveText('Eroon');
  });

  test('FR-1 the dots stay at their positions when the map is zoomed in', async ({ page }) => {
    await page.goto('./#/event/6050-2-070-01-standalone');
    await expect(dots(page)).toHaveCount(1);
    await page.locator('.leaflet-control-zoom-in').click();
    await expect.poll(() => dotPercents(page)).toEqual([[80, 20]]);
  });

  test('FR-1 the dots are small, and clearly different from the current marker', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    await expect(dots(page)).toHaveCount(1);
    const dot = (await dots(page).first().boundingBox())!;
    const marker = (await current(page).boundingBox())!;
    expect(dot.width).toBeLessThan(marker.width * 0.7);
    const fills = await page.evaluate(() => [
      getComputedStyle(document.querySelector('path.current-marker')!).fill,
      getComputedStyle(document.querySelector('path.visited-dot')!).fill,
    ]);
    expect(fills[0]).not.toBe(fills[1]);
  });

  test('FR-9 a named place shows its name on hover in the chosen language, and a one-off position nothing', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second'); // the dot is the first event's place, main-only
    await dots(page).first().hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Main Only');
    await page.goto('./#/event/6050-1-001-02-second?lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en'); // the page has changed language
    await dots(page).first().hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Main Only');
    await page.goto('./#/event/6050-2-003-01-split'); // on the second map: the dots are second-only (10, 90) and both-places (50, 50)
    await expect(dots(page)).toHaveCount(2);
    await (await dotAt(page, 10)).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Vain toinen');
    await page.goto('./#/event/6050-2-003-01-split?lang=en');
    await expect(dots(page)).toHaveCount(2);
    await (await dotAt(page, 10)).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Second Only');
    await page.mouse.move(0, 0);
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(0);
    await (await dotAt(page, 50)).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Both Places');
  });

  test('FR-1 a dot for a one-off position has no hover text, and one for a named place has its name', async ({ page }) => {
    // At the jump event, viewed on the second map, the earlier places there are: both-places (50, 50, by its
    // location), on-second-map (second-only, 10, 90) and the split event (a one-off position at 30, 30).
    await page.goto('./#/event/6050-3-001-01-jump?map=second-map');
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expect(dots(page)).toHaveCount(3);
    await (await dotAt(page, 10)).hover({ force: true });
    await expect(page.locator('.leaflet-tooltip')).toHaveText('Vain toinen');
    await page.mouse.move(0, 0);
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(0);
    await (await dotAt(page, 30)).hover({ force: true });
    await page.waitForTimeout(300);
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(0);
  });
});
