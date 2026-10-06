import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadContent } from '../../plugin/load-content';
import { convertPicture, MAX_BYTES, MAX_WIDTH } from '../../scripts/notes/image';
import { cleanupTempContent, FIXTURES, loadModified, writeEvent } from './content-helpers';

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  cleanupTempContent();
});

/** A project root with the pictures that `notes:split` would have written: 1 large opaque, 2 small, 3 transparent, 4 a JPEG. */
let pictures: Record<string, Buffer>;
beforeAll(async () => {
  const large = await sharp(randomBytes(2400 * 1500 * 3), { raw: { width: 2400, height: 1500, channels: 3 } }).png().toBuffer();
  const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: { r: 200, g: 40, b: 40 } } }).png().toBuffer();
  const clear = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 30, g: 160, b: 60, alpha: 0.4 } } }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 10, g: 20, b: 200 } } }).jpeg().toBuffer();
  pictures = { 'image-01.png': large, 'image-02.png': small, 'image-03.png': clear, 'image-04.jpg': jpeg };
}, 60_000);

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulthea-image-'));
  temps.push(root);
  const images = path.join(root, 'gm-notes', 'work', 'images');
  fs.mkdirSync(images, { recursive: true });
  for (const [name, bytes] of Object.entries(pictures)) fs.writeFileSync(path.join(images, name), bytes);
  return root;
}

const written = (root: string, item: string, name: string) => path.join(root, 'drafts', item, 'images', `${name}.webp`);
const meanOf = async (input: string | Buffer) => (await sharp(input).stats()).channels.map((c) => c.mean);

describe('converting a picture (B-39)', () => {
  it('FR-4 writes a valid WebP of at most 1600 px wide, with the proportions kept, and at most about 1 MB', async () => {
    const root = makeRoot();
    expect(pictures['image-01.png'].length).toBeGreaterThan(1024 * 1024);
    const { status, record } = await convertPicture(root, 'test', 1, 'big-one');
    expect(status).toBe('done');
    const file = written(root, 'test', 'big-one');
    const meta = await sharp(file).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width!).toBeLessThanOrEqual(MAX_WIDTH);
    expect(Math.abs(meta.width! / meta.height! - 2400 / 1500)).toBeLessThan(0.01);
    expect(fs.statSync(file).size).toBeLessThanOrEqual(MAX_BYTES);
    expect(record.after).toEqual({ bytes: fs.statSync(file).size, width: meta.width, height: meta.height });
    expect(record.before).toEqual({ bytes: pictures['image-01.png'].length, width: 2400, height: 1500 });
  }, 60_000);

  it('FR-4 converts a small picture too, without enlarging it, so every picture has one format', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 2, 'small-one');
    const meta = await sharp(written(root, 'test', 'small-one')).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it('FR-4 keeps the transparency, and the colours do not change visibly', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 3, 'clear-one');
    const file = written(root, 'test', 'clear-one');
    expect((await sharp(file).metadata()).hasAlpha).toBe(true);
    const [before, after] = [await meanOf(pictures['image-03.png']), await meanOf(file)];
    before.forEach((mean, i) => expect(Math.abs(mean - after[i])).toBeLessThan(6));

    const opaque = makeRoot();
    await convertPicture(opaque, 'test', 2, 'small-one');
    const [colourBefore, colourAfter] = [await meanOf(pictures['image-02.png']), await meanOf(written(opaque, 'test', 'small-one'))];
    colourBefore.slice(0, 3).forEach((mean, i) => expect(Math.abs(mean - colourAfter[i])).toBeLessThan(6));
  });

  it('FR-4 reads a picture that is a JPEG', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 4, 'jpeg-one');
    expect((await sharp(written(root, 'test', 'jpeg-one')).metadata()).format).toBe('webp');
  });

  it('FR-4 gives the caption hint from the outline, when there is one', async () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'gm-notes', 'work', 'outline.json'),
      JSON.stringify({ parts: [{ name: 'part-2', pictures: [{ image: 'image-02', line: 40, above: 'Peikon luola' }] }] }));
    expect((await convertPicture(root, 'test', 2, 'a')).hint).toBe('part-2, line 40: Peikon luola');
    expect((await convertPicture(root, 'test', 3, 'b')).hint).toBe('');
  });
});

describe('the record and repeating (B-39)', () => {
  it('FR-4 records the number, the name and the sizes in images.json', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 2, 'small-one');
    await convertPicture(root, 'test', 3, 'clear-one');
    const records = JSON.parse(fs.readFileSync(path.join(root, 'drafts', 'test', 'images.json'), 'utf8'));
    expect(records.map((r: { number: number; name: string }) => [r.number, r.name])).toEqual([[2, 'small-one'], [3, 'clear-one']]);
    expect(records[0]).toMatchObject({ file: 'images/small-one.webp', source: 'gm-notes/work/images/image-02.png', before: { width: 300, height: 200 }, after: { width: 300, height: 200 } });
  });

  it('FR-4 a repeated run does nothing and says the picture is already done', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 2, 'small-one');
    const file = written(root, 'test', 'small-one');
    const mtime = fs.statSync(file).mtimeMs;
    const recordText = fs.readFileSync(path.join(root, 'drafts', 'test', 'images.json'), 'utf8');
    const again = await convertPicture(root, 'test', 2, 'small-one');
    expect(again.status).toBe('already');
    expect(fs.statSync(file).mtimeMs).toBe(mtime);
    expect(fs.readFileSync(path.join(root, 'drafts', 'test', 'images.json'), 'utf8')).toBe(recordText);
  });

  it('FR-4 converts again when the file of a recorded picture has been deleted', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 2, 'small-one');
    fs.rmSync(written(root, 'test', 'small-one'));
    expect((await convertPicture(root, 'test', 2, 'small-one')).status).toBe('done');
    expect(fs.existsSync(written(root, 'test', 'small-one'))).toBe(true);
  });

  it('FR-4 refuses a name that is already used for another picture, and a picture that has another name', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 2, 'small-one');
    await expect(convertPicture(root, 'test', 3, 'small-one')).rejects.toThrow(/name "small-one" is already used .* picture 2/);
    await expect(convertPicture(root, 'test', 2, 'other-name')).rejects.toThrow(/Picture 2 is already in the draft "test" as "small-one"/);
    expect(fs.readdirSync(path.join(root, 'drafts', 'test', 'images'))).toEqual(['small-one.webp']);
  });

  it('FR-4 another draft can use the same name and number', async () => {
    const root = makeRoot();
    await convertPicture(root, 'one', 2, 'small-one');
    expect((await convertPicture(root, 'two', 2, 'small-one')).status).toBe('done');
  });
});

describe('refusals write nothing (B-39)', () => {
  it('FR-4 a name that is not a slug, a bad item, and a bad number', async () => {
    const root = makeRoot();
    for (const name of ['Trollin Luola', 'ääkkönen', 'a_b', '-a', 'a--b', '']) {
      await expect(convertPicture(root, 'test', 2, name)).rejects.toThrow(/must be letters, digits and hyphens/);
    }
    await expect(convertPicture(root, 'Bad Item', 2, 'ok')).rejects.toThrow(/draft item/);
    await expect(convertPicture(root, 'test', 0, 'ok')).rejects.toThrow(/whole number/);
    await expect(convertPicture(root, 'test', 1.5, 'ok')).rejects.toThrow(/whole number/);
    expect(fs.existsSync(path.join(root, 'drafts'))).toBe(false);
  });

  it('FR-4 a number that does not exist', async () => {
    const root = makeRoot();
    await expect(convertPicture(root, 'test', 99, 'ok')).rejects.toThrow(/no picture number 99/);
    expect(fs.existsSync(path.join(root, 'drafts'))).toBe(false);
  });

  it('FR-4 a missing gm-notes/work', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulthea-image-'));
    temps.push(root);
    await expect(convertPicture(root, 'test', 1, 'ok')).rejects.toThrow(/Run "npm run notes:split" first/);
    expect(fs.existsSync(path.join(root, 'drafts'))).toBe(false);
  });
});

describe('the content loader accepts the files (B-39)', () => {
  it('FR-4 a text that uses a converted picture loads with no image warning', async () => {
    const root = makeRoot();
    await convertPicture(root, 'test', 1, 'big-one');
    const { bundle, errors, warnings } = loadModified((dir) => {
      fs.copyFileSync(written(root, 'test', 'big-one'), path.join(dir, 'images', 'big-one.webp'));
      writeEvent(dir, '6050-4-001-01-pic.md', 'title: X\nlocation: main-only', '![Kohinaa](images/big-one.webp "Otsikko")');
    });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(bundle!.events.some((e) => e.id === '6050-4-001-01-pic')).toBe(true);
    expect(loadContent(FIXTURES).warnings).toEqual([]);
  }, 60_000);
});
