export interface Sections {
  /** The text of each language that has one, by language code. */
  sections: Record<string, string>;
  errors: string[];
}

/** A line that holds only a language code, such as `@fi` or `@en`. */
const MARKER = /^@([a-z]{2,3})\s*$/;

/**
 * Splits the body of an event or journal entry into language sections. Everything up to the next
 * marker line belongs to the language of the marker before it, and text before the first marker
 * is in the default language. A section with no text is left out.
 */
export function splitSections(body: string, languages: string[], defaultLang: string): Sections {
  const errors: string[] = [];
  const unmarked: string[] = [];
  const marked = new Map<string, string[]>();
  let current: string[] = unmarked;
  const unknown = new Set<string>();

  for (const line of body.split(/\r?\n/)) {
    const marker = MARKER.exec(line);
    if (!marker) {
      current.push(line);
      continue;
    }
    const lang = marker[1];
    if (!languages.includes(lang)) {
      if (!unknown.has(lang)) {
        unknown.add(lang);
        errors.push(`the text uses the language "${lang}", which is not configured (${languages.join(', ')})`);
      }
      current = [];
    } else if (marked.has(lang)) {
      errors.push(`the text has more than one "@${lang}" section`);
      current = [];
    } else {
      current = [];
      marked.set(lang, current);
    }
  }

  const sections: Record<string, string> = {};
  for (const [lang, lines] of marked) {
    const text = lines.join('\n').trim();
    if (text !== '') sections[lang] = text;
  }

  const unmarkedText = unmarked.join('\n').trim();
  if (unmarkedText !== '') {
    if (marked.has(defaultLang)) {
      errors.push(`the text has unmarked text together with an explicit "@${defaultLang}" section`);
    } else {
      sections[defaultLang] = unmarkedText;
    }
  }

  if (!sections[defaultLang] && !errors.some((e) => e.includes('unmarked text'))) {
    errors.push(`the text has no text in the default language "${defaultLang}"`);
  }
  return { sections, errors };
}
