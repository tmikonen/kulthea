import { describe, expect, it } from 'vitest';
import type { EventDef, LocationDef } from '../../src/content/types';
import { dotsFor } from '../../src/map/markers';
import { eventPlaceOn, placeName, visitedPlaces } from '../../src/map/places';
import { focusCenter, focusLevel, isInView, VIEW_MARGIN } from '../../src/map/view';

const event = (extra: Partial<EventDef> = {}): EventDef => ({
  id: 'e', year: 6050, month: 1, day: 1, order: 1, title: 'E', text: {},
  location: null, position: null, showOn: null, track: null, newSegment: false, ...extra,
});

const loc = (id: string, positions: Record<string, [number, number]>): LocationDef => ({ id, name: id, positions });
// Locations: a is on the main map and on `other`, b is only on `other`, c is only on `third`, m is only on the main map.
const locations: LocationDef[] = [
  loc('a', { main: [10, 20], other: [11, 21] }),
  loc('b', { other: [1, 2] }),
  loc('c', { third: [7, 8] }),
  loc('m', { main: [50, 50] }),
];

describe('an event\'s place on a map (B-13, B-34)', () => {
  it('FR-1 on the main map it is the main-map location', () => {
    expect(eventPlaceOn(event({ location: 'a', position: [10, 20] }), 'main', 'main', locations))
      .toEqual({ position: [10, 20], location: 'a' });
  });

  it('FR-1 on the main map a one-off position has no location', () => {
    expect(eventPlaceOn(event({ position: [5, 6] }), 'main', 'main', locations)).toEqual({ position: [5, 6], location: null });
  });

  it('FR-3 on the main map an n/a event has no place, even if its showOn location has a main position', () => {
    const e = event({ showOn: { map: 'other', location: 'a', position: [11, 21] } });
    expect(eventPlaceOn(e, 'main', 'main', locations)).toBeNull();
  });

  it('FR-3 on the showOn map it is the showOn place', () => {
    const e = event({ location: 'm', position: [50, 50], showOn: { map: 'other', location: 'b', position: [1, 2] } });
    expect(eventPlaceOn(e, 'other', 'main', locations)).toEqual({ position: [1, 2], location: 'b' });
  });

  it('FR-3 a one-off showOn position has no location', () => {
    const e = event({ showOn: { map: 'other', location: null, position: [3, 4] } });
    expect(eventPlaceOn(e, 'other', 'main', locations)).toEqual({ position: [3, 4], location: null });
  });

  it('FR-3 the showOn place wins over a position that the event\'s own location has on that map', () => {
    // a has a position on `other`, but the event says explicitly where it is shown there.
    const e = event({ location: 'a', position: [10, 20], showOn: { map: 'other', location: 'b', position: [1, 2] } });
    expect(eventPlaceOn(e, 'other', 'main', locations)).toEqual({ position: [1, 2], location: 'b' });
  });

  it('FR-1 on another map the place is the position of the event\'s location there', () => {
    const e = event({ location: 'a', position: [10, 20] });
    expect(eventPlaceOn(e, 'other', 'main', locations)).toEqual({ position: [11, 21], location: 'a' });
  });

  it('FR-1 on another map the showOn location counts too, after the main location', () => {
    const onlyShowOn = event({ showOn: { map: 'other', location: 'c', position: [1, 1] } });
    expect(eventPlaceOn(onlyShowOn, 'third', 'main', locations)).toEqual({ position: [7, 8], location: 'c' });
    const both = event({ location: 'a', position: [10, 20], showOn: { map: 'third', location: 'c', position: [7, 8] } });
    expect(eventPlaceOn(both, 'other', 'main', locations)).toEqual({ position: [11, 21], location: 'a' });
  });

  it('FR-1 on another map an event whose locations have no position there has no place', () => {
    expect(eventPlaceOn(event({ location: 'm', position: [50, 50] }), 'other', 'main', locations)).toBeNull();
    expect(eventPlaceOn(event({ location: 'a', position: [10, 20] }), 'third', 'main', locations)).toBeNull();
  });

  it('FR-1 a one-off position gives a place only on its own map', () => {
    expect(eventPlaceOn(event({ position: [5, 6] }), 'other', 'main', locations)).toBeNull();
    const e = event({ showOn: { map: 'other', location: null, position: [3, 4] } });
    expect(eventPlaceOn(e, 'third', 'main', locations)).toBeNull();
  });

  it('FR-1 an unknown location id gives no place', () => {
    expect(eventPlaceOn(event({ location: 'zzz', position: [1, 1] }), 'other', 'main', locations)).toBeNull();
  });

  it('FR-3 an event with no locations at all has no place on another map', () => {
    expect(eventPlaceOn(event(), 'other', 'main', locations)).toBeNull();
  });
});

describe('the name of a place (B-13)', () => {
  const named: LocationDef[] = [
    { id: 'a', name: { fi: 'Aa', en: 'Ay' }, positions: {} },
    { id: 'b', name: 'Bee', positions: {} },
  ];

  it('FR-9 is the name of the location, in the chosen language with the default as the fallback', () => {
    expect(placeName({ position: [1, 1], location: 'a' }, named, 'en', 'fi')).toBe('Ay');
    expect(placeName({ position: [1, 1], location: 'b' }, named, 'en', 'fi')).toBe('Bee');
  });

  it('FR-1 is null for a one-off position', () => {
    expect(placeName({ position: [1, 1], location: null }, named, 'fi', 'fi')).toBeNull();
  });
});

describe('whether the view has to move (B-13)', () => {
  const size = { x: 1000, y: 500 };

  it('FR-1 a point well inside the visible area is in view', () => {
    expect(isInView({ x: 500, y: 250 }, size)).toBe(true);
  });

  it('FR-1 a point outside the visible area is not in view, in each direction', () => {
    expect(isInView({ x: -10, y: 250 }, size)).toBe(false);
    expect(isInView({ x: 1010, y: 250 }, size)).toBe(false);
    expect(isInView({ x: 500, y: -10 }, size)).toBe(false);
    expect(isInView({ x: 500, y: 510 }, size)).toBe(false);
  });

  it('FR-1 a point closer to the edge than the margin is not in view, and one at the margin is', () => {
    expect(isInView({ x: VIEW_MARGIN - 1, y: 250 }, size)).toBe(false);
    expect(isInView({ x: VIEW_MARGIN, y: 250 }, size)).toBe(true);
    expect(isInView({ x: 1000 - VIEW_MARGIN, y: 250 }, size)).toBe(true);
    expect(isInView({ x: 500, y: 500 - VIEW_MARGIN + 1 }, size)).toBe(false);
  });

  it('FR-1 a margin of zero counts the whole container', () => {
    expect(isInView({ x: 0, y: 0 }, size, 0)).toBe(true);
    expect(isInView({ x: 1000, y: 500 }, size, 0)).toBe(true);
  });
});

describe('visited places (B-14)', () => {
  const at = (location: string | null, position: [number, number], extra: Partial<EventDef> = {}) =>
    event({ id: `${location}${position}`, location, position, ...extra });
  const other = (location: string | null, position: [number, number], extra: Partial<EventDef> = {}) =>
    event({ id: `other${position}`, showOn: { map: 'other', location, position }, ...extra });

  it('FR-1 the first event has no visited places', () => {
    expect(visitedPlaces([at('a', [1, 1])], 0, 'main', 'main', [])).toEqual([]);
  });

  it('FR-1 lists the places of the earlier events in date order, and not the current or later ones', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('c', [3, 3]), at('d', [4, 4])];
    expect(visitedPlaces(events, 2, 'main', 'main', []).map((p) => p.location)).toEqual(['a', 'b']);
  });

  it('FR-1 stepping back drops the places again: the result depends only on the current event', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('c', [3, 3])];
    expect(visitedPlaces(events, 2, 'main', 'main', [])).toHaveLength(2);
    expect(visitedPlaces(events, 1, 'main', 'main', [])).toHaveLength(1);
    expect(visitedPlaces(events, 0, 'main', 'main', [])).toHaveLength(0);
  });

  it('FR-1 a place visited by several events is listed once', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('a', [1, 1]), at('c', [3, 3])];
    expect(visitedPlaces(events, 3, 'main', 'main', []).map((p) => p.location)).toEqual(['a', 'b']);
  });

  it('FR-1 the place of the current event is not a dot, even when earlier events were there', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('a', [1, 1])];
    expect(visitedPlaces(events, 2, 'main', 'main', []).map((p) => p.location)).toEqual(['b']);
  });

  it('FR-8 standalone events count, and one-off positions are places of their own', () => {
    const events = [
      at('a', [1, 1], { track: 'none' }),
      at(null, [5, 5]),
      at(null, [5, 5]),
      at(null, [6, 6]),
      at('z', [9, 9]),
    ];
    expect(visitedPlaces(events, 4, 'main', 'main', []).map((p) => p.position)).toEqual([[1, 1], [5, 5], [6, 6]]);
  });

  it('FR-3 an event with no place on the map adds nothing there', () => {
    const events = [at('a', [1, 1]), other('x', [8, 8]), at('b', [2, 2])];
    expect(visitedPlaces(events, 2, 'main', 'main', []).map((p) => p.location)).toEqual(['a']);
    expect(visitedPlaces(events, 2, 'other', 'main', []).map((p) => p.location)).toEqual(['x']);
  });

  it('FR-1 on another map only the places that were on that map count', () => {
    const events = [at('a', [1, 1]), other('x', [8, 8]), other('y', [9, 9]), at('b', [2, 2])];
    expect(visitedPlaces(events, 3, 'other', 'main', []).map((p) => p.location)).toEqual(['x', 'y']);
    expect(visitedPlaces(events, 3, 'third', 'main', [])).toEqual([]);
  });

  it('FR-1 a manually viewed map where the current event has no place still shows the earlier places', () => {
    const events = [other('x', [8, 8]), at('a', [1, 1]), other('y', [9, 9]), at('b', [2, 2])];
    expect(visitedPlaces(events, 3, 'other', 'main', []).map((p) => p.location)).toEqual(['x', 'y']);
  });

  it('FR-1 an index outside the events gives nothing, or only what is before it', () => {
    const events = [at('a', [1, 1])];
    expect(visitedPlaces(events, -1, 'main', 'main', [])).toEqual([]);
    expect(visitedPlaces([], 0, 'main', 'main', [])).toEqual([]);
  });

  describe('with places taken from locations (B-34)', () => {
    // a is on the main map and on `other`; b only on `other`.
    const known: LocationDef[] = [
      { id: 'a', name: 'a', positions: { main: [1, 1], other: [11, 11] } },
      { id: 'b', name: 'b', positions: { other: [12, 12] } },
      { id: 'c', name: 'c', positions: { main: [3, 3], other: [13, 13] } },
    ];

    it('FR-1 a place visited by an event on the main map is also a dot on another map where its location has a position', () => {
      const events = [at('a', [1, 1]), at('c', [3, 3]), at('a', [1, 1]), at('m', [9, 9])];
      expect(visitedPlaces(events, 3, 'other', 'main', known).map((p) => [p.location, p.position]))
        .toEqual([['a', [11, 11]], ['c', [13, 13]]]);
    });

    it('FR-1 the place of the current event is not a dot, whichever map it comes from', () => {
      const events = [at('a', [1, 1]), at('c', [3, 3])];
      expect(visitedPlaces(events, 1, 'other', 'main', known).map((p) => p.location)).toEqual(['a']);
    });

    it('FR-1 a location with no position on the map gives no dot there', () => {
      const events = [at('a', [1, 1]), at('m', [9, 9]), at('c', [3, 3])];
      expect(visitedPlaces(events, 2, 'other', 'main', known).map((p) => p.location)).toEqual(['a']);
    });

    it('FR-1 a place visited by an event shown on another map is a dot on the main map when it is placed there too', () => {
      const events = [
        event({ id: '1', location: 'a', position: [1, 1], showOn: { map: 'other', location: 'b', position: [12, 12] } }),
        event({ id: '2', location: 'c', position: [3, 3] }),
      ];
      expect(visitedPlaces(events, 1, 'main', 'main', known).map((p) => p.location)).toEqual(['a']);
      expect(visitedPlaces(events, 1, 'other', 'main', known).map((p) => p.location)).toEqual(['b']);
    });

    it('FR-3 an event that is n/a on the main map is not a dot there, though its showOn location has a main position', () => {
      const events = [
        event({ id: '1', showOn: { map: 'other', location: 'a', position: [11, 11] } }),
        event({ id: '2', location: 'c', position: [3, 3] }),
      ];
      expect(visitedPlaces(events, 1, 'main', 'main', known)).toEqual([]);
    });
  });
});

describe('dots for visited places (B-14)', () => {
  const locations: LocationDef[] = [{ id: 'a', name: { fi: 'Aa', en: 'Ay' }, positions: {} }];

  it('FR-9 a named place has its name in the chosen language, and a one-off position has none', () => {
    const places = [{ position: [1, 1] as [number, number], location: 'a' }, { position: [2, 2] as [number, number], location: null }];
    expect(dotsFor(places, locations, 'en', 'fi')).toEqual([
      { id: '1,1', label: 'Ay', position: [1, 1] },
      { id: '2,2', label: null, position: [2, 2] },
    ]);
  });
});

describe('the focused view (B-33)', () => {
  it('FR-1 is the fitted zoom plus the steps of zoom, each a zoom delta', () => {
    expect(focusLevel(-1.5, 2, 0.5, 2)).toBe(-0.5);
    expect(focusLevel(3, 4, 0.5, 8)).toBe(5);
    expect(focusLevel(0, 1, 1, 8)).toBe(1);
  });

  it('FR-1 does not go beyond the maximum zoom', () => {
    expect(focusLevel(1, 10, 0.5, 2)).toBe(2);
  });

  it('FR-1 with no steps it is the fitted zoom', () => {
    expect(focusLevel(-1.5, 0, 0.5, 2)).toBe(-1.5);
  });

  const image = { minX: 0, minY: 0, maxX: 2000, maxY: 1000 };
  const view = { x: 400, y: 200 };

  it('FR-1 centres the view on the target when the image allows it', () => {
    expect(focusCenter({ x: 1000, y: 500 }, image, view)).toEqual({ x: 1000, y: 500 });
  });

  it('FR-1 keeps the view inside the image when the target is near an edge', () => {
    expect(focusCenter({ x: 20, y: 30 }, image, view)).toEqual({ x: 200, y: 100 });
    expect(focusCenter({ x: 1990, y: 990 }, image, view)).toEqual({ x: 1800, y: 900 });
  });

  it('FR-1 keeps a target that is at an edge inside the view', () => {
    const centre = focusCenter({ x: 0, y: 1000 }, image, view);
    expect(Math.abs(centre.x - 0)).toBeLessThanOrEqual(view.x / 2);
    expect(Math.abs(centre.y - 1000)).toBeLessThanOrEqual(view.y / 2);
  });

  it('FR-1 centres an image that is smaller than the view, in that direction', () => {
    expect(focusCenter({ x: 10, y: 500 }, { minX: 0, minY: 0, maxX: 300, maxY: 1000 }, view)).toEqual({ x: 150, y: 500 });
    expect(focusCenter({ x: 1000, y: 5 }, { minX: 0, minY: 0, maxX: 2000, maxY: 100 }, view)).toEqual({ x: 1000, y: 50 });
  });

  it('FR-1 works with an image that does not start at zero', () => {
    expect(focusCenter({ x: -500, y: -300 }, { minX: -1000, minY: -600, maxX: 1000, maxY: 600 }, view))
      .toEqual({ x: -500, y: -300 });
  });
});
