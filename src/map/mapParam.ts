import type { ContentMap, EventDef } from '../content/types';

/**
 * The map to display. A `map` URL parameter that names a map wins, because it is a manual choice
 * that lasts until the next step. Otherwise the event's own map: the one in its `showOn`, or the
 * main map. An unknown parameter is ignored.
 */
export function displayedMap(
  maps: ContentMap[],
  param: string | null,
  event?: Pick<EventDef, 'showOn'>,
): ContentMap {
  const chosen = maps.find((map) => map.id === param);
  if (chosen) return chosen;
  const own = maps.find((map) => map.id === event?.showOn?.map);
  return own ?? maps.find((map) => map.main)!;
}
