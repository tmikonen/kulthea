/**
 * The link helper: finds the places in a draft's Finnish text where a known name occurs without a `[[link]]`, matching
 * the Finnish endings, and with `--apply` writes the sure ones as `[[id|word as written]]`, so that the text stays as the
 * GM wrote it. It changes only the draft's own files, and never text inside a link, a heading, a code span, a passage
 * marker, a Markdown link or a picture.
 *
 *   npm run draft:links -- <item> [--apply]
 *
 * Names come from the journal entries and the locations of the real content and of the draft. Extra words for an id
 * (a nickname, the shorter name used in the notes) go into `drafts/<item>/aliases.json`: `{ "word": "id" }`.
 *
 * Limits: the endings are the regular cases of a name as it is written. A name whose stem changes in a way that the
 * helper does not know (consonant gradation, such as Kuningas to Kuninkaan) is found in the cases without the change,
 * and the others need an alias.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { REAL_CONTENT_DIR } from '../content-dir.ts';

/** An entry that a link can point to: a journal entry, with every name it has in any language. */
export interface KnownEntry {
  id: string;
  type: string;
  names: string[];
}

export interface TextMatch {
  /** Offsets in the text, the end exclusive. */
  start: number;
  end: number;
  word: string;
  /** The ids the word could mean. One id makes the match sure. */
  ids: string[];
}

export interface Suggestion extends TextMatch {
  file: string;
  line: number;
  context: string;
  sure: boolean;
}

export interface Candidate {
  word: string;
  count: number;
}

const VOWELS = 'aeiouyäö';

/** The endings of a name that ends in a vowel: the cases of "Bentara" (Bentaran, Bentaraa, Bentarassa, Bentaraan, Bentaralle). */
const AFTER_VOWEL = ['n', 'a', 'ä', 'ta', 'tä', 'na', 'nä', 'ksi', 'ssa', 'ssä', 'sta', 'stä', 'lla', 'llä', 'lta', 'ltä', 'lle', 'tta', 'ttä', 't'];
/** The endings of a name that ends in a consonant, with the linking i: the cases of "Marek" (Marekin, Marekia, Marekille, Marekista). */
const AFTER_CONSONANT = ['in', 'ia', 'iä', 'ina', 'inä', 'iksi', 'issa', 'issä', 'ista', 'istä', 'iin', 'illa', 'illä', 'ilta', 'iltä', 'ille', 'itta', 'ittä', 'it'];
/** Endings that can follow any case: "Marekkin", "Leanhan". */
const CLITICS = ['kin', 'kaan', 'kään', 'han', 'hän', 'pa', 'pä'];

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface Term {
  text: string;
  ids: Set<string>;
  regex: RegExp;
}

/** The pattern of a name with its endings. The first letter may be either case only when it is lowercase in the name. */
function termPattern(text: string): string {
  const words = text.trim().split(/\s+/).map(escape);
  const first = text[0];
  const lead = first === first.toLowerCase() && first !== first.toUpperCase() ? `[${first}${first.toUpperCase()}]` : escape(first);
  const stem = lead + words.join('\\s+').slice(escape(first).length);
  const last = text.trim().slice(-1).toLowerCase();
  const alternatives: string[] = [];
  const add = (base: string, endings: string[]) => alternatives.push(`${base}(?:${[...endings].sort((a, b) => b.length - a.length).join('|')})`);
  if (VOWELS.includes(last)) add(stem, [...AFTER_VOWEL, `${last}n`]);
  else add(stem, AFTER_CONSONANT);
  // Names in -s (Bombus): Bombusta, Bombuksen, Bombukselle.
  if (last === 's') {
    add(stem, ['ta', 'tä']);
    add(stem.slice(0, -1), ['ksen', 'kseen', 'ksena', 'ksessa', 'ksesta', 'ksella', 'kselta', 'kselle', 'ksetta', 'ksi']);
  }
  // Names in -nen (Pitkävihainen) change to -se- before the endings: Pitkävihaisen, Pitkävihaiselle.
  if (/nen$/i.test(text.trim())) {
    add(stem.replace(/nen$/i, 'se'), AFTER_VOWEL.filter((e) => e !== 't'));
    add(stem.replace(/nen$/i, 's'), ['ta', 'tä']);
  }
  const clitic = `(?:${CLITICS.join('|')})?`;
  return `(?<![\\p{L}\\p{N}_-])(?:${stem}|${alternatives.join('|')})${clitic}(?![\\p{L}\\p{N}])`;
}

/**
 * The words that stand for each id: the names in every language, the id itself, the aliases, and, for a player
 * character or an NPC, the first word of a name of two or more words (the "Marek" of "Marek Baalik"). A word that
 * several ids have is one term with all of them, so a match of it is unsure.
 */
export function buildTerms(entries: KnownEntry[], aliases: Record<string, string> = {}): Term[] {
  const byText = new Map<string, Set<string>>();
  const put = (text: string, id: string) => {
    const key = text.trim();
    if (key.length < 3) return;
    if (!byText.has(key)) byText.set(key, new Set());
    byText.get(key)!.add(id);
  };
  for (const entry of entries) {
    put(entry.id, entry.id);
    for (const name of entry.names) {
      put(name, entry.id);
      const words = name.trim().split(/\s+/);
      if ((entry.type === 'pc' || entry.type === 'npc') && words.length >= 2 && /^\p{Lu}/u.test(words[0])) put(words[0], entry.id);
    }
  }
  for (const [word, id] of Object.entries(aliases)) put(word, id);
  return [...byText].map(([text, ids]) => ({ text, ids, regex: new RegExp(termPattern(text), 'gu') }));
}

/** The matches of the names in one piece of text, the longest first where they overlap. */
export function matchNames(text: string, terms: Term[], skipId?: string): TextMatch[] {
  const found: TextMatch[] = [];
  for (const term of terms) {
    const ids = [...term.ids].filter((id) => id !== skipId);
    if (ids.length === 0) continue;
    for (const match of text.matchAll(term.regex)) {
      found.push({ start: match.index!, end: match.index! + match[0].length, word: match[0], ids });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const chosen: TextMatch[] = [];
  for (const match of found) {
    const last = chosen.at(-1);
    if (last && match.start < last.end) {
      // The same words from another name (Lea and Lean for "Lean"): the word means every id it could be.
      if (match.start === last.start && match.end === last.end) {
        last.ids = [...new Set([...last.ids, ...match.ids])];
      }
      continue;
    }
    chosen.push(match);
  }
  return chosen;
}

/** The ranges of a line that are not ordinary text: links, code, Markdown links and pictures, addresses. */
function protectedRanges(line: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (const pattern of [/\[\[[^\]]*\]\]/g, /`[^`]*`/g, /!?\[[^\]]*\]\([^)]*\)/g, /https?:\/\/\S+/g]) {
    for (const match of line.matchAll(pattern)) ranges.push([match.index!, match.index! + match[0].length]);
  }
  return ranges;
}

export interface TextLine {
  /** The offset of the line's first character in the whole text. */
  offset: number;
  text: string;
  line: number;
}

/**
 * The lines of a file that hold the default language's ordinary text: not the front matter, not the sections of other
 * languages, not code blocks, headings or passage markers (`:::journal`, `:::`).
 */
export function textLines(content: string, defaultLang: string): TextLine[] {
  const lines: TextLine[] = [];
  const raw = content.split('\n');
  let offset = 0;
  let inFront = raw[0]?.replace(/\r$/, '') === '---';
  let inCode = false;
  let lang = defaultLang;
  raw.forEach((rawLine, index) => {
    const text = rawLine.replace(/\r$/, '');
    const start = offset;
    offset += rawLine.length + 1;
    if (inFront) {
      if (index > 0 && text === '---') inFront = false;
      return;
    }
    const marker = /^@([a-z]{2,3})\s*$/.exec(text);
    if (marker) {
      lang = marker[1];
      return;
    }
    if (/^\s*(```|~~~)/.test(text)) {
      inCode = !inCode;
      return;
    }
    if (inCode || lang !== defaultLang || /^\s*#{1,6}\s/.test(text) || /^\s*:::/.test(text)) return;
    lines.push({ offset: start, text, line: index + 1 });
  });
  return lines;
}

/** The matches in the text of a file, with the position of each. */
export function scanFile(content: string, terms: Term[], defaultLang: string, skipId?: string): (TextMatch & { line: number; context: string })[] {
  const result: (TextMatch & { line: number; context: string })[] = [];
  for (const line of textLines(content, defaultLang)) {
    const skip = protectedRanges(line.text);
    for (const match of matchNames(line.text, terms, skipId)) {
      if (skip.some(([from, to]) => match.start < to && match.end > from)) continue;
      result.push({ ...match, start: line.offset + match.start, end: line.offset + match.end, line: line.line, context: line.text.trim() });
    }
  }
  return result;
}

/** The text with the sure matches written as `[[id|word]]`, and everything else as it was. */
export function linkText(content: string, matches: Pick<TextMatch, 'start' | 'end' | 'word' | 'ids'>[]): string {
  let out = content;
  for (const match of [...matches].filter((m) => m.ids.length === 1).sort((a, b) => b.start - a.start)) {
    out = `${out.slice(0, match.start)}[[${match.ids[0]}|${match.word}]]${out.slice(match.end)}`;
  }
  return out;
}

/**
 * Capitalized words that come back in the text, in the middle of a sentence, and that no entry has: likely names.
 * Words that are the same name in other cases (Bentara, Bentarassa) are counted together under the shortest.
 */
export function findCandidates(contents: string[], terms: Term[], defaultLang: string, minimum = 3): Candidate[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    for (const line of textLines(content, defaultLang)) {
      const skip = protectedRanges(line.text);
      const matched = matchNames(line.text, terms);
      for (const token of line.text.matchAll(/\p{Lu}[\p{L}]+(?:-\p{Lu}[\p{L}]+)*/gu)) {
        const start = token.index!;
        const end = start + token[0].length;
        if (skip.some(([from, to]) => start < to && end > from) || matched.some((m) => start < m.end && end > m.start)) continue;
        // At the start of a sentence every word is capitalized, so only a word in the middle counts.
        const before = line.text.slice(0, start).replace(/["'«»“”([*_–—-]+\s*$/u, '').trimEnd();
        if (before === '' || /[.!?:;]$/.test(before)) continue;
        counts.set(token[0], (counts.get(token[0]) ?? 0) + 1);
      }
    }
  }
  const groups: { word: string; count: number }[] = [];
  for (const [word, count] of [...counts].sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0]))) {
    const group = groups.find((g) => word.startsWith(g.word) && word.length - g.word.length <= 4);
    if (group) group.count += count;
    else groups.push({ word, count });
  }
  return groups.filter((g) => g.count >= minimum).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

const slash = (file: string) => file.split(path.sep).join('/');

function listMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
}

function readFrontMatter(text: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  try {
    const data = parseYaml(match[1]);
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Every text of a short field, in every language. */
function textsOf(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).filter((v): v is string => typeof v === 'string');
  return [];
}

function readJsonList(file: string): { id: string; name?: unknown }[] {
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** The journal entries of the real content and of the draft (the draft's win): the things a link can point to. */
export function knownEntries(realDir: string, draftDir: string): KnownEntry[] {
  const locationNames = new Map<string, string[]>();
  for (const dir of [realDir]) for (const location of readJsonList(path.join(dir, 'locations.json'))) locationNames.set(location.id, textsOf(location.name));
  for (const location of readJsonList(path.join(draftDir, 'locations.add.json'))) locationNames.set(location.id, textsOf(location.name));
  const entries = new Map<string, KnownEntry>();
  for (const dir of [realDir, draftDir]) {
    for (const name of listMarkdown(path.join(dir, 'journal'))) {
      const id = name.replace(/\.md$/, '');
      const data = readFrontMatter(fs.readFileSync(path.join(dir, 'journal', name), 'utf8'));
      const type = typeof data.type === 'string' ? data.type : '';
      entries.set(id, { id, type, names: type === 'location' ? (locationNames.get(id) ?? []) : textsOf(data.name) });
    }
  }
  return [...entries.values()];
}

/** `aliases.json` of a draft: an error when it is not `{ "word": "id" }` or names an id that has no entry. */
export function readAliases(draftDir: string, entries: KnownEntry[]): Record<string, string> {
  const file = path.join(draftDir, 'aliases.json');
  if (!fs.existsSync(file)) return {};
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${slash(path.relative(process.cwd(), file))}: invalid JSON (${(e as Error).message})`, { cause: e });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${slash(path.relative(process.cwd(), file))}: it must be an object of the form { "word": "id" }`);
  }
  const ids = new Set(entries.map((entry) => entry.id));
  const problems = Object.entries(data).filter(([, id]) => typeof id !== 'string' || !ids.has(id));
  if (problems.length > 0) {
    throw new Error(
      `${slash(path.relative(process.cwd(), file))}: ${problems.map(([word, id]) => `the alias "${word}" names "${String(id)}", which is not a journal entry`).join('; ')}`,
    );
  }
  return data as Record<string, string>;
}

export interface LinksReport {
  suggestions: Suggestion[];
  candidates: Candidate[];
  /** The draft files that were changed, when applying. */
  changed: string[];
}

function defaultLanguage(realDir: string): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(realDir, 'campaign.json'), 'utf8')).defaultLanguage ?? 'fi';
  } catch {
    return 'fi';
  }
}

/** Looks through the draft's events and entries, and with `apply` writes the sure links into them. */
export function draftLinks(root: string, item: string, options: { apply?: boolean; realName?: string } = {}): LinksReport {
  const realDir = path.join(root, options.realName ?? REAL_CONTENT_DIR);
  const draftDir = path.join(root, 'drafts', item);
  if (!fs.existsSync(draftDir)) throw new Error(`The draft folder drafts/${item}/ was not found.`);
  const entries = knownEntries(realDir, draftDir);
  const terms = buildTerms(entries, readAliases(draftDir, entries));
  const lang = defaultLanguage(realDir);

  const suggestions: Suggestion[] = [];
  const texts: string[] = [];
  const changed: string[] = [];
  for (const folder of ['events', 'journal']) {
    for (const name of listMarkdown(path.join(draftDir, folder))) {
      const file = `${folder}/${name}`;
      const full = path.join(draftDir, file);
      const content = fs.readFileSync(full, 'utf8');
      texts.push(content);
      // An entry does not link to itself.
      const matches = scanFile(content, terms, lang, folder === 'journal' ? name.replace(/\.md$/, '') : undefined);
      for (const match of matches) suggestions.push({ ...match, file: `drafts/${item}/${file}`, sure: match.ids.length === 1 });
      if (options.apply && matches.some((match) => match.ids.length === 1)) {
        fs.writeFileSync(full, linkText(content, matches));
        changed.push(`drafts/${item}/${file}`);
      }
    }
  }
  return { suggestions, candidates: findCandidates(texts, terms, lang), changed };
}

export function formatLinks(report: LinksReport, apply: boolean): string {
  const lines: string[] = [];
  const show = (suggestion: Suggestion) =>
    `  ${suggestion.file}:${suggestion.line}: "${suggestion.word}" -> ${suggestion.ids.join(' or ')}\n    ${suggestion.context}`;
  const sure = report.suggestions.filter((s) => s.sure);
  const unsure = report.suggestions.filter((s) => !s.sure);
  if (apply) {
    lines.push(`Linked ${sure.length} word(s) in ${report.changed.length} file(s).`);
    for (const file of report.changed) lines.push(`  ${file}`);
  } else if (sure.length > 0) {
    lines.push(`Suggested links (${sure.length}); "npm run draft:links -- <item> --apply" writes them:`, ...sure.map(show));
  }
  if (unsure.length > 0) lines.push(`Unsure (${unsure.length}): the word could be more than one entry, and is never applied:`, ...unsure.map(show));
  if (sure.length + unsure.length === 0 && !apply) lines.push('No links to suggest.');
  if (report.candidates.length > 0) {
    lines.push(
      `Capitalized words that return and have no entry (${report.candidates.length}), maybe new entries:`,
      ...report.candidates.map((c) => `  ${c.word} (${c.count} times)`),
    );
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const item = args.find((arg) => !arg.startsWith('--'));
  if (!item) {
    console.error('Usage: npm run draft:links -- <item> [--apply]');
    process.exitCode = 1;
    return;
  }
  try {
    const apply = args.includes('--apply');
    console.log(formatLinks(draftLinks(process.cwd(), item, { apply }), apply));
  } catch (e) {
    console.error(`Error: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
