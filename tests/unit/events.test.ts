import { describe, expect, it } from 'vitest';
import { eventLocationName, findEvent } from '../../src/content/events';
import type { EventDef, LocationDef } from '../../src/content/types';

const event = (id: string, extra: Partial<EventDef> = {}): EventDef => ({
  id, year: 6050, month: 1, day: 1, order: 1, title: id,
  location: null, position: null, showOn: null, track: null, newSegment: false, ...extra,
});

const locations: LocationDef[] = [
  { id: 'a', name: { fi: 'Aa', en: 'Ay' }, positions: { one: [1, 1] } },
  { id: 'b', name: 'Bee', positions: { two: [2, 2] } },
];

describe('finding the current event (B-11)', () => {
  const events = [event('first'), event('second')];

  it('FR-2 finds an event by its id', () => {
    expect(findEvent(events, 'second')).toBe(events[1]);
  });

  it('FR-2 an unknown id, an empty id and no id find nothing', () => {
    expect(findEvent(events, 'third')).toBeUndefined();
    expect(findEvent(events, '')).toBeUndefined();
    expect(findEvent(events, undefined)).toBeUndefined();
  });

  it('FR-2 an empty list finds nothing', () => {
    expect(findEvent([], 'first')).toBeUndefined();
  });
});

describe('the location name of an event (B-11)', () => {
  it('FR-3 is the main-map location, in the chosen language', () => {
    expect(eventLocationName(event('x', { location: 'a', position: [1, 1] }), locations, 'en', 'fi')).toBe('Ay');
    expect(eventLocationName(event('x', { location: 'a', position: [1, 1] }), locations, 'fi', 'fi')).toBe('Aa');
  });

  it('FR-3 falls back to the default language, like any name', () => {
    expect(eventLocationName(event('x', { location: 'b', position: [2, 2] }), locations, 'en', 'fi')).toBe('Bee');
  });

  it('FR-3 is the showOn location when the main one is n/a', () => {
    const e = event('x', { showOn: { map: 'two', location: 'b', position: [2, 2] } });
    expect(eventLocationName(e, locations, 'fi', 'fi')).toBe('Bee');
  });

  it('FR-3 prefers the main-map location over the showOn one', () => {
    const e = event('x', { location: 'a', position: [1, 1], showOn: { map: 'two', location: 'b', position: [2, 2] } });
    expect(eventLocationName(e, locations, 'fi', 'fi')).toBe('Aa');
  });

  it('FR-3 is null for a one-off position, with or without showOn', () => {
    expect(eventLocationName(event('x', { position: [5, 5] }), locations, 'fi', 'fi')).toBeNull();
    const e = event('x', { showOn: { map: 'two', location: null, position: [2, 2] } });
    expect(eventLocationName(e, locations, 'fi', 'fi')).toBeNull();
  });

  it('FR-3 is null when the location id is unknown', () => {
    expect(eventLocationName(event('x', { location: 'zzz' }), locations, 'fi', 'fi')).toBeNull();
  });
});
