import fs from 'node:fs';
import path from 'node:path';
import { imageSize } from 'image-size';
import { parse as parseYaml } from 'yaml';
import { compareEvents, parseEventFileName } from '../src/content/eventName.ts';
import type { Campaign, EventDef, EventShowOn, LoadedContent, LocationDef, MapDef, Month, UiTexts } from '../src/content/types.ts';

export interface LoadResult {
  bundle: LoadedContent | null;
  errors: string[];
  warnings: string[];
}

const MAP_MAX_BYTES = 10 * 1024 * 1024;
const MAP_MAX_WIDTH = 5000;
const IMAGE_TYPES = ['jpg', 'png', 'webp'];
const MONTH_COUNT = 5;

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  const campaign = validateCampaign(readJson('campaign.json'), rel(path.join(dir, 'campaign.json')), errors);
  const maps = validateMaps(
    readJson('maps.json'),
    rel(path.join(dir, 'maps.json')),
    dir,
    campaign?.defaultLanguage,
    errors,
    warnings,
  );

  const locations = validateLocations(
    readJson('locations.json'),
    rel(path.join(dir, 'locations.json')),
    maps?.map((map) => map.id),
    campaign?.defaultLanguage,
    errors,
  );
  const events = campaign && maps && locations
    ? validateEvents(path.join(dir, 'events'), rel, campaign, maps, locations, errors)
    : null;
  const ui = validateUi(readJson('ui.json'), rel(path.join(dir, 'ui.json')), campaign?.defaultLanguage, errors);

  if (errors.length > 0 || !campaign || !maps || !locations || !events || !ui) return { bundle: null, errors, warnings };
  return { bundle: { campaign, maps, locations, events, ui }, errors, warnings };
}

function validateCampaign(raw: unknown, file: string, errors: string[]): Campaign | null {
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
  errors: string[],
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

function isNotApplicable(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'n/a';
}

function validateEvents(
  eventsDir: string,
  rel: (file: string) => string,
  campaign: Campaign,
  maps: MapDef[],
  locations: LocationDef[],
  errors: string[],
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

    const text = fs.readFileSync(path.join(eventsDir, fileName), 'utf8');
    const match = FRONT_MATTER.exec(text);
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

    if (errors.length === eventErrors && main) {
      events.push({
        id: fileName.replace(/\.md$/, ''),
        year: name.year,
        month: name.month,
        day: name.day,
        order: name.order,
        title: front.title as EventDef['title'],
        location: main.location,
        position: main.position,
        showOn,
        track: front.track === undefined ? null : (front.track as string),
        newSegment: front.newSegment === true,
      });
    }
  }

  if (errors.length > before) return null;
  return events.sort(compareEvents);
}

function validateUi(
  raw: unknown,
  file: string,
  defaultLanguage: string | undefined,
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

    maps.push({
      id,
      name: entry.name as MapDef['name'],
      image: entry.image,
      width: entry.width as number,
      height: entry.height as number,
      main: entry.main === true,
    });
  });

  const mainCount = raw.filter((m) => isRecord(m) && m.main === true).length;
  if (mainCount !== 1) err(`exactly one map must have "main": true, found ${mainCount}`);

  return errors.length > before ? null : maps;
}
