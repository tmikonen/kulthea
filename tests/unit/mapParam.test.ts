import { describe, expect, it } from 'vitest';
import type { ContentMap } from '../../src/content/types';
import { displayedMap } from '../../src/map/mapParam';

const map = (id: string, main = false): ContentMap =>
  ({ id, name: id, image: `${id}.png`, imageUrl: `/${id}.png`, width: 10, height: 10, main, focusZoom: 0 });
const maps = [map('a'), map('b', true), map('c')];

const onMap = (id: string) => ({ showOn: { map: id, location: null, position: [1, 1] as [number, number] } });
const mainOnly = { showOn: null };

describe('the displayed map (B-5, B-15)', () => {
  it('FR-1 a known map in the address wins, whatever the event', () => {
    expect(displayedMap(maps, 'c', mainOnly).id).toBe('c');
    expect(displayedMap(maps, 'c', onMap('a')).id).toBe('c');
    expect(displayedMap(maps, 'b', onMap('a')).id).toBe('b');
  });

  it('FR-3 with no map in the address, an event with showOn is displayed on that map', () => {
    expect(displayedMap(maps, null, onMap('a')).id).toBe('a');
    expect(displayedMap(maps, null, onMap('c')).id).toBe('c');
  });

  it('FR-3 with no map in the address, an event without showOn is displayed on the main map', () => {
    expect(displayedMap(maps, null, mainOnly).id).toBe('b');
  });

  it('FR-1 an unknown or empty map in the address is ignored, so the event\'s own map is used', () => {
    expect(displayedMap(maps, 'nowhere', onMap('a')).id).toBe('a');
    expect(displayedMap(maps, '', onMap('c')).id).toBe('c');
    expect(displayedMap(maps, 'nowhere', mainOnly).id).toBe('b');
  });

  it('FR-1 with no event, the main map is displayed unless the address names a map', () => {
    expect(displayedMap(maps, null).id).toBe('b');
    expect(displayedMap(maps, 'nowhere').id).toBe('b');
    expect(displayedMap(maps, 'a').id).toBe('a');
  });

  it('FR-3 a showOn map that does not exist falls back to the main map', () => {
    expect(displayedMap(maps, null, onMap('zzz')).id).toBe('b');
  });
});
