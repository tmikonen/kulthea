import type { EventDef, LocationDef } from '../content/types';
import { resolveText } from '../content/text';
import type { Position } from './coords';

/** Where an event is on a map, and the location it is at when that place is a named one. */
export interface Place {
  position: Position;
  location: string | null;
}

/**
 * An event's place on a map. An event has at most two: its main place on the main map (none for
 * n/a), and its showOn place on the showOn map. It has none on any other map, even when a named
 * location of the event has a position there.
 */
export function eventPlaceOn(event: EventDef, mapId: string, mainMapId: string): Place | null {
  if (mapId === mainMapId) {
    return event.position ? { position: event.position, location: event.location } : null;
  }
  if (event.showOn && event.showOn.map === mapId) {
    return { position: event.showOn.position, location: event.showOn.location };
  }
  return null;
}

/** The name of the location of a place in the chosen language, or null for a one-off position. */
export function placeName(
  place: Place,
  locations: LocationDef[],
  lang: string,
  defaultLang: string,
): string | null {
  const location = locations.find((candidate) => candidate.id === place.location);
  return location ? resolveText(location.name, lang, defaultLang) : null;
}
