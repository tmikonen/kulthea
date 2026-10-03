import { test, expect, type Page } from '@playwright/test';

const imageWidth = (page: Page) =>
  page.locator('img.leaflet-image-layer').evaluate((img) => img.getBoundingClientRect().width);

test.describe('main map (B-4)', () => {
  test('FR-1 the main map image is shown, fitted to the area', async ({ page }) => {
    await page.goto('./');
    const image = page.locator('img.leaflet-image-layer');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(200);

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

  test('FR-1 the map works in a phone-sized window', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('./');
    await expect(page.locator('img.leaflet-image-layer')).toBeVisible();
    const area = (await page.locator('.leaflet-container').boundingBox())!;
    expect(area.width).toBeGreaterThan(300);
    expect(area.height).toBeGreaterThan(300);
  });
});
