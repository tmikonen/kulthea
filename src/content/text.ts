import type { LocalizedText } from './types';

/** The text in the given language, falling back to the default language. */
export function resolveText(
  text: LocalizedText,
  lang: string,
  defaultLang: string,
): string {
  if (typeof text === 'string') return text;
  return text[lang] ?? text[defaultLang] ?? '';
}
