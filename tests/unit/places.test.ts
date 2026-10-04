import { describe, expect, it } from 'vitest';
import type { EventDef, LocationDef } from '../../src/content/types';
import { eventPlaceOn, placeName } from '../../src/map/places';
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
