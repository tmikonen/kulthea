import type { ContentMap } from '../content/types';

/** The map named by the `map` URL parameter; a missing or unknown value means the main map. */
export function activeMap(maps: ContentMap[], param: string | null): ContentMap {
  return maps.find((map) => map.id === param) ?? maps.find((map) => map.main)!;
}
