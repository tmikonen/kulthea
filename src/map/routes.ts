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
 * Builds the route segments of every map from the events in date order. The party's route on a map
 * joins consecutive party events that have a place on it. A party event with no place on the map
 * breaks the route there, so each visit to a map is a segment of its own, except on an overview map,
 * where such an event is skipped. An event with `newSegment` starts a new segment, also when it is
 * skipped, because the jump comes before it. Standalone events and events of named groups are ignored.
 */
export function buildRoutes(
  events: EventDef[],
  maps: { id: string; routes: RoutesMode }[],
  mainMapId: string,
  locations: LocationDef[],
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (const { id: mapId, routes: mode } of maps) {
    let open: RouteSegment | null = null;
    events.forEach((event, index) => {
      if (trackOf(event) !== null) return;
      const place = eventPlaceOn(event, mapId, mainMapId, locations);
      if (!place) {
        if (mode !== 'overview' || event.newSegment) open = null;
        return;
      }
      if (open && !event.newSegment) {
        open.events.push(index);
        const last = open.points[open.points.length - 1];
        if (!samePosition(last.position, place.position)) {
          open.points.push({ eventId: event.id, index, position: place.position });
        }
        return;
      }
      open = {
        mapId,
        track: null,
        points: [{ eventId: event.id, index, position: place.position }],
        events: [index],
      };
      segments.push(open);
    });
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
    .filter((segment) => segment.points.length > 0);
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
