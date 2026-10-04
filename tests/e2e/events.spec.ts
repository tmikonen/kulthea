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
    await page.getByRole('button', { name: 'EN', exact: true }).click();
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

test.describe('stepping (B-12)', () => {
  const IDS = [
    '6050-1-001-01-first', '6050-1-001-02-second', '6050-1-9-01-ninth', '6050-1-10-01-on-second-map',
    '6050-2-003-01-split', '6050-2-070-01-standalone', '6050-3-001-01-jump',
  ];
  const TITLES = ['Ensimmäinen', 'Toinen', 'Yhdeksäs', 'Toisella kartalla', 'Eroon', 'Yksin', 'Hyppy'];
  const next = (page: Page) => page.getByRole('button', { name: 'Seuraava' });
  const previous = (page: Page) => page.getByRole('button', { name: 'Edellinen' });

  test('FR-2 Next and Previous step through every event, and the address and title follow', async ({ page }) => {
    await page.goto('./');
    for (let i = 0; i < IDS.length; i++) {
      await expect(page).toHaveURL(new RegExp(`#/event/${IDS[i]}$`));
      await expect(title(page)).toHaveText(TITLES[i]);
      if (i < IDS.length - 1) await next(page).click();
    }
    for (let i = IDS.length - 2; i >= 0; i--) {
      await previous(page).click();
      await expect(page).toHaveURL(new RegExp(`#/event/${IDS[i]}$`));
      await expect(title(page)).toHaveText(TITLES[i]);
    }
  });

  test('FR-2 the buttons are disabled at the two ends', async ({ page }) => {
    await page.goto('./');
    await expect(previous(page)).toBeDisabled();
    await expect(next(page)).toBeEnabled();
    await page.goto(`./#/event/${IDS[IDS.length - 1]}`);
    await expect(next(page)).toBeDisabled();
    await expect(previous(page)).toBeEnabled();
  });

  test('FR-2 the back button goes to the previous event', async ({ page }) => {
    await page.goto('./');
    await next(page).click();
    await next(page).click();
    await expect(title(page)).toHaveText('Yhdeksäs');
    await page.goBack();
    await expect(title(page)).toHaveText('Toinen');
    await page.goBack();
    await expect(title(page)).toHaveText('Ensimmäinen');
  });

  test('FR-1 stepping drops a manual map choice and keeps the language', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-01-first?map=second-map&lang=en');
    await expect.poll(() => imageSrc(page)).toMatch(/second-map/);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second\?lang=en$/);
    await expect.poll(() => imageSrc(page)).toMatch(/main-map/);
    await expect(page.getByRole('button', { name: 'Previous' })).toBeVisible();
  });

  test('FR-2 the buttons work with the keyboard: Enter and Space', async ({ page }) => {
    await page.goto('./');
    await expect(title(page)).toHaveText('Ensimmäinen');
    await next(page).focus();
    await page.keyboard.press('Enter');
    await expect(title(page)).toHaveText('Toinen');
    await page.keyboard.press('Space');
    await expect(title(page)).toHaveText('Yhdeksäs');
  });

  test('FR-2 Tab reaches the buttons, and the arrow keys step from the panel', async ({ page }) => {
    await page.goto('./');
    await expect(title(page)).toHaveText('Ensimmäinen');
    await next(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(title(page)).toHaveText('Toinen');
    await expect(next(page)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(title(page)).toHaveText('Ensimmäinen');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(next(page)).toBeFocused();
  });

  test('FR-1 the arrow keys on the map pan the map and do not change the event', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    await expect(title(page)).toHaveText('Toinen');
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(500);
    const before = (await page.locator('img.leaflet-image-layer').boundingBox())!;
    await page.locator('.leaflet-container').focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await page.locator('img.leaflet-image-layer').boundingBox())!.x).not.toBe(before.x);
    await expect(title(page)).toHaveText('Toinen');
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second$/);
  });
});

test.describe('dates (B-9)', () => {
  const FI = [
    'K.A. 6050, Talven 1. päivä', 'K.A. 6050, Talven 1. päivä', 'K.A. 6050, Talven 9. päivä',
    'K.A. 6050, Talven 10. päivä', 'K.A. 6050, Kevään 3. päivä', 'K.A. 6050, Kevään 70. päivä',
    'K.A. 6050, Kesän 1. päivä',
  ];
  const EN = [
    'TE 6050, 1st of Winter', 'TE 6050, 1st of Winter', 'TE 6050, 9th of Winter', 'TE 6050, 10th of Winter',
    'TE 6050, 3rd of Spring', 'TE 6050, 70th of Spring', 'TE 6050, 1st of Summer',
  ];
  const date = (page: Page) => page.getByRole('region', { name: /^(Tapahtuma|Event)$/ }).locator('p').first();

  async function stepThrough(page: Page, expected: string[], nextName: string) {
    for (let i = 0; i < expected.length; i++) {
      await expect(date(page)).toHaveText(expected[i]);
      if (i < expected.length - 1) await page.getByRole('button', { name: nextName }).click();
    }
  }

  test('FR-7 the date of every event is written in full in Finnish', async ({ page }) => {
    await page.goto('./');
    await stepThrough(page, FI, 'Seuraava');
  });

  test('FR-7 the date of every event is written in full in English, with the right endings', async ({ page }) => {
    await page.goto('./#/?lang=en');
    await stepThrough(page, EN, 'Next');
  });

  test('FR-7 the date changes when the language is switched, without changing the event', async ({ page }) => {
    await page.goto('./#/event/6050-2-003-01-split');
    await expect(date(page)).toHaveText('K.A. 6050, Kevään 3. päivä');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(date(page)).toHaveText('TE 6050, 3rd of Spring');
    await expect(page).toHaveURL(/#\/event\/6050-2-003-01-split\?lang=en$/);
  });
});

test.describe('event text (B-10)', () => {
  const panel = (page: Page) => page.getByRole('region', { name: /^(Tapahtuma|Event)$/ });

  test('FR-9 the text follows the language switch', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-01-first');
    await expect(panel(page)).toContainText('Ensimmäisen tapahtuman teksti.');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect(panel(page)).toContainText('The text of the first event.');
    await expect(panel(page)).not.toContainText('Ensimmäisen tapahtuman teksti.');
    await expect(panel(page)).not.toContainText('Not available in this language');
  });

  test('FR-9 an event with no English text shows the Finnish text with the note', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second?lang=en');
    await expect(panel(page)).toContainText('Not available in this language');
    await expect(panel(page)).toContainText('Toinen kappale.');
    await expect(panel(page).locator('em')).toHaveText('korostettu');
  });

  test('FR-9 stepping from a translated event to an untranslated one, and back, adds and removes the note', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-01-first?lang=en');
    await expect(panel(page)).not.toContainText('Not available in this language');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(panel(page)).toContainText('Not available in this language');
    await page.getByRole('button', { name: 'Previous' }).click();
    await expect(panel(page)).not.toContainText('Not available in this language');
  });

  test('FR-9 the note is shown in the language of the interface', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second?lang=fi');
    await expect(panel(page)).not.toContainText('Ei saatavilla tällä kielellä');
  });

  test('FR-1 a long event text scrolls inside the panel, and the map keeps its place', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    await expect(panel(page)).toBeVisible();
    const map = (await page.locator('.leaflet-container').boundingBox())!;
    const box = (await panel(page).boundingBox())!;
    expect(map.y + map.height).toBeLessThanOrEqual(box.y + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
  });
});

test.describe('the position of the stepping buttons (BUG-5)', () => {
  const IDS = [
    '6050-1-001-01-first', '6050-1-001-02-second', '6050-1-9-01-ninth', '6050-1-10-01-on-second-map',
    '6050-2-003-01-split', '6050-2-070-01-standalone', '6050-3-001-01-jump',
  ];
  const where = async (page: Page) => {
    const previous = (await page.getByRole('button', { name: /^(Edellinen|Previous)$/ }).boundingBox())!;
    const next = (await page.getByRole('button', { name: /^(Seuraava|Next)$/ }).boundingBox())!;
    return [previous.x, previous.y, next.x, next.y].map(Math.round);
  };

  test('FR-2 the buttons stay in the same place for every event, with or without a location line', async ({ page }) => {
    await page.goto(`./#/event/${IDS[0]}`);
    await expect(title(page)).toBeVisible();
    const first = await where(page);
    for (const id of IDS) {
      await page.goto(`./#/event/${id}`);
      await expect(title(page)).toBeVisible();
      expect(await where(page), id).toEqual(first);
    }
  });

  test('FR-2 the buttons do not move while stepping, so Next can be clicked again and again', async ({ page }) => {
    await page.goto(`./#/event/${IDS[0]}`);
    const first = await where(page);
    for (let i = 1; i < IDS.length; i++) {
      await page.getByRole('button', { name: 'Seuraava' }).click();
      await expect(page).toHaveURL(new RegExp(`#/event/${IDS[i]}`));
      expect(await where(page), IDS[i]).toEqual(first);
    }
  });

  test('FR-2 the buttons stay in the same place in English, with the note for a missing translation', async ({ page }) => {
    await page.goto(`./#/event/${IDS[0]}`);
    const first = await where(page);
    await page.goto(`./#/event/${IDS[1]}?lang=en`); // no English text: the panel has the note line
    await expect(page.getByRole('region', { name: 'Event' })).toContainText('Not available in this language');
    // The labels are of another width in English, so the right button moves sideways. The rows do not move.
    const now = await where(page);
    expect([now[0], now[1], now[3]]).toEqual([first[0], first[1], first[3]]);
  });

  test('FR-2 a long text scrolls under the buttons, which stay in view', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 320 });
    await page.goto(`./#/event/${IDS[1]}`);
    await expect(title(page)).toBeVisible();
    const before = await where(page);
    const panel = page.getByRole('region', { name: 'Tapahtuma' });
    const box = (await panel.boundingBox())!;
    const buttons = (await page.getByRole('button', { name: 'Seuraava' }).boundingBox())!;
    expect(buttons.y + buttons.height).toBeLessThanOrEqual(box.y + box.height + 1);
    // The text is longer than the small panel, and scrolling it does not move the buttons.
    const scroller = panel.locator('[class*="content"]');
    await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    expect(await where(page)).toEqual(before);
  });
});
