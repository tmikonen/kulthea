import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findNotes, splitNotes, unescapeMarkdown, writeWork } from '../../scripts/notes/split';

const NOTES = path.resolve(__dirname, '../fixtures-notes/notes.md');
const notes = () => fs.readFileSync(NOTES, 'utf8');
const temps: string[] = [];
const tempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kulthea-notes-'));
  temps.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const text = (result: ReturnType<typeof splitNotes>, name: string) => result.files.get(name) as string;

describe('removing the Markdown escapes (B-38)', () => {
  it('removes the backslash before the punctuation that the notes use, and changes nothing else', () => {
    expect(unescapeMarkdown('Hei\\! 5\\-6 \\~10 \\(a\\) \\+2 6052\\. \\[NIMI\\] \\& \\]')).toBe('Hei! 5-6 ~10 (a) +2 6052. [NIMI] & ]');
    expect(unescapeMarkdown('Ääkköset, *kursiivi* ja **lihava** ja -viiva- sekä sana\\n')).toBe('Ääkköset, *kursiivi* ja **lihava** ja -viiva- sekä sana\\n');
  });
});

describe('cutting the notes into parts (B-38)', () => {
  const result = splitNotes(notes());

  it('FR-9 cuts the characters and each part at its heading, Osa III also as a plain line', () => {
    expect(result.outline.parts.map((p) => p.name)).toEqual(['characters', 'part-1', 'part-2', 'part-3']);
    expect(text(result, 'characters.md')).toContain('# Hahmot');
    expect(text(result, 'characters.md')).not.toContain('Osa I');
    expect(text(result, 'part-1.md')).toContain('Ensimmäinen peli');
    expect(text(result, 'part-1.md')).not.toContain('Toinen peli');
    expect(text(result, 'part-3.md').startsWith('Osa III, Testikylä 2023')).toBe(true);
    expect(text(result, 'part-3.md')).not.toContain('image3');
  });

  it('FR-9 gives each part its line range in the notes', () => {
    const lines = notes().split('\n');
    for (const part of result.outline.parts) {
      expect(lines[part.lines[0] - 1]).toMatch(/Hahmot|Osa/);
    }
    expect(result.outline.parts.map((part) => part.lines[0])).toEqual([1, 9, 15, 33]);
  });

  it('FR-9 splits a part at the outcome marker, in each markup, and the outcome ends at the setup', () => {
    expect(text(result, 'part-2-outcome.md')).toBe('Sankarit voittivat peikon.\n\n![](images/image-01.png) ![][image3]\n');
    expect(text(result, 'part-2-plan.md').startsWith('**Alkuasetelma:**')).toBe(true);
    expect(text(result, 'part-2-plan.md')).toContain('Pimeä paikka.');
    expect(result.outline.parts[2].outcome).not.toBeNull();
    // Part III has a marker as a list item, and no setup: the outcome ends at the next bold heading.
    expect(text(result, 'part-3-outcome.md')).toContain('Mentiin takaisin.');
    expect(text(result, 'part-3-plan.md').startsWith('**Suunnitelma**')).toBe(true);
  });

  it('FR-9 takes a part with no marker as all plan, and warns except for the first part', () => {
    const noMarker = splitNotes(notes().replace(/\*\*Edellisellä kerralla tapahtunutta:\*\*/, 'Aiemmin.'));
    expect(noMarker.files.has('part-2-outcome.md')).toBe(false);
    expect(noMarker.outline.parts[2].outcome).toBeNull();
    expect(text(noMarker, 'part-2-plan.md')).toContain('Sankarit voittivat peikon.');
    expect(noMarker.warnings.filter((w) => /no outcome marker/.test(w))).toEqual([expect.stringMatching(/^part-2 /)]);
    expect(result.warnings.some((w) => /^part-1 /.test(w))).toBe(false);
    expect(result.files.has('part-1-outcome.md')).toBe(false);
  });

  it('FR-9 removes the escapes from the text', () => {
    expect(text(result, 'characters.md')).toContain('“Hei!” ja meni etelään (kauas). Pituus 5-6 m, noin ~10 kg, +2 voimaa. [NIMI]');
    expect(text(result, 'characters.md')).not.toContain('\\');
  });

  it('FR-9 lists the headings of each part, as headings and as bold lines', () => {
    expect(result.outline.parts[2].headings).toEqual([
      { line: 15, kind: 'heading', text: 'Osa II, Testikylä 2022' },
      { line: 17, kind: 'bold', text: 'Edellisellä kerralla tapahtunutta:' },
      { line: 23, kind: 'bold', text: 'Alkuasetelma:' },
      { line: 27, kind: 'bold', text: 'Luola' },
    ]);
  });

  it('FR-9 fails with a clear message when no part is found, and when the file is not found', () => {
    expect(() => splitNotes('Vain tekstiä.\n')).toThrow(/No parts found/);
    expect(() => findNotes('/no/such/notes.md', os.tmpdir())).toThrow(/was not found/);
    expect(() => findNotes(undefined, tempDir())).toThrow(/no gm-notes\/\*\.md/);
  });

  it('FR-9 warns when the parts are out of order, or the characters are missing', () => {
    const swapped = splitNotes(notes().replace('# Osa II,', '# Osa V,'));
    expect(swapped.warnings.some((w) => /not in order/.test(w))).toBe(true);
    expect(splitNotes(notes().replace('# Hahmot', '# Muut')).warnings.some((w) => /Hahmot/.test(w))).toBe(true);
  });
});

describe('the pictures (B-38)', () => {
  const result = splitNotes(notes());

  it('FR-9 writes a picture that decodes, with the same bytes, and refers to it by its file', () => {
    const bytes = result.files.get('images/image-01.png') as Buffer;
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(text(result, 'part-2.md')).toContain('![](images/image-01.png)');
    expect(text(result, 'part-2.md')).not.toContain('![][image1]');
    expect(text(result, 'part-2.md')).not.toContain('![][image2]');
  });

  it('FR-9 reports a picture that cannot be decoded, and does not write it', () => {
    expect(result.files.has('images/image-03.png')).toBe(false);
    expect(result.warnings).toContainEqual(expect.stringMatching(/^image-03 .*cannot be decoded/));
    expect(text(result, 'part-2.md')).toContain('![][image3]');
  });

  it('FR-9 reports a picture that nothing uses', () => {
    expect(result.files.has('images/image-04.png')).toBe(true);
    expect(result.warnings).toContainEqual(expect.stringMatching(/^image-04 .*not used in the text/));
    expect(result.warnings.some((w) => /^image-0[12] .*not used/.test(w))).toBe(false);
  });

  it('FR-9 lists in the outline each picture of a part with the line above it, and the size of each picture', () => {
    expect(result.outline.parts[2].pictures).toEqual([
      { image: 'image-01', line: 21, above: 'Sankarit voittivat peikon.' },
      { image: 'image-02', line: 31, above: 'Pimeä paikka.' },
    ]);
    expect(result.outline.pictures.map((p) => [p.id, p.width, p.height, p.usedIn])).toEqual([
      ['image-01', 1, 1, ['characters', 'part-2']],
      ['image-02', 1, 1, ['part-2']],
      ['image-04', 1, 1, []],
    ]);
    expect(result.outline.pictures[0].bytes).toBe((result.files.get('images/image-01.png') as Buffer).length);
  });

  it('FR-9 a JPEG that the export labels PNG is written as a .jpg and reported', () => {
    const jpeg = fs.readFileSync(path.resolve(__dirname, '../fixtures-notes/tiny.jpg'));
    const marked = splitNotes(notes().replace('bm90IGEgcGljdHVyZQ==', jpeg.toString('base64')));
    expect(marked.files.has('images/image-03.jpg')).toBe(true);
    expect(marked.files.has('images/image-03.png')).toBe(false);
    expect(text(marked, 'part-2.md')).toContain('![](images/image-03.jpg)');
    expect(marked.warnings).toContainEqual(expect.stringMatching(/^image-03 .*image\/png.*JPEG.*image-03\.jpg/));
    expect(marked.outline.pictures.find((p) => p.id === 'image-03')?.format).toBe('jpeg');
  });

  it('FR-9 the report counts the parts and the pictures', () => {
    expect(result.report).toEqual([
      'Parts: 3 sessions and the characters; 2 with an outcome.',
      'Pictures: 4 in the notes, 3 written, 0 over 1 MB.',
      'Text: 9 files.',
    ]);
  });
});

describe('writing the work folder (B-38)', () => {
  const snapshot = (dir: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const walk = (folder: string) => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) walk(full);
        else out[path.relative(dir, full)] = fs.readFileSync(full).toString('base64');
      }
    };
    walk(dir);
    return out;
  };

  it('FR-9 writes the files, and two runs give identical output', () => {
    const out = tempDir();
    writeWork(out, splitNotes(notes()));
    const first = snapshot(out);
    expect(Object.keys(first)).toContain('outline.json');
    expect(Object.keys(first)).toContain('images/image-01.png');
    writeWork(out, splitNotes(notes()));
    expect(snapshot(out)).toEqual(first);
  });

  it('FR-9 removes the files of an earlier run, but nothing else in the folder', () => {
    const out = tempDir();
    writeWork(out, splitNotes(notes()));
    fs.writeFileSync(path.join(out, 'mine.txt'), 'x');
    const smaller = notes().replace(/# Osa II,[\s\S]*?(?=Osa III)/, '').replace(/\[image4\]:.*\n/, '');
    writeWork(out, splitNotes(smaller));
    expect(fs.existsSync(path.join(out, 'part-2.md'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'part-2-plan.md'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'images/image-04.png'))).toBe(false);
    expect(fs.readFileSync(path.join(out, 'mine.txt'), 'utf8')).toBe('x');
  });

  it('FR-9 does not change the notes', () => {
    const before = fs.readFileSync(NOTES);
    const out = tempDir();
    writeWork(out, splitNotes(notes()));
    expect(fs.readFileSync(NOTES).equals(before)).toBe(true);
  });
});
