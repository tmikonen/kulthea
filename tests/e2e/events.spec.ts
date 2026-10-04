import { test, expect, type Page } from '@playwright/test';

const FIRST = '6050-1-001-01-first';
const title = (page: Page) => page.getByRole('region', { name: /^(Tapahtuma|Event)$/ }).getByRole('heading', { level: 2 });
const imageSrc = (page: Page) => page.locator('img.leaflet-image-layer').getAttribute('src');

test.describe('event view and routing (B-11)', () => {
  test('FR-2 opening the site goes to the first event, which shows its title and location', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));
    await expect(title(page)).toHaveText('Ensimmäinen');
    await expect(page.getByRole('region', { name: 'Tapahtuma' })).toContainText('Main Only');
  });

  test('FR-2 the address with no event goes to the first event, keeping map and language', async ({ page }) => {
    await page.goto('./#/?map=second-map&lang=en');
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}\\?map=second-map&lang=en$`));
    await expect(title(page)).toHaveText('First');
    await expect.poll(() => imageSrc(page)).toMatch(/second-map/);
  });

  test('FR-3 a link to an event opens that event', async ({ page }) => {
    await page.goto('./#/event/6050-2-003-01-split');
    await expect(title(page)).toHaveText('Eroon');
    await page.goto('./#/event/6050-1-10-01-on-second-map?lang=en');
    await expect(title(page)).toHaveText('On the second map');
    await expect(page.getByRole('region', { name: 'Event' })).toContainText('Second Only');
  });

  test('FR-2 an unknown event shows the first event with a notice that can be dismissed', async ({ page }) => {
    await page.goto('./#/event/nowhere');
    await expect(title(page)).toHaveText('Ensimmäinen');
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));
    await expect(page.getByRole('status')).toContainText('Tapahtumaa ei löytynyt');

    await page.getByRole('button', { name: 'Sulje' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(title(page)).toHaveText('Ensimmäinen');
  });

  test('FR-2 the notice is shown in the chosen language, and the redirect does not trap the back button', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    await page.goto('./#/event/nowhere?lang=en');
    await expect(page.getByRole('status')).toContainText('That event was not found');
    await page.goBack();
    await expect(title(page)).toHaveText('Toinen');
  });

  test('FR-1 switching the map and the language keeps the event, through reload and back', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    await expect(title(page)).toHaveText('Toinen');

    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second\?map=second-map$/);
    await expect.poll(() => imageSrc(page)).toMatch(/second-map/);
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second\?map=second-map&lang=en$/);

    await page.reload();
    await expect(title(page)).toHaveText('Toinen');
    await expect(page.getByRole('button', { name: 'Second Map' })).toHaveAttribute('aria-pressed', 'true');

    await page.goBack();
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second\?map=second-map$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second$/);
    await expect.poll(() => imageSrc(page)).toMatch(/main-map/);
  });

  test('FR-2 the temporary event list is gone, and the panel is below the map', async ({ page }) => {
    await page.goto('./');
    await expect(title(page)).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(0);
    const map = (await page.locator('.leaflet-container').boundingBox())!;
    const panel = (await page.getByRole('region', { name: 'Tapahtuma' }).boundingBox())!;
    expect(map.y + map.height).toBeLessThanOrEqual(panel.y + 1);
  });
});
