import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyDraft, addLocationsText, checkDraft, formatReport, lineDiff, mergeLocations, openQuestions } from '../../scripts/drafts/draft';
import { FIXTURES } from './content-helpers';

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** A project root whose real content, `campaign/`, is a copy of the fixtures. */
function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulthea-draft-'));
  temps.push(root);
  fs.cpSync(FIXTURES, path.join(root, 'campaign'), { recursive: true });
  return root;
}

const EVENT = '---\ntitle: Testi\nlocation: main-only\n---\nTeksti.\n';
function draftFile(root: string, item: string, file: string, text: string | Buffer) {
  const full = path.join(root, 'drafts', item, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text);
}
const real = (root: string, file: string) => path.join(root, 'campaign', file);
const read = (root: string, file: string) => fs.readFileSync(real(root, file), 'utf8');

describe('checking a draft (B-41)', () => {
  it('FR-9 lists a new event and reports no errors, and leaves the real content alone', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT);
    const before = fs.readdirSync(real(root, 'events')).length;
    const report = checkDraft(root, 'test');
    expect(report.errors).toEqual([]);
    expect(report.newFiles).toEqual(['events/6052-2-021-06-testi.md']);
    expect(report.changedFiles).toEqual([]);
    expect(fs.existsSync(path.join(report.mergedDir, 'events/6052-2-021-06-testi.md'))).toBe(true);
    expect(fs.readdirSync(real(root, 'events')).length).toBe(before);
  });

  it('FR-9 names the draft file in an error', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT.replace('main-only', 'nowhere'));
    const report = checkDraft(root, 'test');
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors.join('\n')).toContain('drafts/test/events/6052-2-021-06-testi.md');
    expect(report.errors.join('\n')).not.toContain('.drafts-merged');
  });

  it('FR-9 shows a file that exists in the real content as a change, with a diff', () => {
    const root = makeRoot();
    const existing = read(root, 'events/6050-1-001-02-second.md');
    draftFile(root, 'test', 'events/6050-1-001-02-second.md', existing.replace('Toinen', 'Muutettu'));
    const report = checkDraft(root, 'test');
    expect(report.newFiles).toEqual([]);
    expect(report.changedFiles.map((c) => c.file)).toEqual(['events/6050-1-001-02-second.md']);
    expect(report.changedFiles[0].diff).toMatch(/^- .*Toinen/m);
    expect(report.changedFiles[0].diff).toMatch(/^\+ .*Muutettu/m);
  });

  it('FR-9 lists a file that is the same as the real one as unchanged', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6050-1-001-02-second.md', read(root, 'events/6050-1-001-02-second.md'));
    const report = checkDraft(root, 'test');
    expect(report.unchangedFiles).toEqual(['events/6050-1-001-02-second.md']);
    expect(report.changedFiles).toEqual([]);
  });

  it('FR-9 lists the open questions of REVIEW.md, and only those', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT);
    draftFile(root, 'test', 'REVIEW.md', '# Review\n\n- [ ] Mikä päivä tämä on?\n- [x] Paikka on selvä.\n  - [ ] Kuka oli läsnä?\nMuu teksti.\n');
    expect(checkDraft(root, 'test').questions).toEqual(['- [ ] Mikä päivä tämä on?', '- [ ] Kuka oli läsnä?']);
  });

  it('FR-9 leaves out the files that are not content, and tells which', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT);
    draftFile(root, 'test', 'images.json', '[]');
    draftFile(root, 'test', 'muistiinpano.txt', 'x');
    draftFile(root, 'test', 'other/file.md', 'x');
    const report = checkDraft(root, 'test');
    expect(report.ignored).toEqual(['muistiinpano.txt', 'other/file.md']);
    expect(report.newFiles).toEqual(['events/6052-2-021-06-testi.md']);
  });

  it('FR-9 reports the warnings that the draft causes, and not the ones the real content has already', () => {
    const root = makeRoot();
    fs.writeFileSync(real(root, 'locations.json'), addLocationsText(read(root, 'locations.json'), [
      { id: 'idle', name: 'Idle', positions: { 'main-map': [10, 10] } },
    ]));
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT);
    expect(checkDraft(root, 'test').warnings.filter((w) => w.includes('idle'))).toEqual([]);
    draftFile(root, 'test2', 'locations.add.json', JSON.stringify([{ id: 'idle-too', name: 'Idle Too', positions: { 'main-map': [20, 20] } }]));
    expect(checkDraft(root, 'test2').warnings.filter((w) => w.includes('idle-too'))).not.toEqual([]);
  });

  it('refuses a draft that does not exist and an item that is not a slug', () => {
    const root = makeRoot();
    expect(() => checkDraft(root, 'nothing')).toThrow('drafts/nothing/ was not found');
    expect(() => checkDraft(root, 'Not A Slug')).toThrow('letters, digits and hyphens');
  });

  it('gives a report that names the parts', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT);
    const text = formatReport(checkDraft(root, 'test'));
    expect(text).toContain('New files (1)');
    expect(text).toContain('The draft has no errors.');
  });
});

describe('the locations of a draft (B-41)', () => {
  const place = { id: 'uusi', name: { fi: 'Uusi', en: 'New' }, positions: { 'main-map': [10, 20] as [number, number] } };

  it('FR-1 adds a new id, in the style of the file, and leaves the rest of the text as it was', () => {
    const root = makeRoot();
    const original = read(root, 'locations.json');
    draftFile(root, 'test', 'locations.add.json', JSON.stringify([place]));
    const report = checkDraft(root, 'test');
    expect(report.errors).toEqual([]);
    expect(report.locations.added).toEqual(['uusi']);
    const merged = fs.readFileSync(path.join(report.mergedDir, 'locations.json'), 'utf8');
    expect(merged.startsWith(original.slice(0, original.lastIndexOf(']')).trimEnd())).toBe(true);
    expect(JSON.parse(merged).map((l: { id: string }) => l.id)).toEqual(['both-places', 'main-only', 'second-only', 'uusi']);
  });

  it('FR-1 accepts the same entry again, and does not add it twice', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'locations.add.json', JSON.stringify([JSON.parse(read(root, 'locations.json'))[1]]));
    const report = checkDraft(root, 'test');
    expect(report.errors).toEqual([]);
    expect(report.locations).toEqual({ added: [], same: ['main-only'], conflicts: [] });
  });

  it('FR-1 rejects a different entry with an id that exists, naming the draft file', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'locations.add.json', JSON.stringify([{ id: 'main-only', name: 'Eri nimi', positions: { 'main-map': [1, 1] } }]));
    const report = checkDraft(root, 'test');
    expect(report.locations.conflicts).toEqual(['main-only']);
    expect(report.errors.join('\n')).toContain('drafts/test/locations.add.json: the location "main-only" is already');
  });

  it('FR-1 reports a position that is outside the map, naming the draft file', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'locations.add.json', JSON.stringify([{ ...place, positions: { 'main-map': [120, 20] } }]));
    expect(checkDraft(root, 'test').errors.join('\n')).toContain('drafts/test/locations.add.json');
  });

  it('merges by id: new, same, conflicting, and a repeat inside the draft', () => {
    const existing = [{ id: 'a', name: 'A', positions: { m: [1, 1] as [number, number] } }];
    const result = mergeLocations(existing, [
      existing[0],
      { id: 'a', name: 'Muu', positions: { m: [2, 2] } },
      { id: 'b', name: 'B', positions: { m: [3, 3] } },
      { id: 'b', name: 'B', positions: { m: [3, 3] } },
    ]);
    expect(result.same).toEqual(['a', 'b']);
    expect(result.conflicts).toEqual(['a']);
    expect(result.added).toEqual(['b']);
  });

  it('adds to an empty list and to a list with entries', () => {
    expect(JSON.parse(addLocationsText('[]\n', [place]))).toEqual([place]);
    expect(JSON.parse(addLocationsText('[\n  { "id": "a", "name": "A", "positions": {} }\n]\n', [place])).length).toBe(2);
  });
});

describe('applying a draft (B-41)', () => {
  it('FR-9 copies the new files into the real content, and a second run changes nothing', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT);
    expect(applyDraft(root, 'test').copied).toEqual(['events/6052-2-021-06-testi.md']);
    expect(read(root, 'events/6052-2-021-06-testi.md')).toBe(EVENT);
    const again = applyDraft(root, 'test');
    expect(again).toEqual({ copied: [], overwritten: [], locationsAdded: [] });
  });

  it('FR-9 merges the locations into locations.json, once', () => {
    const root = makeRoot();
    const original = read(root, 'locations.json');
    draftFile(root, 'test', 'locations.add.json', JSON.stringify([{ id: 'uusi', name: 'Uusi', positions: { 'main-map': [10, 20] } }]));
    expect(applyDraft(root, 'test').locationsAdded).toEqual(['uusi']);
    const after = read(root, 'locations.json');
    expect(after.startsWith(original.slice(0, original.lastIndexOf(']')).trimEnd())).toBe(true);
    expect(JSON.parse(after).at(-1).id).toBe('uusi');
    expect(applyDraft(root, 'test').locationsAdded).toEqual([]);
    expect(read(root, 'locations.json')).toBe(after);
  });

  it('FR-9 refuses when the check has errors, and writes nothing', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT.replace('main-only', 'nowhere'));
    expect(() => applyDraft(root, 'test')).toThrow('has 1 error');
    expect(fs.existsSync(real(root, 'events/6052-2-021-06-testi.md'))).toBe(false);
  });

  it('FR-9 refuses to replace a file without --overwrite, and replaces it with it', () => {
    const root = makeRoot();
    const file = 'events/6050-1-001-02-second.md';
    const changed = read(root, file).replace('Toinen', 'Muutettu');
    draftFile(root, 'test', file, changed);
    draftFile(root, 'test', 'events/6052-2-021-06-testi.md', EVENT);
    expect(() => applyDraft(root, 'test')).toThrow(/would replace 1 file[\s\S]*--overwrite/);
    expect(read(root, file)).not.toBe(changed);
    expect(fs.existsSync(real(root, 'events/6052-2-021-06-testi.md'))).toBe(false);
    expect(applyDraft(root, 'test', { overwrite: true }).overwritten).toEqual([file]);
    expect(read(root, file)).toBe(changed);
  });

  it('copies the images of the draft', () => {
    const root = makeRoot();
    draftFile(root, 'test', 'images/uusi.webp', Buffer.from([1, 2, 3]));
    // An image that no text uses is only a warning, so the draft is accepted.
    expect(applyDraft(root, 'test').copied).toEqual(['images/uusi.webp']);
    expect(fs.readFileSync(real(root, 'images/uusi.webp'))).toEqual(Buffer.from([1, 2, 3]));
  });
});

describe('the helpers of the drafts (B-41)', () => {
  it('writes a line diff with the lines only in the old text first, then the new', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\nc')).toBe('- b\n+ x');
    expect(lineDiff('a\nb', 'a\nb\nc')).toBe('+ c');
    expect(lineDiff('a', 'a')).toBe('');
  });

  it('finds the open questions', () => {
    expect(openQuestions('- [ ] yksi\r\n- [x] kaksi\n  - [ ] kolme')).toEqual(['- [ ] yksi', '- [ ] kolme']);
  });
});
