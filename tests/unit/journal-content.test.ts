import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../plugin/load-content';
import { cleanupTempContent, FIXTURES, loadModified, writeEntry, writeEvent } from './content-helpers';

afterEach(cleanupTempContent);

const png = (width: number, height: number) => {
  // Only the signature and the header are needed to read the size.
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.set([8, 2, 0, 0, 0], 24);
  return buffer;
};

describe('journal content (B-20)', () => {
  it('FR-6 the fixture entries are in the bundle, by type and then by id, with their fields', () => {
    const { bundle, errors, warnings } = loadContent(FIXTURES);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(bundle?.journal.map((e) => [e.type, e.id])).toEqual([
      ['pc', 'hero'], ['npc', 'scout'], ['item', 'ring'], ['location', 'both-places'], ['note', 'lore'],
    ]);
    const hero = bundle!.journal[0];
    expect(hero.name).toEqual({ fi: 'Sankari', en: 'Hero' });
    expect(hero.motto).toEqual({ fi: 'Eteenpäin.', en: 'Onward.' });
    expect(hero.image).toEqual({ src: 'images/hero.png', width: 60, height: 40 });
    expect(hero.text.fi).toContain('<p>Sankarin tausta.</p>');
    expect(hero.text.en).toContain('<p>The hero\'s background.</p>');
  });

  it('FR-6 a location entry takes its name from locations.json, and an entry may have no image', () => {
    const { bundle } = loadContent(FIXTURES);
    const place = bundle!.journal.find((e) => e.id === 'both-places')!;
    expect(place.name).toEqual({ fi: 'Molemmat paikat', en: 'Both Places' });
    expect(place.motto).toBeNull();
    expect(bundle!.journal.find((e) => e.id === 'ring')!.image).toBeNull();
  });

  it('FR-6 an entry with only a default-language text is complete, and its text has only that language', () => {
    const { bundle } = loadContent(FIXTURES);
    const scout = bundle!.journal.find((e) => e.id === 'scout')!;
    expect(Object.keys(scout.text)).toEqual(['fi']);
    expect(scout.name).toBe('Tiedustelija');
  });

  it('FR-6 a missing or empty journal folder is allowed', () => {
    /** The fixture events link to entries, so for a campaign with no entries they are replaced by events with no links. */
    const noLinks = (dir: string) => {
      for (const name of ['6050-1-001-01-first.md', '6050-1-001-02-second.md']) {
        const file = path.join(dir, 'events', name);
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\[\[.*\]\].*\n?/g, 'Ei linkkejä.\n'));
      }
    };
    const missing = loadModified((dir) => { noLinks(dir); fs.rmSync(path.join(dir, 'journal'), { recursive: true }); });
    expect(missing.errors).toEqual([]);
    expect(missing.bundle?.journal).toEqual([]);
    const empty = loadModified((dir) => {
      noLinks(dir);
      fs.rmSync(path.join(dir, 'journal'), { recursive: true });
      fs.mkdirSync(path.join(dir, 'journal'));
    });
    expect(empty.errors).toEqual([]);
  });

  describe('errors', () => {
    const only = (change: (dir: string) => void) => loadModified(change).errors;

    it('FR-6 a file name that is not an id', () => {
      expect(only((dir) => writeEntry(dir, 'Bad Name.md', 'type: note\nname: X'))).toEqual([
        expect.stringMatching(/journal\/Bad Name\.md: the file name must be an id/),
      ]);
      expect(only((dir) => writeEntry(dir, 'notes.txt', 'type: note\nname: X'))).toEqual([
        expect.stringMatching(/journal\/notes\.txt: the file name must be an id/),
      ]);
    });

    it('FR-6 "index" is reserved', () => {
      expect(only((dir) => writeEntry(dir, 'index.md', 'type: note\nname: X'))).toEqual([
        expect.stringMatching(/journal\/index\.md: "index" is reserved/),
      ]);
    });

    it('FR-6 a missing or unknown type', () => {
      expect(only((dir) => writeEntry(dir, 'a.md', 'name: X'))).toEqual([expect.stringMatching(/journal\/a\.md: "type" must be one of/)]);
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: monster\nname: X'))).toEqual([expect.stringMatching(/"type" must be one of/)]);
    });

    it('FR-6 a missing name, and a name with no default-language text', () => {
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: item'))).toEqual([expect.stringMatching(/journal\/a\.md: "name" is missing/)]);
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: item\nname:\n  en: Only English'))).toEqual([
        expect.stringMatching(/"name" has no text in the default language "fi"/),
      ]);
    });

    it('FR-6 a location entry with a name, or with an id that is not a location', () => {
      expect(only((dir) => writeEntry(dir, 'main-only.md', 'type: location\nname: Nope'))).toEqual([
        expect.stringMatching(/journal\/main-only\.md: a location entry has no "name"/),
      ]);
      expect(only((dir) => writeEntry(dir, 'nowhere.md', 'type: location'))).toEqual([
        expect.stringMatching(/journal\/nowhere\.md: a location entry must have the id of a location in locations\.json, and "nowhere" is not one/),
      ]);
    });

    it('FR-6 a motto on a type other than a player character', () => {
      for (const type of ['npc', 'item', 'note']) {
        expect(only((dir) => writeEntry(dir, 'a.md', `type: ${type}\nname: X\nmotto: Hi`))).toEqual([
          expect.stringMatching(/journal\/a\.md: only a player character has a "motto"/),
        ]);
      }
    });

    it('FR-6 an image that is missing, outside the folder, a web address or not an image', () => {
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: note\nname: X\nimage: images/nope.png'))).toEqual([
        expect.stringMatching(/journal\/a\.md: image file "images\/nope\.png" not found/),
      ]);
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: note\nname: X\nimage: ../outside.png'))).toEqual([
        expect.stringMatching(/image "\.\.\/outside\.png" is not in the content folder/),
      ]);
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: note\nname: X\nimage: https://example.com/a.png'))).toEqual([
        expect.stringMatching(/is not in the content folder/),
      ]);
      expect(only((dir) => {
        fs.writeFileSync(path.join(dir, 'images', 'broken.png'), 'not an image');
        writeEntry(dir, 'a.md', 'type: note\nname: X\nimage: images/broken.png');
      })).toEqual([expect.stringMatching(/is not a readable image/)]);
    });

    it('FR-9 the language rules of the text: an unconfigured language, no default text, raw HTML', () => {
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: note\nname: X', '@fi\nA\n\n@de\nB'))).toEqual([
        expect.stringMatching(/journal\/a\.md: the text uses the language "de"/),
      ]);
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: note\nname: X', '@en\nOnly English'))).toEqual([
        expect.stringMatching(/journal\/a\.md: the text has no text in the default language "fi"/),
      ]);
      expect(only((dir) => writeEntry(dir, 'a.md', 'type: note\nname: X', 'Hello <b>there</b>'))).toEqual([
        expect.stringMatching(/journal\/a\.md: raw HTML is not allowed in the "fi" text/),
      ]);
    });

    it('FR-6 a file with no front matter, and a bundle is not made when an entry is wrong', () => {
      const result = loadModified((dir) => fs.writeFileSync(path.join(dir, 'journal', 'a.md'), 'Just text'));
      expect(result.errors).toEqual([expect.stringMatching(/journal\/a\.md: the file must start with a front matter block/)]);
      expect(result.bundle).toBeNull();
    });
  });

  describe('image warnings', () => {
    it('FR-6 an image that is too wide, too large or not JPEG, PNG or WebP only warns', () => {
      const wide = loadModified((dir) => {
        fs.writeFileSync(path.join(dir, 'images', 'wide.png'), png(2000, 100));
        writeEntry(dir, 'a.md', 'type: note\nname: X\nimage: images/wide.png');
      });
      expect(wide.errors).toEqual([]);
      expect(wide.bundle?.journal.find((e) => e.id === 'a')?.image).toEqual({ src: 'images/wide.png', width: 2000, height: 100 });
      expect(wide.warnings).toEqual([expect.stringMatching(/journal\/a\.md: image "images\/wide\.png" is over 1600 px wide \(2000 px\)/)]);

      const heavy = loadModified((dir) => {
        fs.writeFileSync(path.join(dir, 'images', 'heavy.png'), Buffer.concat([png(100, 100), Buffer.alloc(1.2 * 1024 * 1024)]));
        writeEntry(dir, 'a.md', 'type: note\nname: X\nimage: images/heavy.png');
      });
      expect(heavy.errors).toEqual([]);
      expect(heavy.warnings).toEqual([expect.stringMatching(/image "images\/heavy\.png" is over about 1 MB/)]);

      const gif = loadModified((dir) => {
        fs.writeFileSync(path.join(dir, 'images', 'a.gif'), Buffer.from('R0lGODlhAQABAAAAACwAAAAAAQABAAA=', 'base64'));
        writeEntry(dir, 'a.md', 'type: note\nname: X\nimage: images/a.gif');
      });
      expect(gif.errors).toEqual([]);
      expect(gif.warnings).toEqual([expect.stringMatching(/image "images\/a\.gif" is gif, not JPEG, PNG or WebP/)]);
    });
  });

  it('FR-6 the demo journal in content/ has every type, some English, and an entry with no image', () => {
    const { bundle, errors, warnings } = loadContent(path.resolve(__dirname, '../../content'));
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    const journal = bundle!.journal;
    expect(journal.filter((e) => e.type === 'pc')).toHaveLength(2);
    expect(journal.filter((e) => e.type === 'npc')).toHaveLength(2);
    expect(journal.filter((e) => e.type === 'item')).toHaveLength(1);
    expect(journal.filter((e) => e.type === 'location')).toHaveLength(2);
    expect(journal.filter((e) => e.type === 'note')).toHaveLength(1);
    expect(journal.some((e) => e.text.en)).toBe(true);
    expect(journal.some((e) => !e.text.en)).toBe(true);
    expect(journal.some((e) => e.image === null)).toBe(true);
    for (const entry of journal.filter((e) => e.type !== 'location')) {
      expect(entry.id.startsWith('demo-')).toBe(true);
    }
  });

  it('FR-6 the real campaign draft in campaign/ is still valid without entries', () => {
    const { errors } = loadContent(path.resolve(__dirname, '../../campaign'));
    expect(errors).toEqual([]);
  });
});

describe('journal links in the build (B-23)', () => {
  it('FR-6 a link to an entry that does not exist fails the build, naming the file, the language and the id', () => {
    const { errors, bundle } = loadModified((dir) =>
      writeEvent(dir, '6050-1-001-03-bad.md', 'title: Huono\nlocation: main-only', '@fi\nTeksti.\n\n@en\nSee [[nobody]].'));
    expect(bundle).toBeNull();
    expect(errors).toEqual([
      expect.stringMatching(/events\/6050-1-001-03-bad\.md: in the "en" text, the link \[\[nobody\]\] names no journal entry "nobody"/),
    ]);
  });

  it('FR-6 every language section is checked, in events and in entries', () => {
    const { errors } = loadModified((dir) => {
      writeEvent(dir, '6050-1-001-03-bad.md', 'title: Huono\nlocation: main-only', '@fi\nSee [[a1]].\n\n@en\nSee [[b2]].');
      writeEntry(dir, 'bad-entry.md', 'type: note\nname: X', '@fi\nTeksti.\n\n@en\nSee [[c3]].');
    });
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/bad\.md: in the "fi" text, the link \[\[a1\]\]/);
    expect(errors.join('\n')).toMatch(/bad\.md: in the "en" text, the link \[\[b2\]\]/);
    expect(errors.join('\n')).toMatch(/journal\/bad-entry\.md: in the "en" text, the link \[\[c3\]\]/);
  });

  it('FR-6 a malformed link is an error with the file', () => {
    const { errors } = loadModified((dir) =>
      writeEvent(dir, '6050-1-001-03-bad.md', 'title: Huono\nlocation: main-only', 'See [[ and [[]].'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.every((e) => /bad\.md: in the "fi" text,/.test(e))).toBe(true);
  });

  it('FR-6 a link to an entry works in an entry text, to any type, and to a location by its id', () => {
    const { errors, bundle } = loadModified((dir) =>
      writeEntry(dir, 'other.md', 'type: note\nname: Muu', 'Katso [[hero]], [[ring]], [[scout]], [[both-places]] ja [[lore|tarina]].'));
    expect(errors).toEqual([]);
    const html = bundle!.journal.find((e) => e.id === 'other')!.text.fi;
    expect(html.match(/data-journal="/g)).toHaveLength(5);
    expect(html).toContain('data-journal="both-places">Molemmat paikat</a>');
    expect(html).toContain('data-journal="lore">tarina</a>');
  });

  it('FR-9 the text of a link follows the language of its section, and falls back to the default name', () => {
    const { bundle } = loadContent(FIXTURES);
    const first = bundle!.events.find((e) => e.id.endsWith('-first'))!;
    expect(first.text.fi).toContain('data-journal="hero">Sankari</a>');
    expect(first.text.en).toContain('data-journal="hero">Hero</a>');
    // A link with no text to an entry that has no English name: the Finnish name.
    const { bundle: other } = loadModified((dir) =>
      writeEvent(dir, '6050-1-001-03-x.md', 'title: X\nlocation: main-only', '@fi\nTeksti [[scout]].\n\n@en\nText [[scout]].'));
    expect(other!.events.find((e) => e.id.endsWith('-x'))!.text.en).toContain('data-journal="scout">Tiedustelija</a>');
  });

  it('FR-6 an entry with its own error does not make every link to it an error too', () => {
    const { errors } = loadModified((dir) => writeEntry(dir, 'hero.md', 'type: monster\nname: X'));
    expect(errors).toEqual([expect.stringMatching(/journal\/hero\.md: "type" must be one of/)]);
  });
});

describe('events listed on entries in the build (B-24)', () => {
  const lists = (bundle: NonNullable<ReturnType<typeof loadContent>['bundle']>, id: string) =>
    bundle.journal.find((e) => e.id === id)!.events;
  const short = (ids: string[]) => ids.map((id) => id.replace(/^6050-/, '').replace(/^\d+-\d+-\d+-/, ''));

  it('FR-6 an entry lists the events whose text links to it, in date order, in each language', () => {
    const { bundle } = loadContent(FIXTURES);
    const hero = lists(bundle!, 'hero');
    expect(Object.keys(hero)).toEqual(['fi', 'en']);
    // The second event has only a Finnish text, so in English the default text is what is shown, and it links.
    expect(short(hero.fi)).toEqual(['first', 'second']);
    expect(short(hero.en)).toEqual(['first', 'second']);
    expect(short(lists(bundle!, 'scout').fi)).toEqual(['second']);
    expect(short(lists(bundle!, 'ring').en)).toEqual(['first']);
    expect(lists(bundle!, 'lore')).toEqual({ fi: [], en: [] });
  });

  it('FR-6 an event links to an entry in a language by the text shown in that language', () => {
    const { bundle } = loadModified((dir) =>
      writeEvent(dir, '6050-1-001-03-mixed.md', 'title: Sekoitus\nlocation: main-only', '@fi\nTässä on [[lore]].\n\n@en\nHere is no link.'));
    expect(short(lists(bundle!, 'lore').fi)).toEqual(['mixed']);
    expect(lists(bundle!, 'lore').en).toEqual([]);
  });

  it('FR-6 a location entry lists the events held there, by location or showOn location, and not events that only mention it', () => {
    const { bundle } = loadModified((dir) => {
      writeEvent(dir, '6050-1-001-03-mention.md', 'title: Maininta\nlocation: main-only', 'Vain maininta: [[both-places]].');
      writeEvent(dir, '6050-1-001-04-shown.md', 'title: Näytetty\nlocation: n/a\nshowOn:\n  map: second-map\n  location: both-places');
    });
    const place = lists(bundle!, 'both-places');
    expect(short(place.fi)).toEqual(['second', 'shown', 'standalone']);
    expect(place.en).toEqual(place.fi);
  });

  it('FR-6 the ids are real event ids, and the order is the date order of the events', () => {
    const { bundle } = loadContent(FIXTURES);
    const order = bundle!.events.map((e) => e.id);
    for (const entry of bundle!.journal) {
      for (const ids of Object.values(entry.events)) {
        expect(ids.every((id) => order.includes(id))).toBe(true);
        expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
      }
    }
  });

  it('FR-6 a link in an entry\'s own text does not put an event on anything', () => {
    const { bundle } = loadContent(FIXTURES);
    // hero links to scout and ring in its own text, but no event does that, except as listed above.
    expect(short(lists(bundle!, 'scout').fi)).toEqual(['second']);
  });
});
