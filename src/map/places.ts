import type { EventDef, LocationDef } from '../content/types';
import { resolveText } from '../content/text';
import type { Position } from './coords';

/** Where an event is on a map, and the location it is at when that place is a named one. */
export interface Place {
  position: Position;
  location: string | null;
}

/**
 * An event's place on a map. An explicit place wins: on the main map the main place (none for n/a),
 * and on the showOn map the showOn place. On any other map the place is the position of the first
 * of the event's named locations (location, then showOn location) that has one there, if any. A
 * one-off position gives a place only on its own map.
 */
export function eventPlaceOn(
  event: EventDef,
  mapId: string,
  mainMapId: string,
  locations: LocationDef[],
): Place | null {
  if (mapId === mainMapId) {
    return event.position ? { position: event.position, location: event.location } : null;
  }
  if (event.showOn && event.showOn.map === mapId) {
    return { position: event.showOn.position, location: event.showOn.location };
  }
  for (const id of [event.location, event.showOn?.location]) {
    const position = id ? locations.find((location) => location.id === id)?.positions[mapId] : undefined;
    if (position && id) return { position, location: id };
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

/** A place by its position, so that places at the same spot are one. */
const placeKey = (place: Place) => place.position.join(',');

/**
 * The places of the events before the current one (by index in date order) that have a place on the
 * map, in the order they were first reached. A place visited by several events is listed once, and
 * the place of the current event is left out, because it has the current marker.
 */
export function visitedPlaces(
  events: EventDef[],
  currentIndex: number,
  mapId: string,
  mainMapId: string,
  locations: LocationDef[],
): Place[] {
  const current = events[currentIndex] ? eventPlaceOn(events[currentIndex], mapId, mainMapId, locations) : null;
  const seen = new Set<string>(current ? [placeKey(current)] : []);
  const visited: Place[] = [];
  for (const event of events.slice(0, Math.max(currentIndex, 0))) {
    const place = eventPlaceOn(event, mapId, mainMapId, locations);
    if (place && !seen.has(placeKey(place))) {
      seen.add(placeKey(place));
      visited.push(place);
    }
  }
  return visited;
}
