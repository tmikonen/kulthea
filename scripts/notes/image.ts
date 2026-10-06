/**
 * Converts one of the pictures that `notes:split` decoded into a WebP for a draft: at most 1600 px wide, about
 * 1 MB at most, transparency kept. It writes `drafts/<item>/images/<name>.webp` and records the picture in
 * `drafts/<item>/images.json`, so a picture is not converted twice. It does not decide which pictures are published.
 *
 *   npm run notes:image -- <item> <number> <name>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const MAX_WIDTH = 1600;
/** A little under the 1 MiB at which the loader warns, so that "about 1 MB" never trips the warning. */
export const MAX_BYTES = 1_000_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface PictureSize { bytes: number; width: number; height: number }
export interface PictureRecord {
  number: number;
  name: string;
  file: string;
  source: string;
  before: PictureSize;
  after: PictureSize;
}
export interface ConvertResult {
  /** `done` when a picture was written, `already` when the same picture was converted before. */
  status: 'done' | 'already';
  record: PictureRecord;
  /** The line above the picture in the notes, from `outline.json`, as a hint for the alt text. */
  hint: string;
}

const pad = (number: number) => String(number).padStart(2, '0');

/** Finds the decoded picture `number` in `gm-notes/work/images/`. */
function findSource(root: string, number: number): string {
  const work = path.join(root, 'gm-notes', 'work');
  if (!fs.existsSync(path.join(work, 'images'))) {
    throw new Error('gm-notes/work/images/ was not found. Run "npm run notes:split" first.');
  }
  for (const ext of ['png', 'jpg']) {
    const file = path.join(work, 'images', `image-${pad(number)}.${ext}`);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`There is no picture number ${number} in gm-notes/work/images/.`);
}

/** The caption hint of a picture: the line above its first use in the notes. */
function hintFor(root: string, number: number): string {
  try {
    const outline = JSON.parse(fs.readFileSync(path.join(root, 'gm-notes', 'work', 'outline.json'), 'utf8'));
    for (const part of outline.parts ?? []) {
      const use = (part.pictures ?? []).find((p: { image: string }) => p.image === `image-${pad(number)}`);
      if (use) return `${part.name}, line ${use.line}: ${use.above}`;
    }
  } catch {
    // The hint is a convenience only.
  }
  return '';
}

/** Scales the picture to at most 1600 px wide and lowers the quality, then the size, until the file is small enough. */
async function toWebp(source: string): Promise<{ data: Buffer; width: number; height: number }> {
  const input = sharp(source);
  const { width: originalWidth = 0 } = await input.metadata();
  let width = Math.min(originalWidth, MAX_WIDTH);
  for (;;) {
    for (let quality = 85; quality >= 40; quality -= 5) {
      const { data, info } = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= MAX_BYTES) return { data, width: info.width, height: info.height };
    }
    width = Math.round(width * 0.85);
    if (width < 200) throw new Error('The picture cannot be made small enough.');
  }
}

export async function convertPicture(root: string, item: string, number: number, name: string): Promise<ConvertResult> {
  if (!SLUG.test(item)) throw new Error(`The draft item "${item}" must be letters, digits and hyphens, for example "session-2021".`);
  if (!SLUG.test(name)) throw new Error(`The name "${name}" must be letters, digits and hyphens, for example "trollin-luola".`);
  if (!Number.isInteger(number) || number < 1) throw new Error(`The picture number "${number}" must be a whole number, for example 15.`);

  const source = findSource(root, number);
  const draft = path.join(root, 'drafts', item);
  const recordFile = path.join(draft, 'images.json');
  const records: PictureRecord[] = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile, 'utf8')) : [];

  const sameNumber = records.find((r) => r.number === number);
  const sameName = records.find((r) => r.name === name);
  if (sameNumber && sameNumber.name === name && fs.existsSync(path.join(draft, sameNumber.file))) {
    return { status: 'already', record: sameNumber, hint: hintFor(root, number) };
  }
  if (sameNumber && sameNumber.name !== name) {
    throw new Error(`Picture ${number} is already in the draft "${item}" as "${sameNumber.name}". Use that name, or remove it from images.json first.`);
  }
  if (sameName && sameName.number !== number) {
    throw new Error(`The name "${name}" is already used in the draft "${item}" for picture ${sameName.number}.`);
  }

  const before = await sharp(source).metadata();
  const { data, width, height } = await toWebp(source);
  const file = `images/${name}.webp`;
  const record: PictureRecord = {
    number,
    name,
    file,
    source: path.relative(root, source).split(path.sep).join('/'),
    before: { bytes: fs.statSync(source).size, width: before.width ?? 0, height: before.height ?? 0 },
    after: { bytes: data.length, width, height },
  };
  fs.mkdirSync(path.join(draft, 'images'), { recursive: true });
  fs.writeFileSync(path.join(draft, file), data);
  const rest = records.filter((r) => r.number !== number);
  fs.writeFileSync(recordFile, `${JSON.stringify([...rest, record].sort((a, b) => a.number - b.number), null, 2)}\n`);
  return { status: 'done', record, hint: hintFor(root, number) };
}

async function main(): Promise<void> {
  const [item, number, name] = process.argv.slice(2);
  if (!item || !number || !name) {
    console.error('Usage: npm run notes:image -- <item> <number> <name>   (for example: -- characters 15 trollin-luola)');
    process.exitCode = 1;
    return;
  }
  try {
    const { status, record, hint } = await convertPicture(process.cwd(), item, Number(number), name);
    const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
    if (status === 'already') {
      console.log(`Picture ${record.number} is already done: drafts/${item}/${record.file} (${record.after.width} x ${record.after.height}, ${kb(record.after.bytes)}).`);
    } else {
      console.log(`Wrote drafts/${item}/${record.file}: ${record.after.width} x ${record.after.height}, ${kb(record.after.bytes)} (the original was ${record.before.width} x ${record.before.height}, ${kb(record.before.bytes)}).`);
    }
    if (hint) console.log(`In the notes: ${hint}`);
    console.log(`Alt text to fill in: ![TODO: describe the picture](${record.file} "TODO: caption, or remove")`);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
