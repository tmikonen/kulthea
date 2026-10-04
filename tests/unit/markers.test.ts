import { describe, expect, it } from 'vitest';
import type { LocationDef } from '../../src/content/types';
import { markersFor } from '../../src/map/markers';

const locations: LocationDef[] = [
  { id: 'a', name: { fi: 'Aa', en: 'Ay' }, positions: { one: [10, 20], two: [30, 40] } },
  { id: 'b', name: 'Bee', positions: { one: [50, 60] } },
  { id: 'c', name: { fi: 'Cee' }, positions: { two: [70, 80] } },
];

describe('markers for a map (B-7)', () => {
  it('FR-1 includes only the locations that have a position on the map, at that position', () => {
    expect(markersFor(locations, 'one', 'fi', 'fi')).toEqual([
      { id: 'a', label: 'Aa', position: [10, 20] },
      { id: 'b', label: 'Bee', position: [50, 60] },
    ]);
    expect(markersFor(locations, 'two', 'fi', 'fi').map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('FR-1 a map with no locations has no markers', () => {
    expect(markersFor(locations, 'three', 'fi', 'fi')).toEqual([]);
  });

  it('FR-9 labels follow the chosen language, falling back to the default', () => {
    expect(markersFor(locations, 'two', 'en', 'fi').map((m) => m.label)).toEqual(['Ay', 'Cee']);
  });
});
