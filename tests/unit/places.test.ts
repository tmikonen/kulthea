import { describe, expect, it } from 'vitest';
import type { EventDef, LocationDef } from '../../src/content/types';
import { dotsFor } from '../../src/map/markers';
import { eventPlaceOn, placeName, visitedPlaces } from '../../src/map/places';
import { isInView, VIEW_MARGIN } from '../../src/map/view';

const event = (extra: Partial<EventDef> = {}): EventDef => ({
  id: 'e', year: 6050, month: 1, day: 1, order: 1, title: 'E', text: {},
  location: null, position: null, showOn: null, track: null, newSegment: false, ...extra,
});

describe('an event\'s place on a map (B-13)', () => {
  it('FR-1 on the main map it is the main-map location', () => {
    expect(eventPlaceOn(event({ location: 'a', position: [10, 20] }), 'main', 'main'))
      .toEqual({ position: [10, 20], location: 'a' });
  });

  it('FR-1 on the main map a one-off position has no location', () => {
    expect(eventPlaceOn(event({ position: [5, 6] }), 'main', 'main')).toEqual({ position: [5, 6], location: null });
  });

  it('FR-3 on the main map an n/a event has no place', () => {
    const e = event({ showOn: { map: 'other', location: 'b', position: [1, 2] } });
    expect(eventPlaceOn(e, 'main', 'main')).toBeNull();
  });

  it('FR-3 on the showOn map it is the showOn place', () => {
    const e = event({ location: 'a', position: [10, 20], showOn: { map: 'other', location: 'b', position: [1, 2] } });
    expect(eventPlaceOn(e, 'other', 'main')).toEqual({ position: [1, 2], location: 'b' });
  });

  it('FR-3 a one-off showOn position has no location', () => {
    const e = event({ showOn: { map: 'other', location: null, position: [3, 4] } });
    expect(eventPlaceOn(e, 'other', 'main')).toEqual({ position: [3, 4], location: null });
  });

  it('FR-1 on any other map it has no place, even if its location has a position there', () => {
    const e = event({ location: 'a', position: [10, 20], showOn: { map: 'other', location: 'b', position: [1, 2] } });
    expect(eventPlaceOn(e, 'third', 'main')).toBeNull();
  });

  it('FR-1 an event with no showOn has no place on another map', () => {
    expect(eventPlaceOn(event({ location: 'a', position: [10, 20] }), 'other', 'main')).toBeNull();
  });
});

describe('the name of a place (B-13)', () => {
  const locations: LocationDef[] = [
    { id: 'a', name: { fi: 'Aa', en: 'Ay' }, positions: {} },
    { id: 'b', name: 'Bee', positions: {} },
  ];

  it('FR-9 is the name of the location, in the chosen language with the default as the fallback', () => {
    expect(placeName({ position: [1, 1], location: 'a' }, locations, 'en', 'fi')).toBe('Ay');
    expect(placeName({ position: [1, 1], location: 'b' }, locations, 'en', 'fi')).toBe('Bee');
  });

  it('FR-1 is null for a one-off position', () => {
    expect(placeName({ position: [1, 1], location: null }, locations, 'fi', 'fi')).toBeNull();
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
    expect(visitedPlaces([at('a', [1, 1])], 0, 'main', 'main')).toEqual([]);
  });

  it('FR-1 lists the places of the earlier events in date order, and not the current or later ones', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('c', [3, 3]), at('d', [4, 4])];
    expect(visitedPlaces(events, 2, 'main', 'main').map((p) => p.location)).toEqual(['a', 'b']);
  });

  it('FR-1 stepping back drops the places again: the result depends only on the current event', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('c', [3, 3])];
    expect(visitedPlaces(events, 2, 'main', 'main')).toHaveLength(2);
    expect(visitedPlaces(events, 1, 'main', 'main')).toHaveLength(1);
    expect(visitedPlaces(events, 0, 'main', 'main')).toHaveLength(0);
  });

  it('FR-1 a place visited by several events is listed once', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('a', [1, 1]), at('c', [3, 3])];
    expect(visitedPlaces(events, 3, 'main', 'main').map((p) => p.location)).toEqual(['a', 'b']);
  });

  it('FR-1 the place of the current event is not a dot, even when earlier events were there', () => {
    const events = [at('a', [1, 1]), at('b', [2, 2]), at('a', [1, 1])];
    expect(visitedPlaces(events, 2, 'main', 'main').map((p) => p.location)).toEqual(['b']);
  });

  it('FR-8 standalone events count, and one-off positions are places of their own', () => {
    const events = [
      at('a', [1, 1], { track: 'none' }),
      at(null, [5, 5]),
      at(null, [5, 5]),
      at(null, [6, 6]),
      at('z', [9, 9]),
    ];
    expect(visitedPlaces(events, 4, 'main', 'main').map((p) => p.position)).toEqual([[1, 1], [5, 5], [6, 6]]);
  });

  it('FR-3 an event with no place on the map adds nothing there', () => {
    const events = [at('a', [1, 1]), other('x', [8, 8]), at('b', [2, 2])];
    expect(visitedPlaces(events, 2, 'main', 'main').map((p) => p.location)).toEqual(['a']);
    expect(visitedPlaces(events, 2, 'other', 'main').map((p) => p.location)).toEqual(['x']);
  });

  it('FR-1 on another map only the places that were on that map count', () => {
    const events = [at('a', [1, 1]), other('x', [8, 8]), other('y', [9, 9]), at('b', [2, 2])];
    expect(visitedPlaces(events, 3, 'other', 'main').map((p) => p.location)).toEqual(['x', 'y']);
    expect(visitedPlaces(events, 3, 'third', 'main')).toEqual([]);
  });

  it('FR-1 a manually viewed map where the current event has no place still shows the earlier places', () => {
    const events = [other('x', [8, 8]), at('a', [1, 1]), other('y', [9, 9]), at('b', [2, 2])];
    expect(visitedPlaces(events, 3, 'other', 'main').map((p) => p.location)).toEqual(['x', 'y']);
  });

  it('FR-1 an index outside the events gives nothing, or only what is before it', () => {
    const events = [at('a', [1, 1])];
    expect(visitedPlaces(events, -1, 'main', 'main')).toEqual([]);
    expect(visitedPlaces([], 0, 'main', 'main')).toEqual([]);
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
