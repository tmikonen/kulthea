/**
 * Prepares the GM's notes (one Markdown file, see "Content from the GM notes" in BACKLOG.md) for reading:
 * cuts it into parts, each into its outcome and its plan, removes the Markdown escapes of the export,
 * decodes the embedded pictures into files and writes an outline. It writes only under the work folder
 * (by default `work/` next to the notes) and never changes the notes. It does not interpret the story.
 *
 *   npm run notes:split [-- <notes.md>] [--out <folder>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from 'image-size';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

/** A line that opens a part: `# Osa II, Lapua 2022`, or the plain line `Osa VI, Lapua 2026`. */
const PART_HEADING = /^(?:#\s+)?Osa\s+(I|II|III|IV|V|VI|VII|VIII|IX|X)\b/;
const CHARACTERS_HEADING = /^#\s+Hahmot\b/;
/** The line that opens the outcome of the earlier session, in any of the markups the notes use: `**Edellisellä kerralla:**`, `- Edellisellä kerralla tapahtunutta:`. */
const OUTCOME_MARKER = /^[\s>*_#-]*Edellisellä kerralla/i;
const SETUP_HEADING = /^[\s>*_#-]*Alkuasetelma/i;
const BOLD_LINE = /^\*\*[^*].*\*\*:?\s*$/;
const IMAGE_DEFINITION = /^\[image(\d+)\]:\s*<?data:([^;,]+);base64,([^>\s]*)>?\s*$/;
const IMAGE_REFERENCE = /!\[([^\]]*)\]\[image(\d+)\]/g;

export interface Heading { line: number; kind: 'heading' | 'bold'; text: string }
export interface PictureUse { image: string; line: number; above: string }
export interface PartOutline {
  name: string;
  title: string;
  /** The first and last line of the part in the notes file, 1-based. */
  lines: [number, number];
  outcome: { lines: [number, number] } | null;
  plan: { lines: [number, number] };
  headings: Heading[];
  pictures: PictureUse[];
}
export interface PictureOutline { id: string; file: string; format: 'png' | 'jpeg'; bytes: number; width: number; height: number; usedIn: string[] }
export interface Outline {
  parts: PartOutline[];
  pictures: PictureOutline[];
}
export interface SplitResult {
  /** The files to write, by path under the work folder: text as a string, pictures as bytes. */
  files: Map<string, string | Buffer>;
  outline: Outline;
  /** The report lines, then the warnings. */
  report: string[];
  warnings: string[];
}

/** Removes the backslash escapes of the export (`\!`, `\-`, `\~`, `\(`, `\+`, ...): a backslash before ASCII punctuation. */
export function unescapeMarkdown(text: string): string {
  return text.replace(/\\([!-/:-@[-`{-~])/g, '$1');
}

function pictureName(number: number): string {
  return `image-${String(number).padStart(2, '0')}`;
}

function plainText(line: string): string {
  return unescapeMarkdown(line).replace(/!\[[^\]]*\]\[image\d+\]/g, '').replace(/[*_#>]/g, '').replace(/^[\s-]+/, '').trim();
}

/** The text of the line above a picture, as a hint of what it shows: the nearest earlier line with words in it. */
function lineAbove(lines: string[], index: number, floor: number): string {
  for (let i = index; i >= floor; i--) {
    const text = plainText(i === index ? lines[i].replace(IMAGE_REFERENCE, '') : lines[i]);
    if (text !== '') return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  }
  return '';
}

export function splitNotes(markdown: string): SplitResult {
  const warnings: string[] = [];
  const lines = markdown.split(/\r?\n/);

  // The pictures are defined at the end of the file, one very long line each. The text is what comes before.
  const pictures = new Map<number, { mime: string; data: string; line: number }>();
  let textEnd = lines.length;
  lines.forEach((line, i) => {
    if (!line.startsWith('[image')) return;
    const match = IMAGE_DEFINITION.exec(line);
    if (!match) return;
    pictures.set(Number(match[1]), { mime: match[2], data: match[3], line: i + 1 });
    textEnd = Math.min(textEnd, i);
  });

  // The pictures are decoded first, because the text refers to their files. The format is taken from the bytes, not from the
  // label of the export: one picture in the notes is labelled PNG but is a JPEG, and is written with the extension it needs.
  const decoded = new Map<number, { ext: 'png' | 'jpg'; bytes: Buffer; width: number; height: number }>();
  for (const [n, picture] of [...pictures].sort((a, b) => a[0] - b[0])) {
    const bytes = Buffer.from(picture.data, 'base64');
    const ext = bytes.subarray(0, 8).equals(PNG_SIGNATURE) ? 'png' : bytes.subarray(0, 3).equals(JPEG_SIGNATURE) ? 'jpg' : null;
    let dims: { width: number; height: number } | null = null;
    if (ext) {
      try {
        dims = imageSize(bytes);
      } catch {
        dims = null;
      }
    }
    if (!ext || !dims) {
      warnings.push(`${pictureName(n)} (line ${picture.line}): the picture cannot be decoded (${picture.mime}, ${bytes.length} bytes), so it is not written.`);
      continue;
    }
    if (ext === 'jpg' && picture.mime !== 'image/jpeg') {
      warnings.push(`${pictureName(n)} (line ${picture.line}): the export says ${picture.mime}, but the bytes are a JPEG, so it is written as ${pictureName(n)}.jpg.`);
    }
    decoded.set(n, { ext, bytes, width: dims.width, height: dims.height });
  }

  // Where the parts begin.
  const starts: { index: number; name: string; kind: 'characters' | number; title: string }[] = [];
  for (let i = 0; i < textEnd; i++) {
    const heading = PART_HEADING.exec(lines[i]);
    if (heading) {
      starts.push({ index: i, name: `part-${ROMAN[heading[1]]}`, kind: ROMAN[heading[1]], title: lines[i].replace(/^#\s+/, '').trim() });
    } else if (CHARACTERS_HEADING.test(lines[i])) {
      starts.push({ index: i, name: 'characters', kind: 'characters', title: lines[i].replace(/^#\s+/, '').trim() });
    }
  }
  const sessionStarts = starts.filter((start) => start.kind !== 'characters');
  if (sessionStarts.length === 0) {
    throw new Error('No parts found in the notes: expected lines such as "# Osa I, ..." (and "Osa VI" as a plain line).');
  }
  if (!starts.some((start) => start.kind === 'characters')) warnings.push('No "# Hahmot" section (the characters) was found.');
  sessionStarts.forEach((start, i) => {
    if (start.kind !== i + 1) warnings.push(`The parts are not in order: "${start.title}" comes ${i + 1}. (expected Osa ${Object.keys(ROMAN)[i]}).`);
  });

  const files = new Map<string, string | Buffer>();
  const parts: PartOutline[] = [];
  const usedPictures = new Map<number, Set<string>>();

  /** The text of lines `from..to` (0-based, inclusive), unescaped and with the picture references turned into links to files. */
  const render = (from: number, to: number, partName: string): string => {
    const text = unescapeMarkdown(lines.slice(from, to + 1).join('\n'));
    return text.replace(IMAGE_REFERENCE, (whole, alt: string, number: string) => {
      const n = Number(number);
      const picture = decoded.get(n);
      if (!picture) {
        if (!pictures.has(n)) warnings.push(`${partName}: a picture reference "![${alt}][image${n}]" has no picture in the notes.`);
        return whole;
      }
      return `![${alt}](images/${pictureName(n)}.${picture.ext})`;
    }) + '\n';
  };

  starts.forEach((start, k) => {
    const end = (starts[k + 1]?.index ?? textEnd) - 1;
    // Trailing blank lines are not part of the text.
    let last = end;
    while (last > start.index && lines[last].trim() === '') last--;
    const range = (from: number, to: number): [number, number] => [from + 1, to + 1];

    // Outcome and plan: the outcome starts after the marker line and ends before the setup of the next session.
    let outcome: PartOutline['outcome'] = null;
    let planFrom = start.index + 1;
    const marker = start.kind === 'characters' ? -1 : lines.findIndex((line, i) => i > start.index && i <= last && OUTCOME_MARKER.test(line));
    if (marker >= 0) {
      let outcomeEnd = last + 1;
      for (let i = marker + 1; i <= last; i++) {
        if (SETUP_HEADING.test(lines[i])) { outcomeEnd = i; break; }
      }
      if (outcomeEnd > last) {
        // No "Alkuasetelma": the outcome ends at the first heading of its own after it.
        for (let i = marker + 1; i <= last; i++) {
          if (BOLD_LINE.test(lines[i]) || /^#/.test(lines[i])) { outcomeEnd = i; break; }
        }
      }
      let outcomeFirst = marker + 1;
      while (outcomeFirst < outcomeEnd && lines[outcomeFirst].trim() === '') outcomeFirst++;
      let outcomeLast = outcomeEnd - 1;
      while (outcomeLast > outcomeFirst && lines[outcomeLast].trim() === '') outcomeLast--;
      outcome = { lines: range(outcomeFirst, outcomeLast) };
      planFrom = outcomeEnd;
    } else if (start.kind !== 'characters' && start.kind !== 1) {
      warnings.push(`${start.name} (${start.title}): no outcome marker ("Edellisellä kerralla ...") was found, so the whole part is taken as the plan.`);
    }

    files.set(`${start.name}.md`, render(start.index, last, start.name));
    if (outcome) files.set(`${start.name}-outcome.md`, render(outcome.lines[0] - 1, outcome.lines[1] - 1, start.name));
    if (start.kind !== 'characters') {
      while (planFrom <= last && lines[planFrom].trim() === '') planFrom++;
      files.set(`${start.name}-plan.md`, render(planFrom, last, start.name));
    }

    const headings: Heading[] = [];
    const used: PictureUse[] = [];
    for (let i = start.index; i <= last; i++) {
      const line = lines[i];
      if (/^#{1,6}\s/.test(line)) headings.push({ line: i + 1, kind: 'heading', text: plainText(line) });
      else if (BOLD_LINE.test(line)) headings.push({ line: i + 1, kind: 'bold', text: plainText(line) });
      for (const reference of line.matchAll(IMAGE_REFERENCE)) {
        const n = Number(reference[2]);
        if (!decoded.has(n)) continue;
        used.push({ image: pictureName(n), line: i + 1, above: lineAbove(lines, i, start.index) });
        usedPictures.set(n, (usedPictures.get(n) ?? new Set()).add(start.name));
      }
    }
    const title = start.title;
    const plan: PartOutline['plan'] = { lines: range(planFrom, last) };
    parts.push({ name: start.name, title, lines: range(start.index, last), outcome, plan, headings, pictures: used });
  });

  // The pictures.
  const pictureOutline: PictureOutline[] = [];
  for (const [n, picture] of [...decoded].sort((a, b) => a[0] - b[0])) {
    const id = pictureName(n);
    const file = `images/${id}.${picture.ext}`;
    files.set(file, picture.bytes);
    const usedIn = [...(usedPictures.get(n) ?? [])];
    if (usedIn.length === 0) warnings.push(`${id} (line ${pictures.get(n)!.line}): the picture is not used in the text.`);
    pictureOutline.push({ id, file, format: picture.ext === 'png' ? 'png' : 'jpeg', bytes: picture.bytes.length, width: picture.width, height: picture.height, usedIn });
  }

  const outline: Outline = { parts, pictures: pictureOutline };
  files.set('outline.json', `${JSON.stringify(outline, null, 2)}\n`);

  const sessions = parts.filter((part) => part.name !== 'characters');
  const report = [
    `Parts: ${sessions.length} sessions${parts.some((part) => part.name === 'characters') ? ' and the characters' : ''}; ${sessions.filter((part) => part.outcome).length} with an outcome.`,
    `Pictures: ${pictures.size} in the notes, ${pictureOutline.length} written, ${pictureOutline.filter((p) => p.bytes > 1024 * 1024).length} over 1 MB.`,
    `Text: ${[...files.entries()].filter(([name]) => name.endsWith('.md')).length} files.`,
  ];
  return { files, outline, report, warnings };
}

const OWN_OUTPUT = (name: string) => name === 'outline.json' || /^(characters|part-\d+)(-outcome|-plan)?\.md$/.test(name);

/** Writes the result under `outDir`, replacing the files of an earlier run (and only those). */
export function writeWork(outDir: string, result: SplitResult): void {
  fs.mkdirSync(path.join(outDir, 'images'), { recursive: true });
  for (const name of fs.readdirSync(outDir)) if (OWN_OUTPUT(name)) fs.rmSync(path.join(outDir, name));
  for (const name of fs.readdirSync(path.join(outDir, 'images'))) if (/^image-\d+\.(png|jpg)$/.test(name)) fs.rmSync(path.join(outDir, 'images', name));
  for (const [name, content] of result.files) fs.writeFileSync(path.join(outDir, name), content);
}

/** The notes file to read: the argument, or the newest `gm-notes/*.md`. */
export function findNotes(argument: string | undefined, root: string): string {
  if (argument) {
    if (!fs.existsSync(argument)) throw new Error(`The notes file "${argument}" was not found.`);
    return argument;
  }
  const folder = path.join(root, 'gm-notes');
  const candidates = fs.existsSync(folder)
    ? fs.readdirSync(folder).filter((name) => name.endsWith('.md')).map((name) => path.join(folder, name))
    : [];
  if (candidates.length === 0) throw new Error(`No notes file was given and there is no gm-notes/*.md in ${root}.`);
  return candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function main(): void {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const out = outIndex >= 0 ? args.splice(outIndex, 2)[1] : undefined;
  try {
    const notes = findNotes(args[0], process.cwd());
    const outDir = out ?? path.join(path.dirname(notes), 'work');
    const result = splitNotes(fs.readFileSync(notes, 'utf8'));
    writeWork(outDir, result);
    console.log(`Notes: ${notes}\nWritten to: ${outDir}`);
    for (const line of result.report) console.log(line);
    for (const warning of result.warnings) console.warn(`Warning: ${warning}`);
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
