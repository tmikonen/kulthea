import { test, expect, type Page } from '@playwright/test';

const FIRST = '6050-1-001-01-first';
const panel = (page: Page) => page.getByRole('complementary', { name: /^(Päiväkirja|Journal)$/ });
const button = (page: Page) => page.getByRole('button', { name: /^(Päiväkirja|Journal)$/ });
const image = (page: Page) => page.locator('img.leaflet-image-layer');

async function open(page: Page, query = '') {
  await page.goto(`./#/event/${FIRST}${query}`);
  await expect(page.getByRole('region', { name: 'Tapahtuma' })).toBeVisible();
  await expect(image(page)).toBeVisible();
}

test.describe('journal button and panel (B-21)', () => {
  test('FR-6 the button opens the index over the event, and the button, Escape and the close button close it', async ({ page }) => {
    await open(page);
    await expect(panel(page)).toHaveCount(0);
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}\\?journal=index$`));
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText(['Pelaajahahmot', 'Henkilöt', 'Esineet', 'Paikat', 'Muistiinpanot']);

    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));

    await button(page).click();
    await page.getByRole('button', { name: 'Sulje päiväkirja' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Tapahtuma' }).getByRole('heading', { level: 2 })).toHaveText('Ensimmäinen');
  });

  test('FR-6 the back button closes a panel that was just opened, and after closing it brings it back', async ({ page }) => {
    await open(page);
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));

    await button(page).click();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await page.goBack();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));
  });

  test('FR-6 opening and closing the panel changes neither the map nor its zoom or position, and does not reload the page', async ({ page }) => {
    await open(page);
    await page.evaluate(() => { (window as unknown as { marker: number }).marker = 42; });
    await page.locator('.leaflet-control-zoom-in').click();
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(800);
    const before = await image(page).boundingBox();
    const area = await page.locator('.leaflet-container').boundingBox();
    expect(before!.width).toBeGreaterThan(area!.width); // zoomed in

    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await page.waitForTimeout(400);
    expect(await image(page).boundingBox()).toEqual(before);
    expect(await page.locator('.leaflet-container').boundingBox()).toEqual(area);

    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    expect(await image(page).boundingBox()).toEqual(before);
    expect(await page.evaluate(() => (window as unknown as { marker: number }).marker)).toBe(42);
  });

  test('FR-6 the panel slides in from the right over the main view, and looks different from it', async ({ page }) => {
    await open(page);
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await page.waitForTimeout(400);
    const box = (await panel(page).boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x + box.width).toBeCloseTo(viewport.width, 0);
    expect(box.x).toBeGreaterThan(viewport.width / 2);
    expect(box.width).toBeLessThan(viewport.width / 2);
    const colours = await page.evaluate(() => {
      const aside = document.querySelector('aside')!;
      return [getComputedStyle(aside).backgroundColor, getComputedStyle(document.body).backgroundColor];
    });
    expect(colours[0]).not.toBe(colours[1]);
    // The map is still there under it, and so is the event panel.
    await expect(image(page)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Tapahtuma' })).toBeVisible();
  });

  test('FR-6 the panel slides in with an animation, and without one when the user prefers reduced motion', async ({ page }) => {
    const animation = () => page.evaluate(() => getComputedStyle(document.querySelector('aside')!).animationName);
    await open(page);
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    expect(await animation()).not.toBe('none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.keyboard.press('Escape');
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    expect(await animation()).toBe('none');
  });

  test('FR-6 stepping closes the panel, and the arrow keys do not step while focus is in it', async ({ page }) => {
    await open(page);
    await button(page).click();
    await expect(panel(page)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}\\?journal=index$`));
    await page.getByRole('button', { name: 'Seuraava' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second$/);
  });

  test('FR-6 focus returns to the journal button when the panel closes', async ({ page }) => {
    await open(page);
    await button(page).focus();
    await button(page).press('Enter');
    await expect(panel(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(button(page)).toBeFocused();
  });

  test('FR-6 an unknown entry in the address is ignored, and an entry opens directly, also after a reload', async ({ page }) => {
    await open(page, '?journal=nowhere');
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Tapahtuma' }).getByRole('heading', { level: 2 })).toHaveText('Ensimmäinen');
    await expect(page).toHaveURL(/journal=nowhere$/);

    await open(page, '?journal=hero');
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Sankari');
    await page.reload();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText('Sankari');
  });

  test('FR-9 switching the language keeps the panel open and translates it', async ({ page }) => {
    await open(page, '?journal=index');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(page).toHaveURL(/journal=index&lang=en$/);
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByRole('heading', { level: 3 }).first()).toHaveText('Player characters');
    await expect(button(page)).toHaveText('Journal');
  });

  test('FR-2 an unknown event with a journal parameter shows the first event with the panel open and the notice', async ({ page }) => {
    await page.goto('./#/event/nowhere?journal=index');
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}\\?journal=index$`));
    await expect(panel(page)).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Tapahtumaa ei löytynyt');
  });
});
