import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadContent } from '../../plugin/load-content';
import { cleanupTempContent, FIXTURES, loadModified, writeEntry } from './content-helpers';

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
    const missing = loadModified((dir) => fs.rmSync(path.join(dir, 'journal'), { recursive: true }));
    expect(missing.errors).toEqual([]);
    expect(missing.bundle?.journal).toEqual([]);
    const empty = loadModified((dir) => {
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
