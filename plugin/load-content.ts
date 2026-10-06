import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';
import { parse as parseYaml } from 'yaml';
import { compareEvents, parseEventFileName } from '../src/content/eventName.ts';
import { splitSections } from '../src/content/sections.ts';
import { renderWithLinks, type ImageInfo, type ImageLookup, type RenderedText } from './links.ts';
import { extractPassages } from './passages.ts';
import { findRawHtml } from './markdown.ts';
import { checkLanguageMap, warnUnlistedFields } from './checks.ts';
import { findUnused, summarizeTranslations, type Usage } from './summary.ts';
import { JOURNAL_TYPES } from '../src/content/types.ts';
import type { Campaign, EventDef, Excerpt, EventShowOn, ImageRef, JournalEntryDef, JournalType, LoadedContent, LocationDef, MapDef, Month, UiTexts } from '../src/content/types.ts';

export interface LoadResult {
  bundle: LoadedContent | null;
  errors: string[];
  warnings: string[];
  /** One line for each language other than the default, about what has no text in it. Not a warning. */
  summary: string[];
}

const MAP_MAX_BYTES = 10 * 1024 * 1024;
const MAP_MAX_WIDTH = 5000;
const IMAGE_TYPES = ['jpg', 'png', 'webp'];
const MONTH_COUNT = 5;
const IMAGE_MAX_BYTES = 1024 * 1024;
const IMAGE_MAX_WIDTH = 1600;
const JOURNAL_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A short text in the chosen language, falling back to the default language. */
function resolveText(text: string | Record<string, string>, lang: string, defaultLang: string): string {
  if (typeof text === 'string') return text;
  return text[lang] ?? text[defaultLang] ?? '';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** The text of a short field in one language; a plain value is the default language only. */
function textIn(value: unknown, lang: string, defaultLang: string): string | undefined {
  if (typeof value === 'string') return lang === defaultLang ? value : undefined;
  if (isRecord(value) && typeof value[lang] === 'string') return value[lang] as string;
  return undefined;
}

function hasText(value: unknown, lang: string, defaultLang: string): boolean {
  return isNonEmptyString(textIn(value, lang, defaultLang));
}

export function loadContent(dir: string): LoadResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const usage: Usage = { images: new Set(), links: new Set() };
  const rel = (file: string) => path.relative(process.cwd(), file).split(path.sep).join('/');

  function readJson(name: string): unknown {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      errors.push(`${rel(file)}: file not found`);
      return undefined;
    }
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`${rel(file)}: invalid JSON (${(e as Error).message})`);
      return undefined;
    }
  }

  const campaign = validateCampaign(readJson('campaign.json'), rel(path.join(dir, 'campaign.json')), errors, warnings);
  const maps = validateMaps(
    readJson('maps.json'),
    rel(path.join(dir, 'maps.json')),
    dir,
    campaign?.defaultLanguage,
    campaign?.languages,
    errors,
    warnings,
  );

  const locations = validateLocations(
    readJson('locations.json'),
    rel(path.join(dir, 'locations.json')),
    maps?.map((map) => map.id),
    campaign?.defaultLanguage,
    campaign?.languages,
    errors,
    warnings,
  );
  // The journal is read first, because the links in the text of events and entries need the names of the entries.
  const drafts = campaign && locations
    ? readJournal(path.join(dir, 'journal'), dir, rel, campaign, locations, usage, errors, warnings)
    : null;
  /** The type of an entry. When an entry has an error, its own error is enough, so any id is taken as a character then. */
  const entryType = (id: string) => (drafts === null ? 'pc' : drafts.find((d) => d.id === id)?.type);
  const linkName: LinkName = (id, lang) => {
    // When an entry has an error, its own error is enough: do not report every link to the entries as broken too.
    if (drafts === null) return id;
    const draft = drafts?.find((d) => d.id === id);
    return draft && campaign ? resolveText(draft.name, lang, campaign.defaultLanguage) : undefined;
  };
  const linkLog: LinkLog = new Map();
  const events = campaign && maps && locations
    ? validateEvents(path.join(dir, 'events'), rel, campaign, maps, locations, linkName, entryType, linkLog, usage, errors, warnings)
    : null;
  const journal = drafts && campaign ? renderJournal(drafts, campaign, events ?? [], linkLog, linkName, dir, usage, errors, warnings) : null;
  const ui = validateUi(readJson('ui.json'), rel(path.join(dir, 'ui.json')), campaign?.defaultLanguage, campaign?.languages, errors);

  if (errors.length > 0 || !campaign || !maps || !locations || !events || !journal || !ui) {
    return { bundle: null, errors, warnings, summary: [] };
  }
  const bundle = { campaign, maps, locations, events, journal, ui };
  warnings.push(...findUnused(bundle, dir, rel, usage));
  return { bundle, errors, warnings, summary: summarizeTranslations(bundle) };
}

function validateCampaign(raw: unknown, file: string, errors: string[], warnings: string[]): Campaign | null {
  if (raw === undefined) return null;
  const err = (problem: string) => errors.push(`${file}: ${problem}`);
  if (!isRecord(raw)) {
    err('must be a JSON object');
    return null;
  }
  const before = errors.length;

  const languages = Array.isArray(raw.languages) && raw.languages.every(isNonEmptyString)
    ? (raw.languages as string[])
    : [];
  if (languages.length === 0) err('"languages" must be a non-empty list of language codes');

  const defaultLanguage = raw.defaultLanguage;
  if (!isNonEmptyString(defaultLanguage) || !languages.includes(defaultLanguage)) {
    err(`"defaultLanguage" must be one of the configured languages (${languages.join(', ')})`);
  }
  const def = typeof defaultLanguage === 'string' ? defaultLanguage : '';

  if (!hasText(raw.title, def, def)) err(`"title" has no text in the default language "${def}"`);

  const era = isRecord(raw.era) ? raw.era : {};
  const dateFormat = isRecord(raw.dateFormat) ? raw.dateFormat : {};
  const months = Array.isArray(raw.months) ? raw.months : [];
  if (months.length !== MONTH_COUNT) {
    err(`"months" must have exactly ${MONTH_COUNT} entries, found ${months.length}`);
  }
  if (!isPositiveInt(raw.daysPerMonth)) err('"daysPerMonth" must be a positive whole number');

  for (const lang of languages) {
    if (!hasText(era.name, lang, def)) err(`language "${lang}" has no era name ("era.name")`);
    if (!hasText(era.abbreviation, lang, def)) {
      err(`language "${lang}" has no era abbreviation ("era.abbreviation")`);
    }
    if (!isNonEmptyString(dateFormat[lang])) err(`language "${lang}" has no date format ("dateFormat")`);
    months.forEach((month, i) => {
      const m = isRecord(month) ? month : {};
      if (!hasText(m.name, lang, def)) err(`language "${lang}" has no name for month ${i + 1}`);
      if (!hasText(m.inDate, lang, def)) err(`language "${lang}" has no in-date form for month ${i + 1}`);
    });
  }

  const warn = (problem: string) => warnings.push(`${file}: ${problem}`);
  warnUnlistedFields(raw, ['title', 'languages', 'defaultLanguage', 'era', 'months', 'daysPerMonth', 'dateFormat'], '', warn);
  warnUnlistedFields(era, ['name', 'abbreviation'], '"era": ', warn);
  months.forEach((month, i) => {
    if (isRecord(month)) warnUnlistedFields(month, ['name', 'inDate'], `month ${i + 1}: `, warn);
  });
  checkLanguageMap(raw.title, languages, '"title"', err);
  checkLanguageMap(era.name, languages, '"era.name"', err);
  checkLanguageMap(era.abbreviation, languages, '"era.abbreviation"', err);
  checkLanguageMap(dateFormat, languages, '"dateFormat"', err);
  months.forEach((month, i) => {
    if (!isRecord(month)) return;
    checkLanguageMap(month.name, languages, `month ${i + 1} "name"`, err);
    checkLanguageMap(month.inDate, languages, `month ${i + 1} "inDate"`, err);
  });

  if (errors.length > before) return null;
  return {
    title: raw.title as Campaign['title'],
    languages,
    defaultLanguage: def,
    era: era as unknown as Campaign['era'],
    months: months as Month[],
    daysPerMonth: raw.daysPerMonth as number,
    dateFormat: dateFormat as Record<string, string>,
  };
}

function isPercentPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2
    && value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100);
}

function validateLocations(
  raw: unknown,
  file: string,
  mapIds: string[] | undefined,
  defaultLanguage: string | undefined,
  languages: string[] | undefined,
  errors: string[],
  warnings: string[],
): LocationDef[] | null {
  if (raw === undefined) return null;
  const err = (problem: string) => errors.push(`${file}: ${problem}`);
  if (!Array.isArray(raw)) {
    err('must be a list of locations');
    return null;
  }
  const before = errors.length;
  const locations: LocationDef[] = [];
  const ids = new Set<string>();

  raw.forEach((entry, i) => {
    if (!isRecord(entry)) {
      err(`entry ${i + 1} must be an object`);
      return;
    }
    const id = isNonEmptyString(entry.id) ? entry.id : undefined;
    if (!id) {
      err(`entry ${i + 1} has no "id"`);
      return;
    }
    const where = `location "${id}"`;
    if (ids.has(id)) err(`${where}: duplicate id`);
    ids.add(id);

    warnUnlistedFields(entry, ['id', 'name', 'positions'], `${where}: `, (problem) => warnings.push(`${file}: ${problem}`));
    if (languages) checkLanguageMap(entry.name, languages, `${where}: "name"`, err);
    if (defaultLanguage !== undefined && !hasText(entry.name, defaultLanguage, defaultLanguage)) {
      err(`${where}: "name" has no text in the default language "${defaultLanguage}"`);
    }
    if (!isRecord(entry.positions)) {
      err(`${where}: "positions" must be an object with a position for each map`);
      return;
    }
    for (const [mapId, position] of Object.entries(entry.positions)) {
      if (mapIds !== undefined && !mapIds.includes(mapId)) {
        err(`${where}: position on unknown map "${mapId}"`);
      } else if (!isPercentPosition(position)) {
        err(`${where}: position on map "${mapId}" must be [x, y] with both values from 0 to 100`);
      }
    }
    locations.push({
      id,
      name: entry.name as LocationDef['name'],
      positions: entry.positions as LocationDef['positions'],
    });
  });

  return errors.length > before ? null : locations;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** The part of an event file after the front matter. */
function eventBody(fileText: string, frontMatterLength: number): string {
  return fileText.slice(frontMatterLength);
}

function isNotApplicable(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'n/a';
}

/** The text of a journal link with no text of its own in a language, or undefined when no entry has that id. */
type LinkName = (id: string, lang: string) => string | undefined;

/** Renders a language section to HTML, reporting the problems of its journal links. */
function renderText(
  markdown: string,
  lang: string,
  linkName: LinkName,
  err: (problem: string) => void,
  images: ImageLookup,
  warn: (problem: string) => void,
  onRendered?: (rendered: RenderedText) => void,
): string {
  const rendered = renderWithLinks(markdown, (id) => linkName(id, lang), images);
  for (const problem of rendered.errors) err(`in the "${lang}" text, ${problem}`);
  for (const problem of rendered.warnings) warn(`in the "${lang}" text, ${problem}`);
  onRendered?.(rendered);
  return rendered.html;
}

/** What an event's text in one language gives to the journal: the entries it links to, and the pieces that may be excerpts. */
interface TextLog {
  links: string[];
  /** The ids that the journal-only passages of the text are for. */
  passageIds: string[];
  /** Pieces of the text in document order. A piece is shown in the entries of the ids it names. */
  items: { html: string; ids: string[] }[];
}

/** The journal data of each event, in each language that has a text of its own. */
type LinkLog = Map<string, Record<string, TextLog>>;

function validateEvents(
  eventsDir: string,
  rel: (file: string) => string,
  campaign: Campaign,
  maps: MapDef[],
  locations: LocationDef[],
  linkName: LinkName,
  entryType: (id: string) => string | undefined,
  linkLog: LinkLog,
  usage: Usage,
  errors: string[],
  warnings: string[],
): EventDef[] | null {
  if (!fs.existsSync(eventsDir)) {
    errors.push(`${rel(eventsDir)}: folder not found`);
    return null;
  }
  const before = errors.length;
  const mainMap = maps.find((map) => map.main)!;
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const defaultLang = campaign.defaultLanguage;
  const events: EventDef[] = [];
  const dates = new Map<string, string>();

  const files = fs.readdirSync(eventsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const file = rel(path.join(eventsDir, fileName));
    const err = (problem: string) => errors.push(`${file}: ${problem}`);

    const name = parseEventFileName(fileName);
    if (!name) {
      err('the file name does not match year-month-day-order-slug.md');
      continue;
    }
    if (name.month < 1 || name.month > campaign.months.length) {
      err(`the month ${name.month} in the file name must be from 1 to ${campaign.months.length}`);
    }
    if (name.day < 1 || name.day > campaign.daysPerMonth) {
      err(`the day ${name.day} in the file name must be from 1 to ${campaign.daysPerMonth}`);
    }
    const dateKey = `${name.year}-${name.month}-${name.day}-${name.order}`;
    const sameDate = dates.get(dateKey);
    if (sameDate) err(`has the same date and order number as ${sameDate}`);
    else dates.set(dateKey, file);

    const fileText = fs.readFileSync(path.join(eventsDir, fileName), 'utf8');
    const match = FRONT_MATTER.exec(fileText);
    if (!match) {
      err('the file must start with a front matter block between two "---" lines');
      continue;
    }
    let front: unknown;
    try {
      front = parseYaml(match[1]);
    } catch (e) {
      err(`invalid front matter (${(e as Error).message.split('\n')[0]})`);
      continue;
    }
    if (!isRecord(front)) {
      err('the front matter must be a list of fields');
      continue;
    }

    const eventErrors = errors.length;
    const images = makeImageLookup(path.dirname(eventsDir), file, warnings, usage);
    const text: Record<string, string> = {};
    const { sections, errors: sectionErrors } = splitSections(
      eventBody(fileText, match[0].length), campaign.languages, defaultLang);
    for (const problem of sectionErrors) err(problem);
    for (const [lang, markdown] of Object.entries(sections)) {
      const html = findRawHtml(markdown);
      if (html.length > 0) err(`raw HTML is not allowed in the "${lang}" text (found ${html[0]})`);
      else {
        // The journal-only passages are taken out of the text that the event shows. They are kept, in the
        // order of the text, with the paragraphs, as the pieces that the characters' entries can show.
        const passages = extractPassages(markdown, entryType);
        for (const problem of passages.errors) err(`in the "${lang}" text, ${problem}`);
        const items: TextLog['items'] = [];
        const passageIds: string[] = [];
        for (const segment of passages.segments) {
          const rendered = renderWithLinks(segment.markdown, (id) => linkName(id, lang), images);
          if (segment.kind === 'text') {
            items.push(...rendered.paragraphs.map((paragraph) => ({ html: paragraph.html, ids: paragraph.links })));
          } else {
            for (const problem of rendered.errors) err(`in a journal passage in the "${lang}" text, ${problem}`);
            for (const problem of rendered.warnings) warnings.push(`${file}: in a journal passage in the "${lang}" text, ${problem}`);
            items.push({ html: rendered.html, ids: segment.ids });
            passageIds.push(...segment.ids);
          }
        }
        text[lang] = renderText(passages.text, lang, linkName, err, images, (problem) => warnings.push(`${file}: ${problem}`), (rendered) => {
          const id = fileName.replace(/\.md$/, '');
          const logged = linkLog.get(id) ?? {};
          logged[lang] = { links: rendered.links, passageIds, items };
          linkLog.set(id, logged);
        });
      }
    }
    warnUnlistedFields(front, ['title', 'location', 'position', 'showOn', 'track', 'newSegment'], '', (problem) => warnings.push(`${file}: ${problem}`));
    if (isRecord(front.showOn)) {
      warnUnlistedFields(front.showOn, ['map', 'location', 'position'], '"showOn": ', (problem) => warnings.push(`${file}: ${problem}`));
    }
    checkLanguageMap(front.title, campaign.languages, '"title"', err);
    if (front.title === undefined) err('"title" is missing');
    else if (!hasText(front.title, defaultLang, defaultLang)) {
      err(`"title" has no text in the default language "${defaultLang}"`);
    }
    if (front.track !== undefined && !isNonEmptyString(front.track)) {
      err('"track" must be text: a group name, or "none" for a standalone event');
    }
    if (front.newSegment !== undefined && typeof front.newSegment !== 'boolean') {
      err('"newSegment" must be true or false');
    }

    /** Resolves `location` or `position` of `source` on a map; undefined when invalid or not applicable. */
    const place = (
      source: Json,
      field: string,
      map: MapDef,
      mapLabel: string,
      allowNone: boolean,
    ): { location: string | null; position: [number, number] | null } | undefined => {
      const { location, position } = source;
      if (location !== undefined && position !== undefined) {
        err(`${field} has both "location" and "position", but only one is allowed`);
        return undefined;
      }
      if (position !== undefined) {
        if (!isPercentPosition(position)) {
          err(`${field} "position" must be [x, y] with both values from 0 to 100`);
          return undefined;
        }
        return { location: null, position };
      }
      if (location === undefined) {
        err(`${field} needs a "location"${allowNone ? ' (a location id or n/a)' : ''} or a "position"`);
        return undefined;
      }
      if (isNotApplicable(location)) {
        if (!allowNone) err(`${field} "location" cannot be n/a`);
        return allowNone ? { location: null, position: null } : undefined;
      }
      if (!isNonEmptyString(location)) {
        err(`${field} "location" must be a location id${allowNone ? ' or n/a' : ''}`);
        return undefined;
      }
      const found = locationsById.get(location);
      if (!found) {
        err(`${field} location "${location}" does not exist in locations.json`);
        return undefined;
      }
      const at = found.positions[map.id];
      if (!at) {
        err(`${field} location "${location}" has no position on ${mapLabel} "${map.id}"`);
        return undefined;
      }
      return { location, position: at };
    };

    const main = place(front, 'the event', mainMap, 'the main map', true);

    let showOn: EventShowOn | null = null;
    if (front.showOn !== undefined) {
      const spec = front.showOn;
      if (!isRecord(spec)) {
        err('"showOn" must have a "map" and a "location" or "position"');
      } else {
        const target = maps.find((map) => map.id === spec.map);
        if (!isNonEmptyString(spec.map) || !target) {
          err(`"showOn" map "${String(spec.map)}" is not a map in maps.json`);
        } else if (target.main) {
          err('"showOn" must name a map other than the main map');
        } else {
          const there = place(spec, '"showOn"', target, 'the map', false);
          if (there) showOn = { map: target.id, location: there.location, position: there.position! };
        }
      }
    }
    if (main && main.position === null && front.showOn === undefined) {
      err('"location" is n/a on the main map, so the event needs "showOn" with a place on another map');
    }
    if (main && main.position === null && showOn?.location) {
      const mainPosition = locationsById.get(showOn.location)?.positions[mainMap.id];
      if (mainPosition) {
        warnings.push(
          `${file}: "location" is n/a on the main map, but its "showOn" location "${showOn.location}" has a position ` +
          `on the main map. If the event is inside the main map's region, give it "location: ${showOn.location}".`,
        );
      }
    }

    if (errors.length === eventErrors && main) {
      events.push({
        id: fileName.replace(/\.md$/, ''),
        year: name.year,
        month: name.month,
        day: name.day,
        order: name.order,
        title: front.title as EventDef['title'],
        text,
        location: main.location,
        position: main.position,
        showOn,
        track: front.track === undefined ? null : (front.track as string),
        newSegment: front.newSegment === true,
      });
    }
  }

  if (errors.length > before) return null;
  const sorted = events.sort(compareEvents);
  warnUnreturnedGroups(sorted, (id) => `${rel(path.join(eventsDir, id))}.md`, warnings);
  return sorted;
}

/** A named group whose last event has no later party event never returns to the party, which is probably a mistyped `track`. */
function warnUnreturnedGroups(events: EventDef[], file: (id: string) => string, warnings: string[]): void {
  const lastOfGroup = new Map<string, number>();
  let lastParty = -1;
  events.forEach((event, i) => {
    if (event.track === null) lastParty = i;
    else if (event.track.trim().toLowerCase() !== 'none') lastOfGroup.set(event.track, i);
  });
  for (const [group, index] of lastOfGroup) {
    if (index > lastParty) {
      warnings.push(`${file(events[index].id)}: the group "${group}" has no later party event, so it never returns to the party. Check the "track" name if it should.`);
    }
  }
}

/**
 * Reads an ordinary image (not a map) of the content folder: the path must be inside the folder and
 * the file must exist and be an image. An image that is large, or not JPEG, PNG or WebP, gives a warning.
 */
function readImage(
  value: unknown,
  dir: string,
  file: string,
  err: (problem: string) => void,
  warnings: string[],
): ImageRef | null {
  if (!isNonEmptyString(value)) {
    err('"image" must be a path to an image file');
    return null;
  }
  const full = path.resolve(dir, value);
  const inside = path.relative(dir, full);
  if (/^[a-z]+:/i.test(value) || inside.startsWith('..') || path.isAbsolute(inside)) {
    err(`image "${value}" is not in the content folder`);
    return null;
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
    err(`image file "${value}" not found`);
    return null;
  }
  const buffer = fs.readFileSync(full);
  let dims: { width: number; height: number; type?: string };
  try {
    dims = imageSize(buffer);
  } catch {
    err(`image file "${value}" is not a readable image`);
    return null;
  }
  if (!dims.type || !IMAGE_TYPES.includes(dims.type)) {
    warnings.push(`${file}: image "${value}" is ${dims.type ?? 'of unknown type'}, not JPEG, PNG or WebP`);
  }
  if (buffer.length > IMAGE_MAX_BYTES) {
    warnings.push(`${file}: image "${value}" is over about 1 MB (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
  }
  if (dims.width > IMAGE_MAX_WIDTH) {
    warnings.push(`${file}: image "${value}" is over ${IMAGE_MAX_WIDTH} px wide (${dims.width} px)`);
  }
  return { src: inside.split(path.sep).join('/'), width: dims.width, height: dims.height };
}

/** Looks up the images that the text of one file uses, reading each image once and giving its warnings once. */
function makeImageLookup(contentDir: string, file: string, warnings: string[], usage: Usage): ImageLookup {
  const known = new Map<string, ImageInfo>();
  return (value) => {
    usage.images.add(path.posix.normalize(value));
    const cached = known.get(value);
    if (cached) return cached;
    let info: ImageInfo;
    if (!/^[A-Za-z0-9_./-]+$/.test(value)) {
      info = { error: `image "${value}": an image path has only letters, digits, ".", "_", "-" and "/"` };
    } else {
      let problem = '';
      const image = readImage(value, contentDir, file, (text) => { problem = text; }, warnings);
      info = image ? { width: image.width, height: image.height } : { error: problem };
    }
    known.set(value, info);
    return info;
  };
}

/** An entry as read from its file: everything but the rendered text. */
interface JournalDraft extends Omit<JournalEntryDef, 'text' | 'events' | 'excerpts'> {
  file: string;
  sections: Record<string, string>;
}

function readJournal(
  journalDir: string,
  contentDir: string,
  rel: (file: string) => string,
  campaign: Campaign,
  locations: LocationDef[],
  usage: Usage,
  errors: string[],
  warnings: string[],
): JournalDraft[] | null {
  if (!fs.existsSync(journalDir)) return [];
  const before = errors.length;
  const defaultLang = campaign.defaultLanguage;
  const locationsById = new Map(locations.map((location) => [location.id, location]));
  const entries: JournalDraft[] = [];

  const files = fs.readdirSync(journalDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();

  for (const fileName of files) {
    const file = rel(path.join(journalDir, fileName));
    const err = (problem: string) => errors.push(`${file}: ${problem}`);
    const id = fileName.replace(/\.md$/, '');
    if (!fileName.endsWith('.md') || !JOURNAL_ID.test(id)) {
      err('the file name must be an id (lowercase letters, digits and hyphens) followed by .md');
      continue;
    }
    if (id === 'index') {
      err('"index" is reserved and cannot be the id of an entry');
      continue;
    }

    const fileText = fs.readFileSync(path.join(journalDir, fileName), 'utf8');
    const match = FRONT_MATTER.exec(fileText);
    if (!match) {
      err('the file must start with a front matter block between two "---" lines');
      continue;
    }
    let front: unknown;
    try {
      front = parseYaml(match[1]);
    } catch (e) {
      err(`invalid front matter (${(e as Error).message.split('\n')[0]})`);
      continue;
    }
    if (!isRecord(front)) {
      err('the front matter must be a list of fields');
      continue;
    }

    const entryErrors = errors.length;
    const type = JOURNAL_TYPES.find((t) => t === front.type);
    if (!type) err(`"type" must be one of ${JOURNAL_TYPES.join(', ')}`);

    warnUnlistedFields(front, ['type', 'name', 'image', 'motto'], '', (problem) => warnings.push(`${file}: ${problem}`));
    checkLanguageMap(front.name, campaign.languages, '"name"', err);
    checkLanguageMap(front.motto, campaign.languages, '"motto"', err);

    let name: JournalEntryDef['name'] = '';
    if (type === 'location') {
      const location = locationsById.get(id);
      if (!location) err(`a location entry must have the id of a location in locations.json, and "${id}" is not one`);
      else name = location.name;
      if (front.name !== undefined) err('a location entry has no "name": its name is the location\'s in locations.json');
    } else if (type) {
      if (front.name === undefined) err('"name" is missing');
      else if (!hasText(front.name, defaultLang, defaultLang)) err(`"name" has no text in the default language "${defaultLang}"`);
      else name = front.name as JournalEntryDef['name'];
    }

    let motto: JournalEntryDef['motto'] = null;
    if (front.motto !== undefined) {
      if (type && type !== 'pc') err('only a player character has a "motto"');
      else if (!hasText(front.motto, defaultLang, defaultLang)) err(`"motto" has no text in the default language "${defaultLang}"`);
      else motto = front.motto as JournalEntryDef['motto'];
    }

    const image = front.image === undefined ? null : readImage(front.image, contentDir, file, err, warnings);
    if (image) usage.images.add(image.src);

    const { sections, errors: sectionErrors } = splitSections(
      eventBody(fileText, match[0].length), campaign.languages, defaultLang);
    for (const problem of sectionErrors) err(problem);
    for (const [lang, markdown] of Object.entries(sections)) {
      const html = findRawHtml(markdown);
      if (html.length > 0) err(`raw HTML is not allowed in the "${lang}" text (found ${html[0]})`);
      const passages = extractPassages(markdown, () => 'pc');
      if (passages.segments.some((segment) => segment.kind === 'passage') || passages.errors.length > 0) {
        err(`a journal passage (a ":::" block) can only be in an event, not in an entry (found in the "${lang}" text)`);
      }
    }

    if (errors.length === entryErrors && type) entries.push({ id, type, name, motto, image, file, sections });
  }

  return errors.length > before ? null : entries;
}

/** Renders the texts of the entries, which needs the names of all the entries for the links. */
function renderJournal(
  drafts: JournalDraft[],
  campaign: Campaign,
  events: EventDef[],
  linkLog: LinkLog,
  linkName: LinkName,
  contentDir: string,
  usage: Usage,
  errors: string[],
  warnings: string[],
): JournalEntryDef[] | null {
  const before = errors.length;
  const entries: JournalEntryDef[] = drafts.map(({ file, sections, ...entry }) => {
    const images = makeImageLookup(contentDir, file, warnings, usage);
    const text: Record<string, string> = {};
    for (const [lang, markdown] of Object.entries(sections)) {
      text[lang] = renderText(markdown, lang, linkName, (problem) => errors.push(`${file}: ${problem}`), images, (problem) => warnings.push(`${file}: ${problem}`), (rendered) => {
        for (const id of rendered.links) if (id !== entry.id) usage.links.add(id);
      });
    }
    return { ...entry, text, events: eventLists(entry, campaign, events, linkLog), excerpts: excerptLists(entry, campaign, events, linkLog) };
  });
  if (errors.length > before) return null;
  const order = (type: JournalType) => JOURNAL_TYPES.indexOf(type);
  return entries.sort((a, b) => order(a.type) - order(b.type) || a.id.localeCompare(b.id));
}

/**
 * The events listed on an entry, for each language, in date order (`events` is in date order). A location
 * entry lists the events held at the place. Another entry lists the events whose text shown in the language
 * links to it: the event's own section, or the default language's when it has none.
 */
function eventLists(
  entry: Omit<JournalEntryDef, 'text' | 'events' | 'excerpts'>,
  campaign: Campaign,
  events: EventDef[],
  linkLog: LinkLog,
): Record<string, string[]> {
  const lists: Record<string, string[]> = {};
  for (const lang of campaign.languages) {
    lists[lang] = events
      .filter((event) => {
        if (entry.type === 'location') return event.location === entry.id || event.showOn?.location === entry.id;
        const logged = linkLog.get(event.id);
        const shown = logged?.[lang] ?? logged?.[campaign.defaultLanguage];
        return (shown?.links.includes(entry.id) || shown?.passageIds.includes(entry.id)) ?? false;
      })
      .map((event) => event.id);
  }
  return lists;
}

/**
 * The excerpts of a player character or an NPC, for each language: for each event in date order that has
 * pieces for the entry, those pieces. The text shown in the language is used, as for the lists of events.
 */
function excerptLists(
  entry: Omit<JournalEntryDef, 'text' | 'events' | 'excerpts'>,
  campaign: Campaign,
  events: EventDef[],
  linkLog: LinkLog,
): Record<string, Excerpt[]> {
  const lists: Record<string, Excerpt[]> = {};
  for (const lang of campaign.languages) {
    lists[lang] = [];
    if (entry.type !== 'pc' && entry.type !== 'npc') continue;
    for (const event of events) {
      const logged = linkLog.get(event.id);
      const html = (logged?.[lang] ?? logged?.[campaign.defaultLanguage])?.items
        .filter((item) => item.ids.includes(entry.id))
        .map((item) => item.html) ?? [];
      if (html.length > 0) lists[lang].push({ event: event.id, html });
    }
  }
  return lists;
}

function validateUi(
  raw: unknown,
  file: string,
  defaultLanguage: string | undefined,
  languages: string[] | undefined,
  errors: string[],
): UiTexts | null {
  if (raw === undefined) return null;
  if (!isRecord(raw)) {
    errors.push(`${file}: must be a JSON object of texts`);
    return null;
  }
  const before = errors.length;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== 'string' && !isRecord(value)) {
      errors.push(`${file}: text "${key}" must be a string or a language map`);
    } else if (languages && isRecord(value) && Object.keys(value).some((lang) => !languages.includes(lang))) {
      checkLanguageMap(value, languages, `text "${key}"`, (problem) => errors.push(`${file}: ${problem}`));
    } else if (defaultLanguage !== undefined && !hasText(value, defaultLanguage, defaultLanguage)) {
      errors.push(`${file}: text "${key}" has no text in the default language "${defaultLanguage}"`);
    }
  }
  return errors.length > before ? null : (raw as UiTexts);
}

function validateMaps(
  raw: unknown,
  file: string,
  dir: string,
  defaultLanguage: string | undefined,
  languages: string[] | undefined,
  errors: string[],
  warnings: string[],
): MapDef[] | null {
  if (raw === undefined) return null;
  const err = (problem: string) => errors.push(`${file}: ${problem}`);
  if (!Array.isArray(raw) || raw.length === 0) {
    err('must be a non-empty list of maps');
    return null;
  }
  const before = errors.length;
  const maps: MapDef[] = [];
  const ids = new Set<string>();

  raw.forEach((entry, i) => {
    if (!isRecord(entry)) {
      err(`entry ${i + 1} must be an object`);
      return;
    }
    const id = isNonEmptyString(entry.id) ? entry.id : undefined;
    if (!id) {
      err(`entry ${i + 1} has no "id"`);
      return;
    }
    const where = `map "${id}"`;
    if (ids.has(id)) err(`${where}: duplicate id`);
    ids.add(id);

    warnUnlistedFields(entry, ['id', 'name', 'image', 'width', 'height', 'main', 'focusZoom', 'routes'], `${where}: `,
      (problem) => warnings.push(`${file}: ${problem}`));
    if (languages) checkLanguageMap(entry.name, languages, `${where}: "name"`, err);
    if (defaultLanguage !== undefined && !hasText(entry.name, defaultLanguage, defaultLanguage)) {
      err(`${where}: "name" has no text in the default language "${defaultLanguage}"`);
    }
    if (!isPositiveInt(entry.width) || !isPositiveInt(entry.height)) {
      err(`${where}: "width" and "height" must be positive whole numbers`);
    }
    if (!isNonEmptyString(entry.image)) {
      err(`${where}: no "image"`);
      return;
    }

    const imageFile = path.join(dir, entry.image);
    if (!fs.existsSync(imageFile)) {
      err(`${where}: image file "${entry.image}" not found`);
      return;
    }
    const buffer = fs.readFileSync(imageFile);
    let dims: { width: number; height: number; type?: string };
    try {
      dims = imageSize(buffer);
    } catch {
      err(`${where}: image file "${entry.image}" is not a readable image`);
      return;
    }
    if (isPositiveInt(entry.width) && isPositiveInt(entry.height)
      && (dims.width !== entry.width || dims.height !== entry.height)) {
      err(
        `${where}: declared size ${entry.width} x ${entry.height} does not match ` +
        `the image "${entry.image}" (${dims.width} x ${dims.height})`,
      );
    }
    if (!dims.type || !IMAGE_TYPES.includes(dims.type)) {
      warnings.push(`${file}: ${where}: image "${entry.image}" is ${dims.type ?? 'of unknown type'}, not JPEG, PNG or WebP`);
    }
    if (buffer.length > MAP_MAX_BYTES) {
      warnings.push(`${file}: ${where}: image "${entry.image}" is over 10 MB (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
    }
    if (dims.width > MAP_MAX_WIDTH) {
      warnings.push(`${file}: ${where}: image "${entry.image}" is over ${MAP_MAX_WIDTH} px wide (${dims.width} px)`);
    }

    const focusZoom = entry.focusZoom === undefined ? 0 : entry.focusZoom;
    if (typeof focusZoom !== 'number' || !Number.isFinite(focusZoom) || focusZoom < 0) {
      err(`${where}: "focusZoom" must be a number of zoom steps, 0 or more`);
    }

    const routes = entry.routes === undefined ? (entry.main === true ? 'history' : 'visit') : entry.routes;
    if (routes !== 'history' && routes !== 'visit' && routes !== 'overview') {
      err(`${where}: "routes" must be "history", "visit" or "overview"`);
    }

    maps.push({
      id,
      name: entry.name as MapDef['name'],
      image: entry.image,
      width: entry.width as number,
      height: entry.height as number,
      main: entry.main === true,
      focusZoom: typeof focusZoom === 'number' ? focusZoom : 0,
      routes: routes === 'history' || routes === 'overview' ? routes : 'visit',
    });
  });

  const mainCount = raw.filter((m) => isRecord(m) && m.main === true).length;
  if (mainCount !== 1) err(`exactly one map must have "main": true, found ${mainCount}`);

  return errors.length > before ? null : maps;
}
