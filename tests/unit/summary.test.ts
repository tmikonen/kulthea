import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../plugin/load-content';
import { summarizeTranslations } from '../../plugin/summary';
import type { LoadedContent } from '../../src/content/types';
import { cleanupTempContent, editJson, FIXTURES, loadModified, writeEntry, writeEvent } from './content-helpers';

afterEach(cleanupTempContent);

const unusedOf = (warnings: string[]) =>
  warnings.filter((w) => /the image is not used|is not used by any event|the entry is not used/.test(w));

describe('unused images (B-35)', () => {
  it('FR-9 the fixtures have no unused item', () => {
    expect(loadContent(FIXTURES).warnings).toEqual([]);
  });

  it('FR-9 an image that nothing uses gives a warning that names the file', () => {
    const { bundle, errors, warnings } = loadModified((dir) => fs.copyFileSync(path.join(dir, 'images/hero.png'), path.join(dir, 'images/spare.png')));
    expect(errors).toEqual([]);
    expect(bundle).not.toBeNull();
    expect(unusedOf(warnings)).toEqual([expect.stringMatching(/images\/spare\.png: the image is not used by any text or entry/)]);
  });

  it('FR-9 an image used by an event text, by an entry text or by a lead image gives none', () => {
    const { warnings } = loadModified((dir) => {
      for (const name of ['by-event', 'by-entry', 'by-lead']) fs.copyFileSync(path.join(dir, 'images/hero.png'), path.join(dir, `images/${name}.png`));
      writeEvent(dir, '6050-4-001-01-img.md', 'title: X\nlocation: main-only', '![Kuva](images/by-event.png)');
      writeEntry(dir, 'extra.md', 'type: note\nname: X\nimage: images/by-lead.png', '![Kuva](images/by-entry.png)\n\n[[hero]]');
    });
    expect(unusedOf(warnings).filter((w) => /image is not used/.test(w))).toEqual([]);
  });

  it('FR-9 an image used only in the English section, or in a journal passage, counts as used', () => {
    const { warnings } = loadModified((dir) => {
      for (const name of ['by-en', 'by-passage']) fs.copyFileSync(path.join(dir, 'images/hero.png'), path.join(dir, `images/${name}.png`));
      writeEvent(dir, '6050-4-001-01-img.md', 'title: X\nlocation: main-only',
        'Teksti.\n\n:::journal{for="hero"}\n![Kuva](images/by-passage.png)\n:::\n\n@en\nText.\n\n![Pic](images/by-en.png)');
    });
    expect(unusedOf(warnings)).toEqual([]);
  });

  it('FR-9 a map image in the images folder is not reported', () => {
    const { warnings } = loadModified((dir) => {
      fs.mkdirSync(path.join(dir, 'images/maps'), { recursive: true });
      fs.copyFileSync(path.join(dir, 'maps/second-map.png'), path.join(dir, 'images/maps/m.png'));
      editJson(dir, 'maps.json', (d) => { d[1].image = 'images/maps/m.png'; });
    });
    expect(unusedOf(warnings)).toEqual([]);
  });
});

describe('unused locations (B-35)', () => {
  const withLocation = (change?: (dir: string) => void) => loadModified((dir) => {
    editJson(dir, 'locations.json', (d) => { d.push({ id: 'spare', name: 'Spare', positions: { 'main-map': [5, 5] } }); });
    change?.(dir);
  });

  it('FR-9 a location that no event and no entry uses gives a warning naming locations.json and the id', () => {
    const { bundle, warnings } = withLocation();
    expect(bundle).not.toBeNull();
    expect(unusedOf(warnings)).toEqual([expect.stringMatching(/locations\.json: location "spare" is not used by any event or location entry/)]);
  });

  it('FR-9 used as the location of an event, as showOn.location, or by a location entry, it gives none', () => {
    expect(unusedOf(withLocation((dir) => writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: spare')).warnings)).toEqual([]);
    expect(unusedOf(withLocation((dir) => {
      editJson(dir, 'locations.json', (d) => { d.find((l: any) => l.id === 'spare').positions['second-map'] = [5, 5]; }); // eslint-disable-line @typescript-eslint/no-explicit-any
      writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: n/a\nshowOn:\n  map: second-map\n  location: spare');
    }).warnings)).toEqual([]);
    // A location entry that has no event is itself unused, until a text links to it.
    const { warnings } = withLocation((dir) => {
      writeEntry(dir, 'spare.md', 'type: location');
      writeEntry(dir, 'extra.md', 'type: note\nname: X', '[[spare]] ja [[hero]]');
    });
    expect(unusedOf(warnings)).toEqual([expect.stringMatching(/journal\/extra\.md: the entry is not used/)]);
  });
});

describe('unused entries (B-35)', () => {
  const entryWarnings = (change: (dir: string) => void) =>
    unusedOf(loadModified(change).warnings).filter((w) => /extra\.md/.test(w));

  it('FR-9 an entry that nothing links to gives a warning naming the file', () => {
    expect(entryWarnings((dir) => writeEntry(dir, 'extra.md', 'type: npc\nname: X'))).toEqual([
      expect.stringMatching(/journal\/extra\.md: the entry is not used, no text links to it and no passage is for it/)]);
  });

  it('FR-9 an entry that an event links to, or another entry links to, is used', () => {
    expect(entryWarnings((dir) => {
      writeEntry(dir, 'extra.md', 'type: npc\nname: X');
      writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: main-only', 'Hei [[extra]].');
    })).toEqual([]);
    expect(entryWarnings((dir) => {
      writeEntry(dir, 'extra.md', 'type: npc\nname: X');
      writeEntry(dir, 'other.md', 'type: note\nname: Y', '[[extra]] [[hero]]');
      writeEntry(dir, 'third.md', 'type: note\nname: Z', '[[other]]');
    })).toEqual([]);
  });

  it('FR-9 a link in the English section only counts', () => {
    expect(entryWarnings((dir) => {
      writeEntry(dir, 'extra.md', 'type: npc\nname: X');
      writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: main-only', 'Teksti.\n\n@en\nHi [[extra]].');
    })).toEqual([]);
  });

  it('FR-9 an entry that only a journal passage names is used', () => {
    expect(entryWarnings((dir) => {
      writeEntry(dir, 'extra.md', 'type: npc\nname: X');
      writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: main-only', 'Teksti.\n\n:::journal{for="extra"}\nSalaisuus.\n:::');
    })).toEqual([]);
  });

  it('FR-9 an entry that links only to itself is unused', () => {
    expect(entryWarnings((dir) => writeEntry(dir, 'extra.md', 'type: npc\nname: X', '[[extra]]'))).toHaveLength(1);
  });

  it('FR-9 a location entry that an event is held at is used, and one that nothing refers to is not', () => {
    const base = (dir: string) => editJson(dir, 'locations.json', (d) => { d.push({ id: 'extra', name: 'Extra', positions: { 'main-map': [5, 5] } }); });
    expect(entryWarnings((dir) => {
      base(dir);
      writeEntry(dir, 'extra.md', 'type: location');
      writeEvent(dir, '6050-4-001-01-a.md', 'title: X\nlocation: extra');
    })).toEqual([]);
    expect(entryWarnings((dir) => {
      base(dir);
      writeEntry(dir, 'extra.md', 'type: location');
    })).toEqual([expect.stringMatching(/no text links to it and no event is held at it/)]);
  });
});

describe('the translation summary (B-35)', () => {
  it('FR-9 has one line for the other language, with what is missing in it', () => {
    const { summary } = loadContent(FIXTURES);
    expect(summary).toEqual([
      'English: events 5 of 7 without text, 4 without title; entries 1 of 5 without text, 1 without name; locations 1 of 3 without name; maps 1 of 2 without name; interface texts complete',
    ]);
  });

  it('FR-9 follows the content: an event with English text and title is no longer counted, and a missing interface text is', () => {
    const { summary } = loadModified((dir) => {
      writeEvent(dir, '6050-4-001-01-a.md', 'title:\n  fi: X\n  en: Y\nlocation: main-only', 'Teksti.\n\n@en\nText.');
      editJson(dir, 'ui.json', (d) => { d.maps = 'Kartta'; });
    });
    expect(summary).toEqual([
      'English: events 5 of 8 without text, 4 without title; entries 1 of 5 without text, 1 without name; locations 1 of 3 without name; maps 1 of 2 without name; interface texts 1 of '
      + `${Object.keys(JSON.parse(fs.readFileSync(path.join(FIXTURES, 'ui.json'), 'utf8'))).length} missing`,
    ]);
  });

  it('FR-9 a title with no English text is counted separately from a missing text', () => {
    const { summary } = loadModified((dir) => {
      for (const file of fs.readdirSync(path.join(dir, 'events'))) fs.rmSync(path.join(dir, 'events', file));
      writeEvent(dir, '6050-4-001-01-a.md', 'title:\n  fi: X\n  en: Y\nlocation: main-only', 'Teksti.');
      writeEvent(dir, '6050-4-002-01-b.md', 'title: X\nlocation: main-only', 'Teksti.\n\n@en\nText.');
    });
    expect(summary[0]).toMatch(/^English: events 1 of 2 without text, 1 without title; /);
    const only = loadModified((dir) => {
      for (const file of fs.readdirSync(path.join(dir, 'events'))) fs.rmSync(path.join(dir, 'events', file));
      writeEvent(dir, '6050-4-001-01-b.md', 'title: X\nlocation: main-only', 'Teksti.\n\n@en\nText.');
    }).summary;
    expect(only[0]).toMatch(/^English: events 1 of 1 without title; /);
  });

  describe('summarizeTranslations', () => {
    const bundle = (overrides: Partial<LoadedContent> = {}): LoadedContent => ({
      campaign: { languages: ['fi', 'en'], defaultLanguage: 'fi' },
      maps: [{ name: { fi: 'A', en: 'A' } }],
      locations: [{ name: { fi: 'A', en: 'A' } }],
      events: [{ title: { fi: 'A', en: 'A' }, text: { fi: 'a', en: 'a' } }],
      journal: [{ type: 'pc', name: { fi: 'A', en: 'A' }, text: { fi: 'a', en: 'a' } }, { type: 'location', name: 'A', text: { fi: 'a', en: 'a' } }],
      ui: { next: { fi: 'a', en: 'a' } },
      ...overrides,
    } as unknown as LoadedContent);

    it('FR-9 says "complete" when nothing is missing, with the name of the language', () => {
      expect(summarizeTranslations(bundle())).toEqual(['English: complete']);
    });

    it('FR-9 lists only what is missing, with interface texts complete', () => {
      const b = bundle({ events: [{ title: { fi: 'A' }, text: { fi: 'a' } }, { title: { fi: 'A', en: 'A' }, text: { fi: 'a', en: 'a' } }] as never });
      expect(summarizeTranslations(b)).toEqual(['English: events 1 of 2 without text, 1 without title; interface texts complete']);
    });

    it('FR-9 counts the names of entries, but not of location entries, whose name is the location\'s', () => {
      const b = bundle({ journal: [{ type: 'npc', name: 'A', text: { fi: 'a', en: 'a' } }, { type: 'location', name: { fi: 'A' }, text: { fi: 'a', en: 'a' } }] as never });
      expect(summarizeTranslations(b)).toEqual(['English: entries 1 of 2 without name; interface texts complete']);
    });

    it('FR-9 counts the missing interface texts', () => {
      expect(summarizeTranslations(bundle({ ui: { a: { fi: 'a' }, b: 'x', c: { fi: 'c', en: 'c' } } as never })))
        .toEqual(['English: interface texts 2 of 3 missing']);
    });

    it('FR-9 prints nothing for a site with the default language only', () => {
      const b = bundle();
      b.campaign.languages = ['fi'];
      expect(summarizeTranslations(b)).toEqual([]);
    });

    it('FR-9 has a line for each language other than the default', () => {
      const b = bundle();
      b.campaign.languages = ['fi', 'en', 'sv'];
      expect(summarizeTranslations(b)).toHaveLength(2);
      expect(summarizeTranslations(b)[1]).toMatch(/^Swedish: /);
    });
  });
});
