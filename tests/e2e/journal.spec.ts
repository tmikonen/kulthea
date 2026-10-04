import { test, expect, type Page } from '@playwright/test';
import { settled } from './helpers';

const FIRST = '6050-1-001-01-first';
const panel = (page: Page) => page.getByRole('complementary', { name: /^(Päiväkirja|Journal)$/ });
const button = (page: Page) => page.getByRole('button', { name: /^(Päiväkirja|Journal)$/ });
const image = (page: Page) => page.locator('img.leaflet-image-layer');

async function open(page: Page, query = '') {
  await page.goto(`./#/event/${FIRST}${query}`);
  await expect(page.getByRole('region', { name: /^(Tapahtuma|Event)$/ })).toBeVisible();
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

  test('FR-6 the journal button closes the panel when it is open, and back then reopens it', async ({ page }) => {
    await open(page);
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await button(page).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));
    await page.goBack();
    await expect(panel(page)).toBeVisible();
  });

  test('FR-6 the back button closes a panel that was just opened, and after closing it brings it back', async ({ page }) => {
    await open(page);
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));

    await button(page).click();
    await expect(panel(page)).toBeVisible();
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
    // A click during the zoom animation of the one before is ignored, so wait for each to finish.
    await page.locator('.leaflet-control-zoom-in').click();
    await settled(image(page));
    await page.locator('.leaflet-control-zoom-in').click();
    const before = await settled(image(page));
    const area = await page.locator('.leaflet-container').boundingBox();
    expect(before!.width).toBeGreaterThan(area!.width); // zoomed in

    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await settled(panel(page)); // the slide has ended
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
    const box = await settled(panel(page)); // the slide has ended
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

  test('FR-6 while the panel slides in, the page under it does not move and does not get a horizontal scroll bar (BUG-8)', async ({ page }) => {
    await open(page);
    // Sample every animation frame from just before the click until the slide has ended.
    await page.evaluate(() => {
      const box = (selector: string) => {
        const r = document.querySelector(selector)!.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      };
      const sample = () => ({
        scrollX: window.scrollX,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        header: box('header'),
        map: box('.leaflet-container'),
        event: box('section[aria-label="Tapahtuma"]'),
      });
      const w = window as unknown as { frames: ReturnType<typeof sample>[]; stop: boolean };
      w.frames = [];
      w.stop = false;
      const tick = () => {
        w.frames.push(sample());
        if (!w.stop) requestAnimationFrame(tick);
      };
      tick();
    });
    await page.waitForTimeout(100);
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await settled(panel(page)); // the slide has ended
    const frames = await page.evaluate(() => {
      const w = window as unknown as { frames: unknown[]; stop: boolean };
      w.stop = true;
      return w.frames as { scrollX: number; overflow: number; header: number[]; map: number[]; event: number[] }[];
    });
    expect(frames.length).toBeGreaterThan(10);
    const first = frames[0];
    for (const frame of frames) {
      expect(frame.scrollX).toBe(0);
      expect(frame.overflow).toBeLessThanOrEqual(0);
      expect(frame.header).toEqual(first.header);
      expect(frame.map).toEqual(first.map);
      expect(frame.event).toEqual(first.event);
    }
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

test.describe('journal entry view (B-22)', () => {
  const entry = (page: Page) => panel(page).locator('article');

  test('FR-6 every type opens from the index with its fields, and the link back and the back button return to the index', async ({ page }) => {
    await open(page, '?journal=index');
    for (const [link, heading, hasImage, hasMotto] of [
      ['Sankari', 'Sankari', true, true],
      ['Tiedustelija', 'Tiedustelija', false, false],
      ['Sormus', 'Sormus', false, false],
      ['Molemmat paikat', 'Molemmat paikat', true, false],
      ['Taustatarina', 'Taustatarina', false, false],
    ] as const) {
      await panel(page).getByRole('link', { name: link, exact: true }).click();
      await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText(heading);
      await expect(entry(page).locator(':scope > button img')).toHaveCount(hasImage ? 1 : 0);
      await expect(entry(page).locator('p').filter({ hasText: 'Eteenpäin.' })).toHaveCount(hasMotto ? 1 : 0);
      await page.goBack();
      await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(5);
    }
    await panel(page).getByRole('link', { name: 'Sankari' }).click();
    await entry(page).getByRole('link', { name: /Päiväkirja/ }).click();
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(5);
    await page.goBack();
    await expect(entry(page)).toBeVisible();
  });

  test('FR-6 the picture is shown, loaded, and fits the panel without scrolling sideways', async ({ page }) => {
    await open(page, '?journal=hero');
    const img = entry(page).locator(':scope > button img');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(60);
    const fits = await panel(page).evaluate((aside) => {
      const body = aside.querySelector('article')!.parentElement!;
      return body.scrollWidth <= body.clientWidth;
    });
    expect(fits).toBe(true);
    await expect(img).toHaveAttribute('alt', 'Sankari');
  });

  test('FR-9 the entry follows the language, with the fallback note for a text with no translation', async ({ page }) => {
    await open(page, '?journal=hero&lang=en');
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Hero');
    await expect(entry(page)).toContainText('Onward.');
    await expect(entry(page)).toContainText("The hero's background.");
    // Directly under the entry there is only the motto: no note, because the text is in English.
    await expect(entry(page).locator(':scope > p')).toHaveCount(1);
    await panel(page).getByRole('link', { name: /Journal/ }).click();
    // Wait for the index: the entry has links to the same name, and a locator would find them while the entry is still shown.
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveCount(5);
    await panel(page).getByRole('link', { name: 'Tiedustelija' }).click();
    await expect(entry(page)).toContainText('Vain suomeksi kirjoitettu tausta.');
    await expect(entry(page).locator(':scope > p')).toHaveText('Not available in this language');
  });

  test('FR-6 the panel starts at the top when another entry is opened', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 260 });
    await open(page, '?journal=index');
    const scroller = panel(page).locator('xpath=./div[2]');
    await scroller.evaluate((el) => { el.scrollTop = 50; });
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await panel(page).getByRole('link', { name: 'Sankari' }).click();
    await expect(entry(page)).toBeVisible();
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(0);
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  });
});

test.describe('journal links in text (B-23)', () => {
  const eventText = (page: Page) => page.getByRole('region', { name: /^(Tapahtuma|Event)$/ });
  const entry = (page: Page) => panel(page).locator('article');

  test('FR-6 a name in the event text is a link: it opens the entry over the same event, and back closes it', async ({ page }) => {
    await open(page);
    const link = eventText(page).getByRole('link', { name: 'Sankari' });
    await expect(link).toHaveAttribute('href', new RegExp(`#/event/${FIRST}\\?journal=hero$`));
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}\\?journal=hero$`));
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Sankari');
    await expect(eventText(page).getByRole('heading', { level: 2 })).toHaveText('Ensimmäinen');
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
  });

  test('FR-6 a link inside an entry replaces the content, each followed link is a step back, and the panel stays open', async ({ page }) => {
    await open(page, '?journal=hero');
    await entry(page).locator(':scope > div').first().getByRole('link', { name: 'Tiedustelija' }).click();
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Tiedustelija');
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Sankari');
    await entry(page).locator(':scope > div').first().getByRole('link', { name: 'sormus' }).click();
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Sormus');
  });

  test('FR-6 a link can be followed with the keyboard, and its address opens the same entry when visited', async ({ page }) => {
    await open(page);
    const link = eventText(page).getByRole('link', { name: 'sormus' });
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Sormus');
    await page.keyboard.press('Escape');
    const href = (await link.getAttribute('href'))!;
    await page.goto(`./${href}`);
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Sormus');
  });

  test('FR-9 the link text and the entry follow the language', async ({ page }) => {
    await open(page, '?lang=en');
    await eventText(page).getByRole('link', { name: 'Hero' }).click();
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Hero');
    await expect(page).toHaveURL(/journal=hero&lang=en$|lang=en&journal=hero$/);
  });

  test('FR-6 a link is easy to see: it is underlined and in its own colour', async ({ page }) => {
    await open(page);
    const link = eventText(page).getByRole('link', { name: 'Sankari' });
    const style = await link.evaluate((a) => {
      const s = getComputedStyle(a);
      return { color: s.color, decoration: s.textDecorationLine, body: getComputedStyle(a.parentElement!).color };
    });
    expect(style.decoration).toContain('underline');
    expect(style.color).not.toBe(style.body);
  });
});

test.describe('events listed on entries (B-24)', () => {
  const entry = (page: Page) => panel(page).locator('article');
  const list = (page: Page) => entry(page).locator('section').filter({ has: page.getByRole('heading', { level: 4, name: /^(Tapahtumat|Events)$/ }) });
  const title = (page: Page) => page.getByRole('region', { name: /^(Tapahtuma|Event)$/ }).getByRole('heading', { level: 2 });

  test('FR-6 a character lists the events that name it, with dates, and selecting one goes to it and closes the panel', async ({ page }) => {
    await open(page, '?journal=hero');
    await expect(list(page).getByRole('heading', { level: 4 })).toHaveText('Tapahtumat');
    await expect(list(page).locator('li')).toHaveText([/Ensimmäinen\s+K\.A\. 6050, Talven 1\. päivä/, /Toinen\s+K\.A\. 6050, Talven 1\. päivä/, /Yhdeksäs\s+K\.A\. 6050, Talven 9\. päivä/]);
    await list(page).getByRole('link', { name: 'Toinen' }).click();
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second$/);
    await expect(panel(page)).toHaveCount(0);
    await expect(title(page)).toHaveText('Toinen');
  });

  test('FR-9 the list is in the chosen language, and selecting an event keeps the language and drops the map', async ({ page }) => {
    await open(page, '?journal=ring&lang=en&map=second-map');
    await expect(list(page).locator('li')).toHaveText([/First\s+TE 6050, 1st of Winter/]);
    await list(page).getByRole('link', { name: 'First' }).click();
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}\\?lang=en$`));
    await expect(title(page)).toHaveText('First');
  });

  test('FR-6 a location entry lists the events held there', async ({ page }) => {
    await open(page, '?journal=both-places');
    await expect(list(page).locator('li a')).toHaveText(['Toinen', 'Yksin']);
  });

  test('FR-6 an entry that no event names has no list', async ({ page }) => {
    await open(page, '?journal=lore');
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Taustatarina');
    await expect(entry(page).getByRole('heading', { level: 4 })).toHaveCount(0);
  });

  test('FR-6 the location in the event details is a link to its entry when it has one, and plain text when not', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    const location = page.getByRole('region', { name: 'Tapahtuma' }).locator('p[class*="location"]');
    await expect(location.getByRole('link', { name: 'Molemmat paikat' })).toBeVisible();
    await location.getByRole('link').click();
    await expect(page).toHaveURL(/#\/event\/6050-1-001-02-second\?journal=both-places$/);
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Molemmat paikat');
    await expect(title(page)).toHaveText('Toinen');
    await page.goto(`./#/event/${FIRST}`);
    const plain = page.getByRole('region', { name: 'Tapahtuma' }).locator('p[class*="location"]');
    await expect(plain).toHaveText('Main Only');
    await expect(plain.getByRole('link')).toHaveCount(0);
  });
});

test.describe('character excerpts (B-25)', () => {
  const entry = (page: Page) => panel(page).locator('article');
  const campaign = (page: Page) => entry(page).locator('section').filter({ has: page.getByRole('heading', { level: 4, name: /^(Kampanjassa|In the campaign)$/ }) });

  test('FR-6 a character shows the paragraphs of the events that name it, grouped by event, and the group title goes to the event', async ({ page }) => {
    await open(page, '?journal=hero');
    await expect(campaign(page).getByRole('heading', { level: 5 })).toHaveText([/Ensimmäinen/, /Toinen/, /Yhdeksäs/]);
    await expect(campaign(page)).toContainText('Sankari saapui paikalle, ja mukana oli sormus.');
    await expect(campaign(page)).not.toContainText('Ei mainintoja');
    await campaign(page).getByRole('link', { name: 'Yhdeksäs' }).click();
    await expect(page).toHaveURL(/#\/event\/6050-1-9-01-ninth$/);
    await expect(panel(page)).toHaveCount(0);
  });

  test('FR-6 an NPC has its own excerpts, and an item has none', async ({ page }) => {
    await open(page, '?journal=scout');
    await expect(campaign(page).getByRole('heading', { level: 5 })).toHaveText([/Toinen/, /Yhdeksäs/]);
    await open(page, '?journal=ring');
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Sormus');
    await expect(entry(page).getByRole('heading', { level: 4, name: 'Kampanjassa' })).toHaveCount(0);
  });

  test('FR-9 in English the excerpts are in English, with the note for an event that has no English text', async ({ page }) => {
    await open(page, '?journal=hero&lang=en');
    await expect(campaign(page).getByRole('heading', { level: 4 })).toHaveText('In the campaign');
    const groups = campaign(page).locator('div').filter({ has: page.getByRole('heading', { level: 5 }) });
    await expect(groups.nth(0)).toContainText('Hero arrived, with a ring.');
    await expect(groups.nth(0)).not.toContainText('Not available in this language');
    await expect(groups.nth(1)).toContainText('Not available in this language');
    await expect(groups.nth(1)).toContainText('Sankari ja Tiedustelija puhuivat');
  });

  test('FR-6 a link inside an excerpt opens that entry', async ({ page }) => {
    await open(page, '?journal=hero');
    await campaign(page).getByRole('link', { name: 'Tiedustelija' }).first().click();
    await expect(entry(page).getByRole('heading', { level: 3 })).toHaveText('Tiedustelija');
  });
});

test.describe('journal-only passages (B-26)', () => {
  const entry = (page: Page) => panel(page).locator('article');

  test('FR-6 a passage is missing from the event text and present in the character\'s entry', async ({ page }) => {
    await open(page);
    const eventRegion = page.getByRole('region', { name: 'Tapahtuma' });
    await expect(eventRegion).toContainText('saapui paikalle');
    await expect(eventRegion).not.toContainText('Sankari epäili käskyä');
    await open(page, '?journal=hero');
    const group = entry(page).locator('section').first().locator('div').first();
    await expect(group).toContainText('Sankari saapui paikalle');
    await expect(group).toContainText('Sankari epäili käskyä jo tässä.');
  });

  test('FR-6 it is only in the entries it is for, and in the language of the section', async ({ page }) => {
    await open(page, '?journal=scout');
    await expect(entry(page)).not.toContainText('Sankari epäili käskyä');
    await expect(entry(page)).toContainText('Tiedustelija kuuli kaiken ja vaikeni.');
    await open(page, '?journal=hero&lang=en');
    await expect(entry(page)).toContainText('The hero doubted the order already here.');
    await expect(entry(page)).not.toContainText('Sankari epäili');
  });
});

test.describe('images in text and the viewer (B-27)', () => {
  const eventRegion = (page: Page) => page.getByRole('region', { name: /^(Tapahtuma|Event)$/ });
  const entry = (page: Page) => panel(page).locator('article');
  const viewer = (page: Page) => page.getByRole('dialog');
  const sideways = (page: Page, selector: string) =>
    page.locator(selector).first().evaluate((el) => el.scrollWidth <= el.clientWidth);

  test('FR-3 a picture in the event text is loaded from a served file, lazy, with its caption, and fits the panel', async ({ page }) => {
    await open(page);
    const figure = eventRegion(page).locator('figure');
    const img = figure.locator('img');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('loading', 'lazy');
    await expect(img).toHaveAttribute('src', /\/kulthea\/assets\/hero-.*\.png$/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(60);
    await expect(figure.locator('figcaption')).toHaveText('Sankarin kuva');
  });

  test('FR-4 a wide picture is scaled down to the panel and the panels do not scroll sideways', async ({ page }) => {
    await page.goto('./#/event/6050-1-001-02-second');
    const img = eventRegion(page).locator('figure img');
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1500);
    const box = (await img.boundingBox())!;
    const area = (await eventRegion(page).boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(area.width);
    expect(box.width).toBeLessThan(1500);
    expect(await eventRegion(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    await open(page, '?journal=lore');
    const lead = entry(page).locator('figure img');
    await expect(lead).toBeVisible();
    await expect.poll(() => lead.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(1500);
    const panelBox = (await panel(page).boundingBox())!;
    expect((await lead.boundingBox())!.width).toBeLessThanOrEqual(panelBox.width);
    expect(await sideways(page, 'aside > div:nth-of-type(2)')).toBe(true);
  });

  test('FR-3 a click opens the picture in a viewer, as large as fits and never enlarged, with the caption', async ({ page }) => {
    await open(page);
    await eventRegion(page).locator('figure img').click();
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page)).toContainText('Sankarin kuva');
    // The picture is measured once it is loaded and the layout has settled: before that its box is that of an empty image.
    await expect.poll(() => viewer(page).getByRole('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(60);
    const shown = await settled(viewer(page).getByRole('img'));
    expect(shown.width).toBeCloseTo(60, 0); // the picture is 60 px wide: not enlarged
    expect(shown.height).toBeCloseTo(40, 0);
  });

  test('FR-3 a picture larger than the window is scaled down to fit it', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 500 });
    await page.goto('./#/event/6050-1-001-02-second');
    await eventRegion(page).locator('figure img').click();
    await expect.poll(() => viewer(page).getByRole('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBe(1500);
    const shown = await settled(viewer(page).getByRole('img'));
    expect(shown.width).toBeLessThanOrEqual(700);
    expect(shown.height).toBeLessThanOrEqual(500);
    expect(shown.width).toBeGreaterThan(300);
    expect(shown.x).toBeGreaterThanOrEqual(0);
    expect(shown.y).toBeGreaterThanOrEqual(0);
  });

  test('FR-3 the viewer closes with Escape, the close button, and a click outside the picture, and focus returns to the picture', async ({ page }) => {
    await open(page);
    const img = eventRegion(page).locator('figure img');
    await img.focus();
    await page.keyboard.press('Enter');
    await expect(viewer(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(viewer(page)).toHaveCount(0);
    await expect(img).toBeFocused();

    await img.click();
    await viewer(page).getByRole('button', { name: 'Sulje kuva' }).click();
    await expect(viewer(page)).toHaveCount(0);

    await img.click();
    await expect(viewer(page)).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(viewer(page)).toHaveCount(0);
    await img.click();
    await viewer(page).getByRole('img').click();
    await expect(viewer(page)).toBeVisible();
  });

  test('FR-6 Escape closes only the viewer, and the journal panel stays open until the next Escape', async ({ page }) => {
    await open(page, '?journal=hero');
    await entry(page).locator('figure img').first().click();
    await expect(viewer(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(viewer(page)).toHaveCount(0);
    await expect(panel(page)).toBeVisible();
    await expect(page).toHaveURL(/journal=hero$/);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
  });

  test('FR-6 the lead image of an entry opens in the viewer', async ({ page }) => {
    await open(page, '?journal=hero');
    await entry(page).locator(':scope > button').click();
    await expect(viewer(page)).toBeVisible();
    await expect(viewer(page).getByRole('img')).toHaveAttribute('alt', 'Sankari');
    await page.keyboard.press('Escape');
    await expect(viewer(page)).toHaveCount(0);
  });

  test('FR-9 the alt text, the caption and the close text follow the language', async ({ page }) => {
    await open(page, '?lang=en');
    const img = eventRegion(page).locator('figure img');
    await expect(img).toHaveAttribute('alt', 'Picture of the hero');
    await expect(eventRegion(page).locator('figcaption')).toHaveText('The hero');
    await img.click();
    await expect(viewer(page).getByRole('button', { name: 'Close the picture' })).toBeVisible();
    await expect(viewer(page)).toContainText('The hero');
  });

  test('FR-3 the arrow keys do not step through the events while the viewer is open', async ({ page }) => {
    await open(page);
    await eventRegion(page).locator('figure img').click();
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(new RegExp(`#/event/${FIRST}$`));
  });
});
