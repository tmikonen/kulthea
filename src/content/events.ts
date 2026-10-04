import type { EventDef, LocationDef } from './types';
import { resolveText } from './text';

/** The event with the given id (its file name without `.md`), if there is one. */
export function findEvent(events: EventDef[], id: string | undefined): EventDef | undefined {
  return events.find((event) => event.id === id);
}

/**
 * The name of the place to show in the event's details: the main-map location, or when that is
 * n/a the location it is shown at on another map. A one-off position has no name.
 */
export function eventLocationName(
  event: EventDef,
  locations: LocationDef[],
  lang: string,
  defaultLang: string,
): string | null {
  const id = event.location ?? event.showOn?.location ?? null;
  const location = locations.find((candidate) => candidate.id === id);
  return location ? resolveText(location.name, lang, defaultLang) : null;
}

/** The path of an event's page. */
export function eventPath(id: string): string {
  return `/event/${encodeURIComponent(id)}`;
}

/** The events before and after the given one in date order; null at the ends or for an unknown id. */
export function neighbours(
  events: EventDef[],
  id: string | undefined,
): { previous: EventDef | null; next: EventDef | null } {
  const index = events.findIndex((event) => event.id === id);
  if (index < 0) return { previous: null, next: null };
  return { previous: events[index - 1] ?? null, next: events[index + 1] ?? null };
}
