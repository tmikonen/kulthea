import { resolveText } from '../content/text';
import { JOURNAL_TYPES, type JournalEntryDef, type JournalType } from '../content/types';

/** What the `journal` address parameter asks for: the index, or one entry. */
export type JournalView = { kind: 'index' } | { kind: 'entry'; entry: JournalEntryDef };

/** The reserved value of the `journal` parameter that opens the index. */
export const INDEX_PARAM = 'index';

/** The view named by the parameter, or null for no parameter or an entry that does not exist (it is ignored). */
export function journalView(param: string | null, entries: JournalEntryDef[]): JournalView | null {
  if (param === null) return null;
  if (param === INDEX_PARAM) return { kind: 'index' };
  const entry = entries.find((candidate) => candidate.id === param);
  return entry ? { kind: 'entry', entry } : null;
}

/** The entry's name in the chosen language, falling back to the default language. */
export function entryName(entry: JournalEntryDef, lang: string, defaultLang: string): string {
  return resolveText(entry.name, lang, defaultLang);
}

export interface JournalGroup {
  type: JournalType;
  entries: JournalEntryDef[];
}

/** The entries grouped by type, in the order of the types and by name within a type. Empty types are left out. */
export function groupEntries(entries: JournalEntryDef[], lang: string, defaultLang: string): JournalGroup[] {
  const collator = new Intl.Collator(lang);
  return JOURNAL_TYPES.map((type) => ({
    type,
    entries: entries
      .filter((entry) => entry.type === type)
      .sort((a, b) => collator.compare(entryName(a, lang, defaultLang), entryName(b, lang, defaultLang))),
  })).filter((group) => group.entries.length > 0);
}

/** The entry's text in the chosen language, or in the default language when it has none (`fallback`). */
export function entryText(entry: JournalEntryDef, lang: string, defaultLang: string): { html: string; fallback: boolean } {
  const own = entry.text[lang];
  return own === undefined
    ? { html: entry.text[defaultLang] ?? '', fallback: lang !== defaultLang }
    : { html: own, fallback: false };
}
