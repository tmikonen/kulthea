import { test, expect, type Page } from '@playwright/test';

// These tests run on a site built from tests/fixtures-routes: a main map, a second map that shows only
// the current visit (the default for a map that is not the main one) and a third map that keeps its
// history (routes: "history"). The events, in date order, with their places in percent:
//   p1 (10,10)  p2 (30,20)  p3 (50,60)  standalone (90,90)  p4 (70,30)
//   n1 (20,20 on the second map)  n2 (80,60 on the second map)      [n/a on the main map]
//   p5 (40,40)  jump (60,70, new segment)  p6 (80,80)
//   n3 (50,10 on the second map)
//   h1 (20,20 on the third map)  h2 (60,60)   p7 (30,30)   h3 (80,20)  h4 (90,90)
//   o1 (20,20 on the fourth map, an overview)  p8 (50,50)  o2 (60,60)  j2 (80,20, new segment)  o3 (90,50)

const ID = {
  p1: '6050-1-001-01-p1', p2: '6050-1-002-01-p2', p3: '6050-1-003-01-p3', standalone: '6050-1-004-01-standalone',
  p4: '6050-1-005-01-p4', n1: '6050-1-006-01-n1', n2: '6050-1-007-01-n2', p5: '6050-1-008-01-p5',
  jump: '6050-1-009-01-jump', p6: '6050-1-010-01-p6', n3: '6050-1-011-01-n3', h1: '6050-1-012-01-h1',
  h2: '6050-1-013-01-h2', p7: '6050-1-014-01-p7', h3: '6050-1-015-01-h3', h4: '6050-1-016-01-h4',
  o1: '6050-1-017-01-o1', p9: '6050-1-022-01-p9', g1: '6050-1-023-01-g1', m1: '6050-1-024-01-m1',
  p10: '6050-1-025-01-p10', g2: '6050-1-026-01-g2', p11: '6050-1-027-01-p11', p8: '6050-1-018-01-p8', o2: '6050-1-019-01-o2', j2: '6050-1-020-01-j2', o3: '6050-1-021-01-o3',
};

type Point = [number, number];
const P: Record<string, Point> = {
  p9: [10, 90], g1: [30, 80], m1: [60, 90], p10: [50, 70], g2: [40, 60], p11: [70, 70],
  p1: [10, 10], p2: [30, 20], p3: [50, 60], p4: [70, 30], p5: [40, 40], jump: [60, 70], p6: [80, 80],
  n1: [20, 20], n2: [80, 60], n3: [50, 10], h1: [20, 20], h2: [60, 60], h3: [80, 20], h4: [90, 90],
  o1: [20, 20], o2: [60, 60], j2: [80, 20], o3: [90, 50],
};

const routeLines = (page: Page) => page.locator('path.route-line');
const groupLines = (page: Page) => page.locator('path.route-group');
const image = (page: Page) => page.locator('img.leaflet-image-layer');
const next = (page: Page) => page.getByRole('button', { name: 'Seuraava' });
const previous = (page: Page) => page.getByRole('button', { name: 'Edellinen' });
const open = async (page: Page, id: string, query = '') => {
  await page.goto(`./#/event/${id}${query}`);
  await expect(page.getByRole('region', { name: 'Tapahtuma' })).toBeVisible();
  await expect(image(page)).toBeVisible();
};

interface Box { x: number; y: number; width: number; height: number }

/** The box that a line through the points should have on the screen, from the image's box. */
async function expectedBox(page: Page, points: Point[]): Promise<Box | null> {
  const img = await image(page).boundingBox();
  if (!img) return null; // the map is being created, for example after a reload
  const xs = points.map(([x]) => img.x + (img.width * x) / 100);
  const ys = points.map(([, y]) => img.y + (img.height * y) / 100);
  // The box of a drawn line includes half of the line's width (4 px) on every side.
  const half = 2;
  return {
    x: Math.min(...xs) - half,
    y: Math.min(...ys) - half,
    width: Math.max(...xs) - Math.min(...xs) + 2 * half,
    height: Math.max(...ys) - Math.min(...ys) + 2 * half,
  };
}

const sortBoxes = (boxes: Box[]) => [...boxes].sort((a, b) => a.x - b.x || a.y - b.y || a.width - b.width);

/** Waits until the lines on the map are exactly the lines through the given points, each at its place. */
async function expectLines(page: Page, expected: Point[][], lines = routeLines) {
  await expect.poll(async () => {
    const count = await lines(page).count();
    if (count !== expected.length) return `${count} lines, not ${expected.length}`;
    const actual: Box[] = [];
    for (let i = 0; i < count; i++) {
      const box = await lines(page).nth(i).boundingBox();
      if (!box) return 'a line is not drawn yet';
      actual.push(box);
    }
    const boxes = await Promise.all(expected.map((points) => expectedBox(page, points)));
    if (boxes.some((box) => box === null)) return 'no map yet';
    const a = sortBoxes(actual);
    const w = sortBoxes(boxes as Box[]);
    for (let i = 0; i < a.length; i++) {
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        if (Math.abs(a[i][key] - w[i][key]) > 3) return `line ${i} ${key}: ${Math.round(a[i][key])} not ${Math.round(w[i][key])}`;
      }
    }
    return 'ok';
  }, { timeout: 8000 }).toBe('ok');
}

test.describe('the party route (B-17)', () => {
  test('FR-5 the line grows with each step on the main map, and stepping back shortens it', async ({ page }) => {
    await open(page, ID.p1);
    await expectLines(page, []);
    await next(page).click();
    await expectLines(page, [[P.p1, P.p2]]);
    await next(page).click();
    await expectLines(page, [[P.p1, P.p2, P.p3]]);
    await previous(page).click();
    await expectLines(page, [[P.p1, P.p2]]);
    await previous(page).click();
    await expectLines(page, []);
  });

  test('FR-5 a standalone event is not part of the line: it goes straight past it', async ({ page }) => {
    await open(page, ID.standalone);
    await expectLines(page, [[P.p1, P.p2, P.p3]]);
    await next(page).click();
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
  });

  test('FR-5 an event with no place on the main map breaks the route there, and the earlier route stays', async ({ page }) => {
    await open(page, ID.n1, '?map=main-map');
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    await expect(page.locator('path.current-marker')).toHaveCount(0);
  });

  test('FR-5 on the second map the line is the current visit, and it grows as the party moves there', async ({ page }) => {
    await open(page, ID.n1);
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expectLines(page, []); // a visit of one event has no line
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(ID.n2));
    await expectLines(page, [[P.n1, P.n2]]);
  });

  test('FR-5 once the party has left the second map, no line is shown there, and the visited places stay as dots', async ({ page }) => {
    await open(page, ID.p5, '?map=second-map');
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expectLines(page, []);
    await expect(page.locator('path.visited-dot')).toHaveCount(2);
  });

  test('FR-5 on the main map the whole route stays, and the party coming back starts a new segment', async ({ page }) => {
    await open(page, ID.p5);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]); // p5 is alone, so it has no line yet
  });

  test('FR-5 a new segment leaves a gap, and the line goes on from the jump', async ({ page }) => {
    await open(page, ID.jump);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(ID.p6));
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4], [P.jump, P.p6]]);
    // There is no line from p5 to the jump, or from p4 to p5.
    await previous(page).click();
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
  });

  test('FR-5 a second visit to the second map shows only itself, not the first visit', async ({ page }) => {
    await open(page, ID.n3);
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expectLines(page, []);
    // The places of both visits are dots, apart from the current one.
    await expect(page.locator('path.visited-dot')).toHaveCount(2);
  });

  test('FR-5 a map that keeps its history shows every visit, also after the party has left', async ({ page }) => {
    await open(page, ID.h2);
    await expect(image(page)).toHaveAttribute('src', /second-map/); // the third map's image is the same file
    await expectLines(page, [[P.h1, P.h2]]);
    await open(page, ID.p7, '?map=third-map');
    await expectLines(page, [[P.h1, P.h2]]); // the party is on the main map, but this map keeps its history
    await open(page, ID.h4);
    await expectLines(page, [[P.h1, P.h2], [P.h3, P.h4]]);
  });

  test('FR-5 the lines are the same however the event is reached', async ({ page }) => {
    await open(page, ID.p1);
    for (let i = 0; i < 4; i++) await next(page).click(); // p2, p3, standalone, p4
    await expect(page).toHaveURL(new RegExp(ID.p4));
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    await open(page, ID.p4);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    await page.reload();
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
  });

  test('FR-5 a manual map switch shows the lines of that map by its own rule', async ({ page }) => {
    await open(page, ID.p4);
    await page.getByRole('button', { name: 'Second Map' }).click();
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expectLines(page, []); // the party's latest event is not on the second map
    await page.getByRole('button', { name: 'Pääkartta' }).click();
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
  });

  test('FR-5 the line is solid and brown, thinner than the current marker, and below the dots and the marker', async ({ page }) => {
    await open(page, ID.p4);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    const style = await page.evaluate(() => {
      const line = document.querySelector('path.route-line')!;
      const css = getComputedStyle(line);
      const z = (selector: string) => Number(getComputedStyle(document.querySelector(selector)!.closest('.leaflet-pane')!).zIndex);
      return {
        stroke: css.stroke, dash: line.getAttribute('stroke-dasharray'), width: parseFloat(css.strokeWidth),
        routePane: z('path.route-line'), dotPane: z('path.visited-dot'), markerPane: z('path.current-marker'),
      };
    });
    expect(style.stroke).toBe('rgb(160, 82, 45)');
    expect(style.dash).toBeNull();
    const marker = (await page.locator('path.current-marker').boundingBox())!;
    expect(style.width).toBeLessThan(marker.width / 2);
    expect(style.routePane).toBeLessThan(style.dotPane);
    expect(style.dotPane).toBeLessThan(style.markerPane);
  });

  test('FR-5 the lines do not take the pointer, so the dots under them can still be hovered', async ({ page }) => {
    await open(page, ID.p4);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    expect(await page.locator('path.route-line.leaflet-interactive').count()).toBe(0);
  });

  test('FR-5 the lines stay at their places when the language changes, the map is zoomed in, and the window is resized', async ({ page }) => {
    await open(page, ID.p4);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(500);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.waitForTimeout(600);
    await expectLines(page, [[P.p1, P.p2, P.p3, P.p4]]);
  });
});

test.describe('an overview map (BUG-6)', () => {
  test('FR-5 the route on an overview map goes on past events at places that are not on it', async ({ page }) => {
    // o1 and o2 are on the fourth map. Between them p8 is only on the main map, and it does not break the route.
    await open(page, ID.o1);
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expectLines(page, []);
    await open(page, ID.o2, '?map=fourth-map');
    await expectLines(page, [[P.o1, P.o2]]);
  });

  test('FR-5 on the overview map the whole route stays, and a new segment starts a new line', async ({ page }) => {
    await open(page, ID.j2);
    await expectLines(page, [[P.o1, P.o2]]); // j2 starts a new segment, and is alone so far
    await next(page).click();
    await expect(page).toHaveURL(new RegExp(ID.o3));
    await expectLines(page, [[P.o1, P.o2], [P.j2, P.o3]]);
    await previous(page).click();
    await expectLines(page, [[P.o1, P.o2]]);
  });

  test('FR-5 events that are not on the overview map do not break its route, even when the current event is one of them', async ({ page }) => {
    await open(page, ID.p8, '?map=fourth-map');
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expectLines(page, []); // o1 alone so far
    await open(page, ID.p7, '?map=fourth-map');
    await expectLines(page, []);
  });

  test('FR-5 the same events break the route on a map that shows only the current visit', async ({ page }) => {
    // On the main map p8 is placed, so it is part of the main route and there is no break on it.
    await open(page, ID.o2, '?map=second-map');
    await expectLines(page, []);
  });

  test('FR-5 the lines of an overview map look like the others', async ({ page }) => {
    await open(page, ID.o2, '?map=fourth-map');
    await expectLines(page, [[P.o1, P.o2]]);
    const stroke = await page.evaluate(() => getComputedStyle(document.querySelector('path.route-line')!).stroke);
    expect(stroke).toBe('rgb(160, 82, 45)');
  });
});

test.describe('split group routes (B-19)', () => {
  // On the main map: p9, then the group scout goes g1 (the party's last event before it is p9), the group
  // mage goes m1, the party goes p10, scout goes g2, and the party p11. Scout rejoins at p11, mage at p10.
  const scout = (page: Page) => page.locator('path.route-group[stroke="#6b7f2a"]');
  const mage = (page: Page) => page.locator('path.route-group[stroke="#b8860b"]');

  test('FR-5 a group\'s line starts at the party\'s place where it split, grows with its events and meets the party where it rejoins', async ({ page }) => {
    await open(page, ID.p9);
    await expectLines(page, [], groupLines);
    await next(page).click();
    await expectLines(page, [[P.p9, P.g1]], scout);
    await next(page).click(); // m1: the second group
    await expectLines(page, [[P.p9, P.g1]], scout);
    await expectLines(page, [[P.p9, P.m1]], mage);
    await next(page).click(); // p10: mage rejoins, scout goes on
    await expectLines(page, [[P.p9, P.m1, P.p10]], mage);
    await expectLines(page, [[P.p9, P.g1]], scout);
    await next(page).click(); // g2
    await expectLines(page, [[P.p9, P.g1, P.g2]], scout);
    await next(page).click(); // p11: scout rejoins
    await expectLines(page, [[P.p9, P.g1, P.g2, P.p11]], scout);
    await previous(page).click();
    await expectLines(page, [[P.p9, P.g1, P.g2]], scout);
  });

  test('FR-5 a group\'s line is dashed, in its own colour, and the party\'s is solid brown', async ({ page }) => {
    await open(page, ID.p11);
    await expectLines(page, [[P.p9, P.g1, P.g2, P.p11], [P.p9, P.m1, P.p10]], groupLines);
    await expect(scout(page)).toHaveAttribute('stroke-dasharray', /\d/);
    await expect(mage(page)).toHaveAttribute('stroke-dasharray', /\d/);
    const party = page.locator('path.route-party').last();
    await expect(party).toHaveAttribute('stroke', '#a0522d');
    await expect(party).not.toHaveAttribute('stroke-dasharray', /\d/);
  });

  test('FR-5 the group lines are drawn below the party line and below the dots', async ({ page }) => {
    await open(page, ID.p11);
    await expectLines(page, [[P.p9, P.g1, P.g2, P.p11], [P.p9, P.m1, P.p10]], groupLines);
    const z = (name: string) => page.locator(`.leaflet-${name}-pane`).evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(await z('group-routes')).toBeLessThan(await z('routes'));
    expect(await z('routes')).toBeLessThan(await z('visited-places'));
  });

  test('FR-5 on the second map, where the party is not, no group line is shown', async ({ page }) => {
    await open(page, ID.p11, '?map=second-map');
    await expect(image(page)).toHaveAttribute('src', /second-map/);
    await expectLines(page, [], groupLines);
  });
});
