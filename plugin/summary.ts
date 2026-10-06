import fs from 'node:fs';
import path from 'node:path';
import type { LoadedContent } from '../src/content/types.ts';

/** What the texts and entries of a content folder refer to, collected while they are read. */
export interface Usage {
  /** The images (paths from the content folder) that a text or an entry's lead image uses. */
  images: Set<string>;
  /** The ids of the entries that an event or an entry text links to (an entry's own links to itself left out). */
  links: Set<string>;
}

const IMAGE_FILE = /\.(jpe?g|png|webp|gif|svg|avif)$/i;

/** The image files in a folder and its subfolders, as paths from `root` with forward slashes. */
function imageFiles(folder: string, root: string): string[] {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return imageFiles(full, root);
    return IMAGE_FILE.test(entry.name) ? [path.relative(root, full).split(path.sep).join('/')] : [];
  });
}

/** Warnings for the images, locations and entries that nothing refers to. */
export function findUnused(
  bundle: LoadedContent,
  dir: string,
  rel: (file: string) => string,
  usage: Usage,
): string[] {
  const warnings: string[] = [];

  const mapImages = new Set(bundle.maps.map((map) => path.posix.normalize(map.image)));
  for (const image of imageFiles(path.join(dir, 'images'), dir)) {
    if (!usage.images.has(image) && !mapImages.has(image)) {
      warnings.push(`${rel(path.join(dir, image))}: the image is not used by any text or entry`);
    }
  }

  const used = new Set<string>();
  for (const event of bundle.events) {
    if (event.location) used.add(event.location);
    if (event.showOn?.location) used.add(event.showOn.location);
  }
  const entryIds = new Set(bundle.journal.map((entry) => entry.id));
  for (const location of bundle.locations) {
    if (!used.has(location.id) && !entryIds.has(location.id)) {
      warnings.push(`${rel(path.join(dir, 'locations.json'))}: location "${location.id}" is not used by any event or location entry`);
    }
  }

  for (const entry of bundle.journal) {
    const named = usage.links.has(entry.id) || Object.values(entry.events).some((events) => events.length > 0);
    if (named) continue;
    const reason = entry.type === 'location'
      ? 'no text links to it and no event is held at it'
      : 'no text links to it and no passage is for it';
    warnings.push(`${rel(path.join(dir, 'journal', `${entry.id}.md`))}: the entry is not used, ${reason}`);
  }
  return warnings;
}

/** "events 8 of 14 without text, 8 without title": only what is missing, with the total after the first count. Nothing when nothing is missing. */
function missing(what: string, total: number, counts: [number, string][]): string[] {
  const found = counts.filter(([count]) => count > 0);
  if (found.length === 0) return [];
  return [`${what} ${found.map(([count, label], i) => `${count}${i === 0 ? ` of ${total}` : ''} ${label}`).join(', ')}`];
}

function hasValue(value: unknown, lang: string): boolean {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)[lang] === 'string'
    && (value as Record<string, string>)[lang].trim() !== '';
}

/**
 * One line for each language other than the default, listing what has no text in it, so the author sees
 * how far a translation is. A thing counts as missing exactly when the app shows the default language in its place.
 */
export function summarizeTranslations(bundle: LoadedContent): string[] {
  const { campaign, events, journal, locations, maps, ui } = bundle;
  const names = new Intl.DisplayNames(['en'], { type: 'language' });
  return campaign.languages.filter((lang) => lang !== campaign.defaultLanguage).map((lang) => {
    const parts: string[] = [];

    const noText = events.filter((event) => !event.text[lang]).length;
    const noTitle = events.filter((event) => !hasValue(event.title, lang)).length;
    parts.push(...missing('events', events.length, [[noText, 'without text'], [noTitle, 'without title']]));

    const entryNoText = journal.filter((entry) => !entry.text[lang]).length;
    const entryNoName = journal.filter((entry) => entry.type !== 'location' && !hasValue(entry.name, lang)).length;
    parts.push(...missing('entries', journal.length, [[entryNoText, 'without text'], [entryNoName, 'without name']]));

    const noLocationName = locations.filter((location) => !hasValue(location.name, lang)).length;
    if (noLocationName > 0) parts.push(`locations ${noLocationName} of ${locations.length} without name`);
    const noMapName = maps.filter((map) => !hasValue(map.name, lang)).length;
    if (noMapName > 0) parts.push(`maps ${noMapName} of ${maps.length} without name`);

    const keys = Object.keys(ui);
    const noUi = keys.filter((key) => !hasValue(ui[key], lang)).length;
    if (parts.length === 0 && noUi === 0) return `${names.of(lang) ?? lang}: complete`;
    parts.push(noUi > 0 ? `interface texts ${noUi} of ${keys.length} missing` : 'interface texts complete');
    return `${names.of(lang) ?? lang}: ${parts.join('; ')}`;
  });
}
