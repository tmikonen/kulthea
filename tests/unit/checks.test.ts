import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../plugin/load-content';
import { editDistance, suggestField } from '../../plugin/checks';
import { cleanupTempContent, editJson, FIXTURES, loadModified, writeEntry, writeEvent } from './content-helpers';

afterEach(cleanupTempContent);

/** The warnings of B-35 about things that nothing uses. */
const UNUSED = /the image is not used|is not used by any event|the entry is not used/;

const REAL_FOLDERS = [FIXTURES, path.resolve(__dirname, '../../content'), path.resolve(__dirname, '../../campaign')];

describe('field suggestions (B-28)', () => {
  it('FR-9 counts typing mistakes, a swap of neighbours as one', () => {
    expect(editDistance('motto', 'motto')).toBe(0);
    expect(editDistance('mottto', 'motto')).toBe(1);
    expect(editDistance('mtoto', 'motto')).toBe(1);
    expect(editDistance('focusZom', 'focusZoom')).toBe(1);
    expect(editDistance('abc', 'xyz')).toBe(3);
  });

  it('FR-9 suggests a listed field within two mistakes, and none farther away', () => {
    expect(suggestField('mottto', ['type', 'name', 'motto'])).toBe('motto');
    expect(suggestField('nmae', ['type', 'name', 'motto'])).toBe('name');
    expect(suggestField('summary', ['type', 'name', 'motto'])).toBeUndefined();
  });
});

describe('language maps with an unconfigured language (B-28)', () => {
  const expectError = (result: ReturnType<typeof loadModified>, pattern: RegExp) => {
    expect(result.bundle).toBeNull();
    expect(result.errors).toEqual([expect.stringMatching(pattern)]);
  };

  it('FR-9 an event title', () => {
    expectError(loadModified((dir) => writeEvent(dir, '6050-4-001-01-de.md', 'title:\n  fi: X\n  de: Hallo\nlocation: both-places')),
      /6050-4-001-01-de\.md: "title" has a text in the language "de", which is not configured/);
  });

  it('FR-9 an entry name and motto', () => {
    expectError(loadModified((dir) => writeEntry(dir, 'extra.md', 'type: pc\nname:\n  fi: X\n  de: Y')),
      /extra\.md: "name" has a text in the language "de"/);
    expectError(loadModified((dir) => writeEntry(dir, 'extra.md', 'type: pc\nname: X\nmotto:\n  fi: X\n  de: Y')),
      /extra\.md: "motto" has a text in the language "de"/);
  });

  it('FR-9 a location name and a map name', () => {
    expectError(loadModified((dir) => editJson(dir, 'locations.json', (d) => { d[0].name = { fi: 'A', de: 'B' }; })),
      /locations\.json: location ".*": "name" has a text in the language "de"/);
    expectError(loadModified((dir) => editJson(dir, 'maps.json', (d) => { d[1].name = { fi: 'A', de: 'B' }; })),
      /maps\.json: map "second-map": "name" has a text in the language "de"/);
  });

  it('FR-9 the campaign title, era, months and date format', () => {
    const cases: [(d: any) => void, RegExp][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
      [(d) => { d.title = { fi: 'A', de: 'B' }; }, /campaign\.json: "title" has a text in the language "de"/],
      [(d) => { d.era.name.de = 'x'; }, /"era\.name" has a text in the language "de"/],
      [(d) => { d.era.abbreviation.de = 'x'; }, /"era\.abbreviation" has a text in the language "de"/],
      [(d) => { d.months[0].name.de = 'x'; }, /month 1 "name" has a text in the language "de"/],
      [(d) => { d.months[2].inDate.de = 'x'; }, /month 3 "inDate" has a text in the language "de"/],
      [(d) => { d.dateFormat.de = 'x'; }, /"dateFormat" has a text in the language "de"/],
    ];
    for (const [change, pattern] of cases) {
      expectError(loadModified((dir) => editJson(dir, 'campaign.json', change)), pattern);
    }
  });

  it('FR-9 an interface text', () => {
    expectError(loadModified((dir) => editJson(dir, 'ui.json', (d) => { d.maps = { fi: 'Kartta', de: 'Karte' }; })),
      /ui\.json: text "maps" has a text in the language "de"/);
  });

  it('FR-9 plain values and maps with configured languages are as before', () => {
    const { errors, warnings } = loadModified((dir) => {
      writeEvent(dir, '6050-4-001-01-ok.md', 'title:\n  fi: X\n  en: Y\nlocation: both-places');
      writeEvent(dir, '6050-4-002-01-ok.md', 'title: X\nlocation: both-places');
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe('fields that are not listed (B-28)', () => {
  const warningsOf = (change: (dir: string) => void) => {
    const { bundle, errors, warnings } = loadModified(change);
    expect(errors).toEqual([]);
    expect(bundle).not.toBeNull();
    return warnings.filter((w) => !UNUSED.test(w)); // the unused entries made by these tests are for the B-35 tests
  };

  it('FR-9 an entry field, with a suggestion', () => {
    expect(warningsOf((dir) => writeEntry(dir, 'extra.md', 'type: pc\nname: X\nmottto: Y'))).toEqual([
      expect.stringMatching(/extra\.md: the field "mottto" is not used, did you mean "motto"\?/)]);
  });

  it('FR-9 an event field and a showOn field', () => {
    expect(warningsOf((dir) => writeEvent(dir, '6050-4-001-01-w.md', 'title: X\nlocaton: both-places\nlocation: both-places\nnewSegmnt: true'))).toEqual([
      expect.stringMatching(/6050-4-001-01-w\.md: the field "locaton" is not used, did you mean "location"\?/),
      expect.stringMatching(/the field "newSegmnt" is not used, did you mean "newSegment"\?/)]);
    expect(warningsOf((dir) => writeEvent(dir, '6050-4-001-01-w.md', 'title: X\nlocation: both-places\nshowOn:\n  map: second-map\n  location: both-places\n  mapp: x'))).toEqual([
      expect.stringMatching(/6050-4-001-01-w\.md: "showOn": the field "mapp" is not used, did you mean "map"\?/)]);
  });

  it('FR-9 a field with no near listed field gets no suggestion', () => {
    const [warning] = warningsOf((dir) => writeEvent(dir, '6050-4-001-01-w.md', 'title: X\nlocation: both-places\nsession: 3'));
    expect(warning).toMatch(/6050-4-001-01-w\.md: the field "session" is not used$/);
  });

  it('FR-9 a field in maps.json and locations.json', () => {
    expect(warningsOf((dir) => editJson(dir, 'maps.json', (d) => { d[0].focusZom = 2; }))).toEqual([
      expect.stringMatching(/maps\.json: map "main-map": the field "focusZom" is not used, did you mean "focusZoom"\?/)]);
    expect(warningsOf((dir) => editJson(dir, 'locations.json', (d) => { d[0].positon = {}; }))).toEqual([
      expect.stringMatching(/locations\.json: location ".*": the field "positon" is not used, did you mean "positions"\?/)]);
  });

  it('FR-9 a field in campaign.json, its era and its months', () => {
    expect(warningsOf((dir) => editJson(dir, 'campaign.json', (d) => { d.dayPerMonth = 70; }))).toEqual([
      expect.stringMatching(/campaign\.json: the field "dayPerMonth" is not used, did you mean "daysPerMonth"\?/)]);
    expect(warningsOf((dir) => editJson(dir, 'campaign.json', (d) => { d.era.abreviation = {}; }))).toEqual([
      expect.stringMatching(/campaign\.json: "era": the field "abreviation" is not used, did you mean "abbreviation"\?/)]);
    expect(warningsOf((dir) => editJson(dir, 'campaign.json', (d) => { d.months[1].inDat = {}; }))).toEqual([
      expect.stringMatching(/campaign\.json: month 2: the field "inDat" is not used, did you mean "inDate"\?/)]);
  });

  it('FR-9 a warning does not fail the build', () => {
    const { bundle, errors } = loadModified((dir) => writeEntry(dir, 'extra.md', 'type: pc\nname: X\nsummary: Y'));
    expect(errors).toEqual([]);
    expect(bundle).not.toBeNull();
  });
});

describe('a group that never returns (B-28)', () => {
  const groupWarnings = (change: (dir: string) => void) => loadModified(change).warnings.filter((w) => !UNUSED.test(w));

  it('FR-5 warns, naming the last event and the group, when no party event comes after it', () => {
    expect(groupWarnings((dir) => writeEvent(dir, '6050-4-001-01-last.md', 'title: X\nlocation: both-places\ntrack: scouts'))).toEqual([
      expect.stringMatching(/6050-4-001-01-last\.md: the group "scouts" has no later party event/)]);
  });

  it('FR-5 names the last event of the group when it has several', () => {
    const warnings = groupWarnings((dir) => {
      writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: both-places\ntrack: scouts');
      writeEvent(dir, '6050-4-002-01-b.md', 'title: X\nlocation: both-places\ntrack: scouts');
    });
    expect(warnings).toEqual([expect.stringMatching(/6050-4-002-01-b\.md: the group "scouts"/)]);
  });

  it('FR-5 gives no warning for a group that rejoins, a standalone event or the party', () => {
    expect(groupWarnings((dir) => {
      writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: both-places\ntrack: scouts');
      writeEvent(dir, '6050-4-002-01-b.md', 'title: X\nlocation: both-places');
      writeEvent(dir, '6050-4-003-01-c.md', 'title: X\nlocation: both-places\ntrack: none');
    })).toEqual([]);
  });

  it('FR-5 a mistyped group name gives a warning for the new group', () => {
    const warnings = groupWarnings((dir) => writeEvent(dir, '6050-3-002-01-typo.md', 'title: X\nlocation: both-places\ntrack: scoutt'));
    expect(warnings).toEqual([expect.stringMatching(/the group "scoutt"/)]);
  });
});

describe('the real content gives no new warning (B-28)', () => {
  it('FR-9 the fixtures, the demo content and the campaign content have no warnings about fields and groups', () => {
    for (const dir of [...REAL_FOLDERS, 'tests/fixtures-focus', 'tests/fixtures-routes'].map((d) => path.resolve(d))) {
      const { errors, warnings } = loadContent(dir);
      expect(errors, dir).toEqual([]);
      expect(warnings.filter((w) => !UNUSED.test(w)), dir).toEqual([]);
    }
  });
});
