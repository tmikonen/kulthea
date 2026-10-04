import { describe, expect, it } from 'vitest';
import type { ContentMap } from '../../src/content/types';
import { activeMap } from '../../src/map/mapParam';

const map = (id: string, main = false): ContentMap =>
  ({ id, name: id, image: `${id}.png`, imageUrl: `/${id}.png`, width: 10, height: 10, main });
const maps = [map('a'), map('b', true), map('c')];

describe('the map URL parameter (B-5)', () => {
  it('FR-1 a known map id selects that map', () => {
    expect(activeMap(maps, 'c').id).toBe('c');
  });

  it('FR-1 a missing parameter means the main map', () => {
    expect(activeMap(maps, null).id).toBe('b');
  });

  it('FR-1 an unknown id means the main map', () => {
    expect(activeMap(maps, 'nowhere').id).toBe('b');
    expect(activeMap(maps, '').id).toBe('b');
  });
});
