import type { LocationDef } from '../content/types';
import { placeName, type Place } from './places';
import type { Position } from './coords';

/** A dot to draw on the displayed map, for a place the story has been to. */
export interface MapMarker {
  id: string;
  /** The location's name in the chosen language, or null for a one-off position. */
  label: string | null;
  position: Position;
}

/** The dots for visited places, named in the chosen language. */
export function dotsFor(
  places: Place[],
  locations: LocationDef[],
  lang: string,
  defaultLang: string,
): MapMarker[] {
  return places.map((place) => ({
    id: place.position.join(','),
    label: placeName(place, locations, lang, defaultLang),
    position: place.position,
  }));
}
