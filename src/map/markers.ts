import type { LocationDef } from '../content/types';
import { resolveText } from '../content/text';
import type { Position } from './coords';

/** A marker to draw on the displayed map. */
export interface MapMarker {
  id: string;
  label: string;
  position: Position;
}

/** The locations that have a position on the given map, named in the chosen language. */
export function markersFor(
  locations: LocationDef[],
  mapId: string,
  lang: string,
  defaultLang: string,
): MapMarker[] {
  return locations.flatMap((location) => {
    const position = location.positions[mapId];
    return position ? [{ id: location.id, label: resolveText(location.name, lang, defaultLang), position }] : [];
  });
}
