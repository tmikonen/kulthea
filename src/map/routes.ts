import type { EventDef, LocationDef } from '../content/types';
import type { Position } from './coords';
import { eventPlaceOn } from './places';

/** A point of a route: where an event is on the map, tied to the event. */
export interface RoutePoint {
  eventId: string;
  /** The event's index in date order. */
  index: number;
  position: Position;
}

/**
 * A stretch of a route on one map that is drawn as one line: consecutive events of a track that
 * have a place on the map, with nothing breaking it. `track` is null for the party.
 */
export interface RouteSegment {
  mapId: string;
  track: string | null;
  /** One point for each place along the line, so two events at one place in a row have one point. */
  points: RoutePoint[];
  /** The indexes of all the events in the segment, including those that share a point with the one before. */
  events: number[];
}

/**
 * How a map shows routes. `history` keeps the whole route up to the current event, and an event with no
 * place on the map breaks it. `visit` shows only the current visit of each track. `overview` is for a map
 * that covers the whole region: it keeps the whole route, and an event at a place that is not on the map
 * is skipped, because the party has not left the map, the place is only not marked on it.
 */
export type RoutesMode = 'history' | 'visit' | 'overview';

/** The track of an event: null for the party, a name for a split group, and undefined for a standalone event. */
function trackOf(event: EventDef): string | null | undefined {
  return event.track === 'none' ? undefined : event.track;
}

const samePosition = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];

/**
 * Builds the route segments of every map from the events in date order. A track's route on a map joins
 * its consecutive events that have a place on it. An event with no place on the map breaks the route
 * there, so each visit to a map is a segment of its own, except on an overview map, where such an event
 * is skipped. An event with `newSegment` starts a new segment, also when it is skipped, because the jump
 * comes before it. Standalone events are ignored. The party is the track that has no name. A named group
 * is joined among its own events only, from the party's last event before its first event (where it
 * split) to the party's first event after its last event (where it rejoined). The party's events in
 * between do not end the split. The start and the end are drawn on a map only when that party event
 * has a place on it. The segments of a map are the party's first, then each group's, in the order the
 * groups first appear.
 */
export function buildRoutes(
  events: EventDef[],
  maps: { id: string; routes: RoutesMode }[],
  mainMapId: string,
  locations: LocationDef[],
): RouteSegment[] {
  const tracks: (string | null)[] = [null];
  for (const event of events) {
    const track = trackOf(event);
    if (track && !tracks.includes(track)) tracks.push(track);
  }
  const segments: RouteSegment[] = [];
  for (const { id: mapId, routes: mode } of maps) {
    for (const track of tracks) {
      segments.push(...trackSegments(events, track, mapId, mode, mainMapId, locations));
    }
  }
  return segments;
}

function trackSegments(
  events: EventDef[],
  track: string | null,
  mapId: string,
  mode: RoutesMode,
  mainMapId: string,
  locations: LocationDef[],
): RouteSegment[] {
  const own: number[] = [];
  events.forEach((event, index) => {
    if (trackOf(event) === track) own.push(index);
  });
  const segments: RouteSegment[] = [];
  if (own.length === 0) return segments;

  const placeOf = (index: number) => eventPlaceOn(events[index], mapId, mainMapId, locations);
  const pointOf = (index: number, position: Position): RoutePoint => ({ eventId: events[index].id, index, position });

  let open: RouteSegment | null = null;
  const add = (index: number, position: Position, member: boolean) => {
    if (!open) return;
    if (member) {
      open.events.push(index);
      // A group's segment is kept only once it has an event of its own, not for the start alone.
      if (!segments.includes(open)) segments.push(open);
    }
    const last = open.points[open.points.length - 1];
    if (!samePosition(last.position, position)) open.points.push(pointOf(index, position));
  };

  // A group starts where the party was, unless its first event starts a new segment.
  if (track !== null && !events[own[0]].newSegment) {
    for (let i = own[0] - 1; i >= 0; i--) {
      if (trackOf(events[i]) !== null) continue;
      const place = placeOf(i);
      if (place) open = { mapId, track, points: [pointOf(i, place.position)], events: [] };
      break;
    }
  }

  for (const index of own) {
    const event = events[index];
    const place = placeOf(index);
    if (!place) {
      if (mode !== 'overview' || event.newSegment) open = null;
      continue;
    }
    if (open && !event.newSegment) {
      add(index, place.position, true);
      continue;
    }
    open = { mapId, track, points: [pointOf(index, place.position)], events: [index] };
    segments.push(open);
  }

  // A group ends where the party is next, if the route is still going on this map.
  if (track !== null && open) {
    for (let i = own[own.length - 1] + 1; i < events.length; i++) {
      if (trackOf(events[i]) !== null) continue;
      const place = placeOf(i);
      if (place) add(i, place.position, false);
      break;
    }
  }
  return segments;
}

/** The segments up to the event with the given index: the points of later events are left out. */
export function clipSegments(segments: RouteSegment[], upToIndex: number): RouteSegment[] {
  return segments
    .map((segment) => ({
      ...segment,
      points: segment.points.filter((point) => point.index <= upToIndex),
      events: segment.events.filter((index) => index <= upToIndex),
    }))
    // The start of a group's line is not shown before the group's first event.
    .filter((segment) => segment.events.length > 0);
}

/**
 * The lines to show on a map when the event with the given index is the current one. A history map or
 * an overview map shows every segment up to the current event. A visit map shows, for each track, only the segment
 * that holds the track's latest event up to the current one, and only if that event is in it, so a
 * track's route begins when it enters the map and is not shown once the track has left.
 */
export function visibleRoutes(
  segments: RouteSegment[],
  events: EventDef[],
  currentIndex: number,
  mapId: string,
  mode: RoutesMode,
): RouteSegment[] {
  const onMap = segments.filter((segment) => segment.mapId === mapId);
  if (mode !== 'visit') return clipSegments(onMap, currentIndex);

  const shown: RouteSegment[] = [];
  for (const track of new Set(onMap.map((segment) => segment.track))) {
    let latest = -1;
    for (let i = Math.min(currentIndex, events.length - 1); i >= 0; i--) {
      if (trackOf(events[i]) === track) {
        latest = i;
        break;
      }
    }
    const holding = onMap.find((segment) => segment.track === track && segment.events.includes(latest));
    if (holding) shown.push(...clipSegments([holding], currentIndex));
  }
  return shown;
}
