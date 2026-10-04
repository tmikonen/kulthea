import { test, expect, type Page } from '@playwright/test';

const imageWidth = (page: Page) =>
  page.locator('img.leaflet-image-layer').evaluate((img) => img.getBoundingClientRect().width);

async function expectFitted(page: Page) {
  const image = page.locator('img.leaflet-image-layer');
  await expect.poll(async () => {
    const area = (await page.locator('.leaflet-container').boundingBox())!;
    const box = (await image.boundingBox())!;
    const inside = box.x >= area.x - 1 && box.y >= area.y - 1
      && box.x + box.width <= area.x + area.width + 1
      && box.y + box.height <= area.y + area.height + 1;
    const fillsWidth = Math.abs(box.width - area.width) < 2;
    const fillsHeight = Math.abs(box.height - area.height) < 2;
    return inside && (fillsWidth || fillsHeight);
  }).toBe(true);
}

test.describe('main map (B-4)', () => {
  test('FR-1 the main map image is shown, fitted to the area', async ({ page }) => {
    await page.goto('./');
    const image = page.locator('img.leaflet-image-layer');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(3000);

    const area = await page.locator('.leaflet-container').boundingBox();
    const box = await image.boundingBox();
    // The whole image is in view, and it fills the area in one direction.
    expect(box!.x).toBeGreaterThanOrEqual(area!.x - 1);
    expect(box!.y).toBeGreaterThanOrEqual(area!.y - 1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(area!.x + area!.width + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(area!.y + area!.height + 1);
    const fillsWidth = Math.abs(box!.width - area!.width) < 2;
    const fillsHeight = Math.abs(box!.height - area!.height) < 2;
    expect(fillsWidth || fillsHeight).toBe(true);
  });

  test('FR-1 the zoom buttons change the zoom', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
    const fitted = await imageWidth(page);

    await page.locator('.leaflet-control-zoom-in').click();
    await expect.poll(() => imageWidth(page)).toBeGreaterThan(fitted * 1.3);
    const zoomedIn = await imageWidth(page);

    await page.locator('.leaflet-control-zoom-out').click();
    await expect.poll(() => imageWidth(page)).toBeLessThan(zoomedIn);
  });

  test('FR-1 the view cannot be zoomed out past the fitted map or dragged out of view', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
    const fitted = await imageWidth(page);

    // At the fitted zoom the zoom-out button is disabled, and wheeling out changes nothing.
    await expect(page.locator('.leaflet-control-zoom-out')).toHaveClass(/leaflet-disabled/);
    const first = (await page.locator('.leaflet-container').boundingBox())!;
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    expect(Math.abs((await imageWidth(page)) - fitted)).toBeLessThan(2);

    await page.locator('.leaflet-control-zoom-in').click();
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(500);
    const area = (await page.locator('.leaflet-container').boundingBox())!;
    const centre = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + area.width * 3, centre.y + area.height * 3, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const box = (await page.locator('img.leaflet-image-layer').boundingBox())!;
    // Dragged as far right and down as possible: the image's top-left corner is at the area's, not beyond.
    expect(box.x).toBeLessThanOrEqual(area.x + 2);
    expect(box.y).toBeLessThanOrEqual(area.y + 2);
  });

  test('FR-1 a map left at the fitted zoom is refitted when the window is resized', async ({ page }) => {
    await page.goto('./');
    await expectFitted(page);
    await page.setViewportSize({ width: 800, height: 500 });
    await expectFitted(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await expectFitted(page);
    await page.setViewportSize({ width: 600, height: 900 });
    await expectFitted(page);
  });

  for (const delay of [0, 5, 16, 40]) {
    test(`FR-1 the map is refitted after the window is dragged smaller and larger again, ${delay} ms between sizes`, async ({ page }) => {
      await page.goto('./');
      await expectFitted(page);
      const sizes = [];
      for (let w = 1280; w >= 700; w -= 40) sizes.push(w);
      for (let w = 700; w <= 1260; w += 40) sizes.push(w);
      for (const width of sizes) {
        await page.setViewportSize({ width, height: Math.round(width * 0.56) });
        await page.waitForTimeout(delay);
      }
      await expectFitted(page);
    });
  }

  test('FR-1 a map the user has zoomed in keeps its zoom when the window is resized', async ({ page }) => {
    await page.goto('./');
    await expectFitted(page);
    await page.locator('.leaflet-control-zoom-in').click();
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(500);
    const zoomed = await imageWidth(page);
    await page.setViewportSize({ width: 900, height: 600 });
    await page.waitForTimeout(500);
    expect(await imageWidth(page)).toBeGreaterThan(zoomed * 0.9);
  });

  test('FR-1 the map works in a phone-sized window', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('./');
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
    const area = (await page.locator('.leaflet-container').boundingBox())!;
    expect(area.width).toBeGreaterThan(300);
    expect(area.height).toBeGreaterThan(300);
  });
});

test.describe('switching maps (B-5)', () => {
  const imageSrc = (page: Page) =>
    page.locator('img.leaflet-image-layer').getAttribute('src');

  test('FR-1 the switcher shows another map, and reload and back keep the choice', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Pääkartta' })).toHaveAttribute('aria-pressed', 'true');
    expect(await imageSrc(page)).toMatch(/main-map/);

    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect(page).toHaveURL(/#\/event\/[^?]+\?map=second-map$/);
    await expect.poll(() => imageSrc(page)).toMatch(/second-map/);
    await expect(page.getByRole('button', { name: 'Second Map' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect.poll(() => imageSrc(page)).toMatch(/second-map/);

    await page.goBack();
    await expect.poll(() => imageSrc(page)).toMatch(/main-map/);
    await expect(page.getByRole('button', { name: 'Pääkartta' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('FR-1 switching maps does not reload the page', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
    await page.evaluate(() => { (window as unknown as { marker: number }).marker = 1; });
    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect.poll(() => imageSrc(page)).toMatch(/second-map/);
    expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
  });

  test('FR-1 the map parameter opens a map, and an unknown id opens the main map', async ({ page }) => {
    await page.goto('./#/?map=second-map');
    await expect.poll(() => imageSrc(page)).toMatch(/second-map/);
    await page.goto('./#/?map=nowhere');
    await expect.poll(() => imageSrc(page)).toMatch(/main-map/);
  });

  test('FR-1 the other maps are downloaded in the background after the main map', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      const match = request.url().match(/(main-map|second-map)[^/]*\.png$/);
      if (match) requested.push(match[1]);
    });
    await page.goto('./');
    await expect.poll(() => requested.includes('second-map')).toBe(true);
    expect(requested[0]).toBe('main-map');
    // The second map was never chosen, so only the preload can have requested it.
    expect(await imageSrc(page)).toMatch(/main-map/);
  });
});

test.describe('the map follows the event (B-15)', () => {
  const src = (page: Page) => page.locator('img.leaflet-image-layer').getAttribute('src');
  const next = (page: Page) => page.getByRole('button', { name: 'Seuraava' });
  // The fixture events in date order, and the map each one is shown on.
  const MAPS = ['main-map', 'main-map', 'main-map', 'second-map', 'second-map', 'main-map', 'main-map'];

  test('FR-1 stepping through the events shows each one on its own map, fitted to the window', async ({ page }) => {
    await page.goto('./');
    for (let i = 0; i < MAPS.length; i++) {
      await expect.poll(() => src(page)).toMatch(new RegExp(MAPS[i]));
      await expectFitted(page);
      if (i < MAPS.length - 1) await next(page).click();
    }
  });

  test('FR-1 stepping back switches the map back, and the switcher marks the displayed map', async ({ page }) => {
    await page.goto('./#/event/6050-2-070-01-standalone');
    await expect(page.getByRole('button', { name: 'Pääkartta' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Edellinen' }).click();
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await expect(page.getByRole('button', { name: 'Second Map' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Edellinen' }).click();
    await page.getByRole('button', { name: 'Edellinen' }).click();
    await expect.poll(() => src(page)).toMatch(/main-map/);
  });

  test('FR-1 a manual map choice lasts until the next step, and the event does not change', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await expect(page.getByRole('region', { name: 'Tapahtuma' }).getByRole('heading', { level: 2 })).toHaveText('Toinen');
    await next(page).click(); // ninth, on the main map
    await expect.poll(() => src(page)).toMatch(/main-map/);
    await next(page).click(); // on the second map
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await page.getByRole('button', { name: 'Pääkartta' }).click();
    await expect.poll(() => src(page)).toMatch(/main-map/);
    await next(page).click(); // the split event, on the second map again
    await expect.poll(() => src(page)).toMatch(/second-map/);
  });

  test('FR-1 a link opens the event on its own map, and survives a reload', async ({ page }) => {
    await page.goto('./#/event/6050-1-10-01-on-second-map');
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await page.reload();
    await expect.poll(() => src(page)).toMatch(/second-map/);
    await expectFitted(page);
  });

  test('FR-1 a map in the address wins over the event\'s own map, and an unknown one is ignored', async ({ page }) => {
    await page.goto('./#/event/6050-1-10-01-on-second-map?map=main-map');
    await expect.poll(() => src(page)).toMatch(/main-map/);
    await page.reload();
    await expect.poll(() => src(page)).toMatch(/main-map/);
    await page.goto('./#/event/6050-1-10-01-on-second-map?map=nowhere');
    await expect.poll(() => src(page)).toMatch(/second-map/);
  });

  test('FR-1 the other maps are still downloaded in the background after an automatic switch', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      const match = request.url().match(/(main-map|second-map)[^/]*\.png$/);
      if (match) requested.push(match[1]);
    });
    await page.goto('./#/event/6050-1-10-01-on-second-map');
    await expect.poll(() => requested.includes('main-map')).toBe(true);
    expect(requested[0]).toBe('second-map');
  });
});

test.describe('the map follows the size of its area (BUG-4)', () => {
  const area = async (page: Page) => (await page.locator('.leaflet-container').boundingBox())!;

  test('FR-1 the map is refitted when its area changes size without the window resizing', async ({ page }) => {
    // The notice above the event panel makes the map area shorter, and dismissing it makes it taller.
    await page.goto('./#/event/nowhere');
    await expect(page.getByRole('status')).toBeVisible();
    await expectFitted(page);
    const withNotice = (await area(page)).height;
    await page.getByRole('button', { name: 'Sulje' }).click();
    await expect.poll(async () => (await area(page)).height).toBeGreaterThan(withNotice + 10);
    await expectFitted(page);
  });

  test('FR-2 the map area keeps its size while stepping between events with short and long texts', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
    const first = await area(page);
    for (let i = 0; i < 6; i++) {
      await page.getByRole('button', { name: 'Seuraava' }).click();
      await expect(page.getByRole('region', { name: 'Tapahtuma' })).toBeVisible();
      // The map is created anew when the event is on another map, so wait for its container.
      await expect.poll(async () => {
        const box = await page.locator('.leaflet-container').boundingBox();
        return box ? [Math.round(box.width), Math.round(box.height)] : null;
      }).toEqual([Math.round(first.width), Math.round(first.height)]);
    }
  });
});
