/**
 * Drafts: proposals for the real content, made from the GM's notes. A draft is a folder `drafts/<item>/` laid out like a
 * content folder with only the new or changed files (`events/`, `journal/`, `images/`), plus `locations.add.json` (places
 * to add to `locations.json`), `images.json`, `aliases.json` and `REVIEW.md`, which the content files do not include.
 *
 *   npm run draft:check -- <item>               validates the draft over the real content and reports
 *   npm run draft:dev -- <item>                 the same, then shows the draft on the dev server
 *   npm run draft:apply -- <item> [--overwrite]  copies the draft into the real content
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadContent } from '../../plugin/load-content.ts';
import { REAL_CONTENT_DIR } from '../content-dir.ts';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The folders of a draft that are copied into the content. */
const CONTENT_FOLDERS = ['events', 'journal', 'images'];
/** Files at the top of a draft that belong to the work on the draft, not to the content. */
const WORK_FILES = ['locations.add.json', 'images.json', 'aliases.json', 'REVIEW.md'];

export interface Location {
  id: string;
  name: unknown;
  positions: Record<string, [number, number]>;
  [key: string]: unknown;
}

export interface FileChange {
  /** The path inside the content folder, with forward slashes. */
  file: string;
  /** A line diff for a text file, or a note for another kind. */
  diff: string;
}

export interface LocationMerge {
  added: string[];
  same: string[];
  /** Ids that are in the real content with a different entry. */
  conflicts: string[];
}

export interface DraftReport {
  item: string;
  /** The merged content folder, where the draft was laid over the real content. */
  mergedDir: string;
  newFiles: string[];
  changedFiles: FileChange[];
  unchangedFiles: string[];
  /** Files at the top of the draft or in folders that are not content, which are left out. */
  ignored: string[];
  locations: LocationMerge;
  errors: string[];
  warnings: string[];
  /** The open questions of `REVIEW.md`: its lines that start with `- [ ]`. */
  questions: string[];
}

const slash = (file: string) => file.split(path.sep).join('/');

/** All files below a folder, as paths relative to it. */
function listFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return (fs.readdirSync(dir, { recursive: true }) as string[])
    .map(String)
    .filter((entry) => fs.statSync(path.join(dir, entry)).isFile())
    .map(slash)
    .sort();
}

/** A line diff of two texts: lines only in the old text start with `-`, lines only in the new one with `+`. */
export function lineDiff(before: string, after: string): string {
  const a = before.split('\n');
  const b = after.split('\n');
  // The longest common subsequence of lines; the files are small.
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (i < a.length && (j === b.length || table[i + 1][j] >= table[i][j + 1])) {
      out.push(`- ${a[i++]}`);
    } else {
      out.push(`+ ${b[j++]}`);
    }
  }
  return out.join('\n');
}

const sameEntry = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** One entry of `locations.json`, written in the style of the file: the id and name on a line, the positions below. */
function locationText(location: Location): string {
  const { id, name, positions, ...rest } = location;
  const extra = Object.entries(rest).map(([key, value]) => `, ${JSON.stringify(key)}: ${JSON.stringify(value)}`).join('');
  return `  { "id": ${JSON.stringify(id)}, "name": ${JSON.stringify(name)}${extra},\n    "positions": ${JSON.stringify(positions)} }`;
}

/** The text of `locations.json` with the new locations added at the end, so that the existing text stays as it was. */
export function addLocationsText(original: string, added: Location[]): string {
  if (added.length === 0) return original;
  const end = original.lastIndexOf(']');
  const before = original.slice(0, end).replace(/\s*$/, '');
  const hasEntries = before.trim() !== '[';
  return `${before}${hasEntries ? ',' : ''}\n${added.map(locationText).join(',\n')}\n${original.slice(end)}`;
}

/** Compares the draft's locations with the real ones. */
export function mergeLocations(real: Location[], additions: Location[]): LocationMerge & { toAdd: Location[] } {
  const result: LocationMerge & { toAdd: Location[] } = { added: [], same: [], conflicts: [], toAdd: [] };
  const seen = new Map(real.map((location) => [location.id, location]));
  for (const location of additions) {
    const existing = seen.get(location.id);
    if (!existing) {
      result.added.push(location.id);
      result.toAdd.push(location);
      seen.set(location.id, location);
    } else if (sameEntry(existing, location)) result.same.push(location.id);
    else result.conflicts.push(location.id);
  }
  return result;
}

function readLocations(file: string, errors: string[], label: string): Location[] {
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data)) throw new Error('it must be a list of locations');
    return data as Location[];
  } catch (e) {
    errors.push(`${label}: ${(e as Error).message}`);
    return [];
  }
}

/** The questions of `REVIEW.md`: every line that starts with `- [ ]`. */
export function openQuestions(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => /^\s*- \[ \]/.test(line)).map((line) => line.trim());
}

/**
 * Lays the draft over the real content in `<root>/.drafts-merged/<item>/`, loads the result with the normal
 * loader, and reports. The real content is not changed. The map images are not copied: the merged `maps.json`
 * points to the real folder's images.
 */
export function checkDraft(root: string, item: string, realName: string = REAL_CONTENT_DIR): DraftReport {
  if (!SLUG.test(item)) throw new Error(`The draft item "${item}" must be letters, digits and hyphens, for example "session-2021".`);
  const draftDir = path.join(root, 'drafts', item);
  if (!fs.existsSync(draftDir)) throw new Error(`The draft folder drafts/${item}/ was not found.`);
  const realDir = path.join(root, realName);
  if (!fs.existsSync(realDir)) throw new Error(`The real content folder ${realName}/ was not found.`);
  const mergedDir = path.join(root, '.drafts-merged', item);
  const draftLabel = `drafts/${item}`;

  const errors: string[] = [];
  const newFiles: string[] = [];
  const changedFiles: FileChange[] = [];
  const unchangedFiles: string[] = [];
  const ignored: string[] = [];

  fs.rmSync(mergedDir, { recursive: true, force: true });
  fs.mkdirSync(mergedDir, { recursive: true });
  for (const file of listFiles(realDir)) {
    if (file.startsWith('maps/')) continue;
    fs.mkdirSync(path.dirname(path.join(mergedDir, file)), { recursive: true });
    fs.copyFileSync(path.join(realDir, file), path.join(mergedDir, file));
  }
  // The merged maps.json points to the images of the real folder, which are not copied.
  const mapsFile = path.join(mergedDir, 'maps.json');
  if (fs.existsSync(mapsFile)) {
    try {
      const maps = JSON.parse(fs.readFileSync(mapsFile, 'utf8')) as { image?: unknown }[];
      for (const map of maps) {
        if (typeof map.image === 'string') map.image = slash(path.relative(mergedDir, path.resolve(realDir, map.image)));
      }
      fs.writeFileSync(mapsFile, JSON.stringify(maps, null, 2));
    } catch {
      // The loader reports an invalid maps.json.
    }
  }

  for (const file of listFiles(draftDir)) {
    if (WORK_FILES.includes(file)) continue;
    if (!CONTENT_FOLDERS.includes(file.split('/')[0]) || !file.includes('/')) {
      ignored.push(file);
      continue;
    }
    const from = path.join(draftDir, file);
    const existing = path.join(realDir, file);
    if (!fs.existsSync(existing)) newFiles.push(file);
    else if (fs.readFileSync(from).equals(fs.readFileSync(existing))) unchangedFiles.push(file);
    else {
      const textual = /\.(md|json)$/.test(file);
      changedFiles.push({
        file,
        diff: textual ? lineDiff(fs.readFileSync(existing, 'utf8'), fs.readFileSync(from, 'utf8')) : '(a binary file that differs)',
      });
    }
    fs.mkdirSync(path.dirname(path.join(mergedDir, file)), { recursive: true });
    fs.copyFileSync(from, path.join(mergedDir, file));
  }

  const realLocationsFile = path.join(realDir, 'locations.json');
  const realLocations = readLocations(realLocationsFile, errors, `${realName}/locations.json`);
  const additions = readLocations(path.join(draftDir, 'locations.add.json'), errors, `${draftLabel}/locations.add.json`);
  const { toAdd, ...locations } = mergeLocations(realLocations, additions);
  for (const id of locations.conflicts) {
    errors.push(`${draftLabel}/locations.add.json: the location "${id}" is already in ${realName}/locations.json with a different entry`);
  }
  if (fs.existsSync(realLocationsFile)) {
    fs.writeFileSync(path.join(mergedDir, 'locations.json'), addLocationsText(fs.readFileSync(realLocationsFile, 'utf8'), toAdd));
  }

  // The loader names files relative to the working directory. Say the draft's own files as the draft's, and the others as the real content's.
  const mergedLabel = slash(path.relative(process.cwd(), mergedDir));
  const translate = (message: string) => {
    let text = message.split('\\').join('/');
    for (const file of [...newFiles, ...changedFiles.map((c) => c.file), ...unchangedFiles]) {
      text = text.split(`${mergedLabel}/${file}`).join(`${draftLabel}/${file}`);
    }
    if (locations.added.length > 0) text = text.split(`${mergedLabel}/locations.json`).join(`${draftLabel}/locations.add.json (merged into ${realName}/locations.json)`);
    return text.split(`${mergedLabel}/`).join(`${realName}/`);
  };

  const merged = loadContent(mergedDir);
  errors.push(...merged.errors.map(translate));
  // Warnings that the real content has on its own are not the draft's.
  const realLabel = slash(path.relative(process.cwd(), realDir));
  const before = new Set(loadContent(realDir).warnings.map((warning) => warning.split('\\').join('/').split(`${realLabel}/`).join(`${realName}/`)));
  const warnings = merged.warnings.map(translate).filter((warning) => !before.has(warning));

  const reviewFile = path.join(draftDir, 'REVIEW.md');
  const questions = fs.existsSync(reviewFile) ? openQuestions(fs.readFileSync(reviewFile, 'utf8')) : [];
  return { item, mergedDir, newFiles, changedFiles, unchangedFiles, ignored, locations, errors, warnings, questions };
}

export interface ApplyResult {
  copied: string[];
  overwritten: string[];
  locationsAdded: string[];
}

/**
 * Copies the files of the draft into the real content and adds its locations. It refuses when the check has
 * errors, or when it would replace a file that exists and `overwrite` is not set. Nothing is written when it refuses.
 */
export function applyDraft(root: string, item: string, options: { overwrite?: boolean; realName?: string } = {}): ApplyResult {
  const realName = options.realName ?? REAL_CONTENT_DIR;
  const report = checkDraft(root, item, realName);
  if (report.errors.length > 0) {
    throw new Error(`The draft "${item}" has ${report.errors.length} error(s), so it is not applied. Run "npm run draft:check -- ${item}".`);
  }
  if (report.changedFiles.length > 0 && !options.overwrite) {
    throw new Error(
      `The draft would replace ${report.changedFiles.length} file(s) of ${realName}/:\n${report.changedFiles.map((c) => `  - ${c.file}`).join('\n')}\n` +
        'Run again with --overwrite if that is what you want.',
    );
  }
  const realDir = path.join(root, realName);
  const draftDir = path.join(root, 'drafts', item);
  const result: ApplyResult = { copied: [], overwritten: [], locationsAdded: report.locations.added };
  for (const file of [...report.newFiles, ...report.changedFiles.map((c) => c.file)]) {
    fs.mkdirSync(path.dirname(path.join(realDir, file)), { recursive: true });
    fs.copyFileSync(path.join(draftDir, file), path.join(realDir, file));
    (report.newFiles.includes(file) ? result.copied : result.overwritten).push(file);
  }
  if (report.locations.added.length > 0) {
    fs.copyFileSync(path.join(report.mergedDir, 'locations.json'), path.join(realDir, 'locations.json'));
  }
  return result;
}

export function formatReport(report: DraftReport, realName: string = REAL_CONTENT_DIR): string {
  const lines: string[] = [];
  const list = (title: string, items: string[]) => {
    if (items.length > 0) lines.push(`${title} (${items.length}):`, ...items.map((item) => `  ${item}`));
  };
  lines.push(`Draft "${report.item}" over ${realName}/`);
  list('New files', report.newFiles);
  if (report.changedFiles.length > 0) {
    lines.push(`Changed files (${report.changedFiles.length}):`);
    for (const change of report.changedFiles) lines.push(`  ${change.file}`, ...change.diff.split('\n').map((line) => `    ${line}`));
  }
  list('Unchanged files (the same as in the content)', report.unchangedFiles);
  list('New locations', report.locations.added);
  list('Locations already in the content, the same', report.locations.same);
  list('Not part of the content, left out', report.ignored);
  if (report.newFiles.length + report.changedFiles.length + report.locations.added.length === 0) lines.push('The draft adds and changes nothing.');
  list('Warnings from the draft', report.warnings.map((warning) => `warning: ${warning}`));
  list('Errors', report.errors.map((error) => `error: ${error}`));
  list('Open questions in REVIEW.md', report.questions);
  lines.push(report.errors.length > 0 ? 'The draft has errors.' : 'The draft has no errors.');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  const item = args.find((arg) => !arg.startsWith('--'));
  if (!['check', 'dev', 'apply'].includes(command ?? '') || !item) {
    console.error('Usage: npm run draft:check -- <item> | draft:dev -- <item> | draft:apply -- <item> [--overwrite]');
    process.exitCode = 1;
    return;
  }
  const root = process.cwd();
  try {
    if (command === 'apply') {
      const result = applyDraft(root, item, { overwrite: args.includes('--overwrite') });
      const total = result.copied.length + result.overwritten.length + result.locationsAdded.length;
      for (const file of result.copied) console.log(`Copied ${REAL_CONTENT_DIR}/${file}`);
      for (const file of result.overwritten) console.log(`Replaced ${REAL_CONTENT_DIR}/${file}`);
      for (const id of result.locationsAdded) console.log(`Added the location "${id}" to ${REAL_CONTENT_DIR}/locations.json`);
      console.log(total === 0 ? 'Nothing to do: the content already has everything in the draft.' : `Done: ${total} change(s). Run the tests, then commit.`);
      return;
    }
    const report = checkDraft(root, item);
    console.log(formatReport(report));
    if (report.errors.length > 0) process.exitCode = 1;
    if (command === 'dev') {
      console.log(`\nStarting the dev server on ${path.relative(root, report.mergedDir)}/ (run the command again to see a change in the draft).`);
      const child = spawn('npm', ['run', 'dev'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, CONTENT_DIR: slash(path.relative(root, report.mergedDir)) },
      });
      await new Promise((resolve) => child.on('exit', resolve));
    }
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
