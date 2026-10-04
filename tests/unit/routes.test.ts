import { describe, expect, it } from 'vitest';
import type { EventDef, LocationDef } from '../../src/content/types';
import { buildRoutes, clipSegments, visibleRoutes, type RouteSegment } from '../../src/map/routes';

const MAIN = 'main';
const BOG = 'bog';

// Suonperä and the ruins are on both maps. Events at them get a place on both maps from the location.
const locations: LocationDef[] = [
  { id: 'suonpera', name: 'Suonperä', positions: { main: [70, 40], bog: [73, 44] } },
  { id: 'ruins', name: 'Ruins', positions: { main: [64, 39], bog: [36, 36] } },
];

interface Spec {
  /** The main-map position, or null for n/a. Omitted means a main position that is made up from the name. */
  main?: [number, number] | null;
  /** The place on Bog End, shown there (showOn). */
  bog?: [number, number];
  /** A named location, whose positions then give places on the maps it is on. */
  at?: string;
  track?: string | null;
  newSegment?: boolean;
}

let counter = 0;
/** An event with the given places. The id is its name, so that the examples read as they are written. */
function ev(name: string, spec: Spec = {}): EventDef {
  counter += 1;
  const location = spec.at ? locations.find((l) => l.id === spec.at)! : null;
  const main = spec.main === undefined ? (location ? location.positions[MAIN] : ([counter, counter] as [number, number])) : spec.main;
  return {
    id: name, year: 6050, month: 1, day: 1, order: counter, title: name, text: {},
    location: spec.at ?? null,
    position: main,
    showOn: spec.bog ? { map: BOG, location: null, position: spec.bog } : null,
    track: spec.track === undefined ? null : spec.track,
    newSegment: spec.newSegment ?? false,
  };
}

const build = (events: EventDef[]) => buildRoutes(events, [MAIN, BOG], MAIN, locations);

/** The names of the events at the points of each segment on a map, as lists. */
const lines = (segments: RouteSegment[], mapId: string) =>
  segments.filter((s) => s.mapId === mapId).map((s) => s.points.map((p) => p.eventId));

describe('party route logic: the worked examples (B-16)', () => {
  it('FR-5 1. A, B, C, D give one line A-B-C-D, and one event alone gives no line', () => {
    const events = [ev('A'), ev('B'), ev('C'), ev('D')];
    expect(lines(build(events), MAIN)).toEqual([['A', 'B', 'C', 'D']]);
    const alone = lines(build([ev('A')]), MAIN);
    expect(alone).toEqual([['A']]); // a segment of one point, which draws no line
  });

  it('FR-5 2. a standalone event neither adds a line nor breaks the route', () => {
    const events = [ev('A'), ev('B'), ev('S', { track: 'none' }), ev('C')];
    const segments = build(events);
    expect(lines(segments, MAIN)).toEqual([['A', 'B', 'C']]);
  });

  it('FR-5 3. an n/a event breaks the main route, and is alone on Bog End', () => {
    const events = [ev('A'), ev('B'), ev('N', { main: null, bog: [5, 5] }), ev('C'), ev('D')];
    const segments = build(events);
    expect(lines(segments, MAIN)).toEqual([['A', 'B'], ['C', 'D']]);
    expect(lines(segments, BOG)).toEqual([['N']]);
  });

  it('FR-5 4. events with a main location that are also shown on Bog End stay on the main route, and make a line there', () => {
    const events = [ev('A'), ev('X', { bog: [1, 1] }), ev('Y', { bog: [2, 2] }), ev('B')];
    const segments = build(events);
    expect(lines(segments, MAIN)).toEqual([['A', 'X', 'Y', 'B']]);
    expect(lines(segments, BOG)).toEqual([['X', 'Y']]);
  });

  it('FR-5 5. each separate visit to another map is its own segment', () => {
    const events = [
      ev('N1', { main: null, bog: [1, 1] }),
      ev('N2', { main: null, bog: [2, 2] }),
      ev('A'),
      ev('N3', { main: null, bog: [3, 3] }),
    ];
    const segments = build(events);
    expect(lines(segments, BOG)).toEqual([['N1', 'N2'], ['N3']]);
    expect(lines(segments, MAIN)).toEqual([['A']]);
  });

  it('FR-5 6. a new segment leaves no line into that event, on every map where both have a place', () => {
    const events = [ev('A', { bog: [1, 1] }), ev('B', { bog: [2, 2], newSegment: true }), ev('C', { bog: [3, 3] })];
    const segments = build(events);
    expect(lines(segments, MAIN)).toEqual([['A'], ['B', 'C']]);
    expect(lines(segments, BOG)).toEqual([['A'], ['B', 'C']]);
  });

  it('FR-5 7. two events at the same position in a row give no zero-length line, and the route goes on from there', () => {
    const events = [ev('A', { main: [5, 5] }), ev('A2', { main: [5, 5] }), ev('B', { main: [9, 9] })];
    const [segment] = build(events).filter((s) => s.mapId === MAIN);
    expect(segment.points.map((p) => p.eventId)).toEqual(['A', 'B']);
    expect(segment.events).toEqual([0, 1, 2]); // the second event is still part of the segment
  });

  it('FR-5 8. events of a named group between A and B do not change the party\'s line', () => {
    const events = [ev('A'), ev('G1', { track: 'scout' }), ev('G2', { track: 'scout', newSegment: true }), ev('B')];
    expect(lines(build(events), MAIN)).toEqual([['A', 'B']]);
  });

  it('FR-5 9. clipping: with the current event C in A-B-C-D the line is A-B-C, and with B it is A-B', () => {
    const events = [ev('A'), ev('B'), ev('C'), ev('D')];
    const segments = build(events);
    expect(lines(clipSegments(segments, 2), MAIN)).toEqual([['A', 'B', 'C']]);
    expect(lines(clipSegments(segments, 1), MAIN)).toEqual([['A', 'B']]);
  });

  it('FR-1 10. a place from a location: events at places with a Bog End position are one visit there', () => {
    const events = [ev('A'), ev('E1', { at: 'suonpera' }), ev('E2', { at: 'ruins' }), ev('B')];
    const segments = build(events);
    expect(lines(segments, BOG)).toEqual([['E1', 'E2']]);
    expect(lines(segments, MAIN)).toEqual([['A', 'E1', 'E2', 'B']]);
    const [bog] = segments.filter((s) => s.mapId === BOG);
    expect(bog.points.map((p) => p.position)).toEqual([[73, 44], [36, 36]]);
  });
});

describe('which lines to show: the worked examples (B-16)', () => {
  // A and B are only on the main map. S1 to S4 are on Bog End (shown there) and also on the main map.
  const events = [
    ev('A'), ev('S1', { bog: [1, 1] }), ev('S2', { bog: [2, 2] }), ev('S3', { bog: [3, 3] }), ev('B'), ev('S4', { bog: [4, 4] }),
  ];
  const segments = build(events);
  const at = (name: string) => events.findIndex((e) => e.id === name);

  it('FR-5 11. a visit map shows only the current visit: the line of the visit grows, and goes when the party leaves', () => {
    const showBog = (name: string) => lines(visibleRoutes(segments, events, at(name), BOG, 'visit'), BOG);
    expect(showBog('S1')).toEqual([['S1']]);
    expect(showBog('S3')).toEqual([['S1', 'S2', 'S3']]);
    expect(showBog('B')).toEqual([]); // the party has left Bog End
    expect(showBog('S4')).toEqual([['S4']]); // a new visit, with no line from the earlier one
  });

  it('FR-5 11. the route of a visit is shown again when stepping back into it', () => {
    expect(lines(visibleRoutes(segments, events, at('S3'), BOG, 'visit'), BOG)).toEqual([['S1', 'S2', 'S3']]);
    expect(lines(visibleRoutes(segments, events, at('B'), BOG, 'visit'), BOG)).toEqual([]);
    expect(lines(visibleRoutes(segments, events, at('S2'), BOG, 'visit'), BOG)).toEqual([['S1', 'S2']]);
  });

  it('FR-5 12. tracks are separate: the party stays on Bog End while the current event is a group\'s on the main map', () => {
    const list = [ev('P1', { bog: [1, 1] }), ev('P2', { bog: [2, 2] }), ev('G1', { track: 'scout' })];
    const built = build(list);
    expect(lines(visibleRoutes(built, list, 2, BOG, 'visit'), BOG)).toEqual([['P1', 'P2']]);
  });

  it('FR-5 13. a history map shows everything up to the current event, however many visits there were', () => {
    const main = (name: string) => lines(visibleRoutes(segments, events, at(name), MAIN, 'history'), MAIN);
    expect(main('S4')).toEqual([['A', 'S1', 'S2', 'S3', 'B', 'S4']]);
    expect(main('S2')).toEqual([['A', 'S1', 'S2']]);
    // On Bog End as a history map, both visits stay.
    expect(lines(visibleRoutes(segments, events, at('S4'), BOG, 'history'), BOG)).toEqual([['S1', 'S2', 'S3'], ['S4']]);
  });
});

describe('route logic: more cases (B-16)', () => {
  it('FR-5 a standalone event with newSegment is ignored, and does not break the route', () => {
    const events = [ev('A'), ev('S', { track: 'none', newSegment: true, main: null, bog: [1, 1] }), ev('B')];
    expect(lines(build(events), MAIN)).toEqual([['A', 'B']]);
  });

  it('FR-5 several breaks make several segments, in date order', () => {
    const events = [ev('A'), ev('N1', { main: null, bog: [1, 1] }), ev('B'), ev('N2', { main: null, bog: [2, 2] }), ev('C'), ev('D')];
    expect(lines(build(events), MAIN)).toEqual([['A'], ['B'], ['C', 'D']]);
  });

  it('FR-5 a new segment on the first event changes nothing, and on an event with no place on a map nothing is drawn there', () => {
    const events = [ev('A', { newSegment: true }), ev('B', { main: null, bog: [1, 1], newSegment: true })];
    expect(lines(build(events), MAIN)).toEqual([['A']]);
    expect(lines(build(events), BOG)).toEqual([['B']]);
  });

  it('FR-5 a new segment right after a duplicate position starts a segment at that same point', () => {
    const events = [ev('A', { main: [5, 5] }), ev('B', { main: [5, 5], newSegment: true }), ev('C', { main: [6, 6] })];
    expect(lines(build(events), MAIN)).toEqual([['A'], ['B', 'C']]);
  });

  it('FR-5 no events, and a map that no event is on, give no segments', () => {
    expect(build([])).toEqual([]);
    expect(buildRoutes([ev('A')], ['elsewhere'], MAIN, locations)).toEqual([]);
  });

  it('FR-5 the events of a group do not give segments here, only the party\'s do', () => {
    const segments = build([ev('G1', { track: 'scout' }), ev('G2', { track: 'scout' })]);
    expect(segments).toEqual([]);
  });

  it('FR-5 a segment never holds an event twice, and its points are in date order', () => {
    const events = [
      ev('A'), ev('B', { bog: [1, 1] }), ev('C', { main: null, bog: [2, 2] }), ev('D', { newSegment: true }), ev('E', { bog: [3, 3] }),
      ev('S', { track: 'none' }), ev('F'), ev('G', { track: 'x' }), ev('H', { bog: [4, 4] }),
    ];
    for (const segment of build(events)) {
      expect(new Set(segment.events).size).toBe(segment.events.length);
      expect(new Set(segment.points.map((p) => p.index)).size).toBe(segment.points.length);
      expect([...segment.events]).toEqual([...segment.events].sort((a, b) => a - b));
      expect(segment.points.map((p) => p.index)).toEqual(segment.points.map((p) => p.index).sort((a, b) => a - b));
    }
  });

  it('FR-5 each point is tied to its event and the index of that event', () => {
    const events = [ev('A'), ev('B')];
    const [segment] = build(events).filter((s) => s.mapId === MAIN);
    expect(segment.points.map((p) => [p.eventId, p.index])).toEqual([['A', 0], ['B', 1]]);
    expect(segment.points[1].position).toEqual(events[1].position);
  });

  it('FR-5 clipping at any event keeps exactly the points of the earlier events, and drops a segment that has none', () => {
    const events = [ev('A'), ev('B', { newSegment: true }), ev('C'), ev('N', { main: null, bog: [1, 1] }), ev('D')];
    const segments = build(events);
    for (let upTo = -1; upTo < events.length; upTo++) {
      const clipped = clipSegments(segments, upTo);
      const expected = segments
        .map((s) => s.points.filter((p) => p.index <= upTo).map((p) => p.eventId))
        .filter((p) => p.length > 0);
      expect(clipped.map((s) => s.points.map((p) => p.eventId))).toEqual(expected);
    }
  });

  it('FR-5 clipping leaves the built segments as they were', () => {
    const segments = build([ev('A'), ev('B'), ev('C')]);
    const before = JSON.stringify(segments);
    clipSegments(segments, 0);
    expect(JSON.stringify(segments)).toBe(before);
  });

  it('FR-5 a history map at the last event shows everything, and before the first event nothing', () => {
    const events = [ev('A'), ev('B')];
    const segments = build(events);
    expect(lines(visibleRoutes(segments, events, 1, MAIN, 'history'), MAIN)).toEqual([['A', 'B']]);
    expect(visibleRoutes(segments, events, -1, MAIN, 'history')).toEqual([]);
  });

  it('FR-5 a visit map shows nothing before the first event, and an index past the end counts as the last event', () => {
    const events = [ev('A', { bog: [1, 1] }), ev('B', { bog: [2, 2] })];
    const segments = build(events);
    expect(visibleRoutes(segments, events, -1, BOG, 'visit')).toEqual([]);
    expect(lines(visibleRoutes(segments, events, 99, BOG, 'visit'), BOG)).toEqual([['A', 'B']]);
  });

  it('FR-5 a visit map shows the visit through events that share a place with the one before', () => {
    const events = [ev('S1', { bog: [1, 1] }), ev('S2', { bog: [1, 1] }), ev('S3', { bog: [2, 2] })];
    const segments = build(events);
    expect(lines(visibleRoutes(segments, events, 1, BOG, 'visit'), BOG)).toEqual([['S1']]);
    expect(lines(visibleRoutes(segments, events, 2, BOG, 'visit'), BOG)).toEqual([['S1', 'S3']]);
  });

  it('FR-8 a standalone event between party events on a visit map does not end the visit', () => {
    const events = [ev('S1', { bog: [1, 1] }), ev('X', { track: 'none', main: null, bog: [9, 9] }), ev('S2', { bog: [2, 2] })];
    const segments = build(events);
    expect(lines(visibleRoutes(segments, events, 1, BOG, 'visit'), BOG)).toEqual([['S1']]);
    expect(lines(visibleRoutes(segments, events, 2, BOG, 'visit'), BOG)).toEqual([['S1', 'S2']]);
  });

  it('FR-5 the party being on a map is decided by the party\'s latest event, not by the current event of another track', () => {
    const events = [ev('P1', { bog: [1, 1] }), ev('G1', { track: 'scout', bog: [9, 9] }), ev('P2', { main: [3, 3] })];
    const segments = build(events);
    // At G1 the party's latest event is P1, on Bog End, so its line is there. At P2 the party has left.
    expect(lines(visibleRoutes(segments, events, 1, BOG, 'visit'), BOG)).toEqual([['P1']]);
    expect(lines(visibleRoutes(segments, events, 2, BOG, 'visit'), BOG)).toEqual([]);
  });
});
