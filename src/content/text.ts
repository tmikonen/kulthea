import type { LocalizedText, UiTexts } from './types';

/** The text in the given language, falling back to the default language. */
export function resolveText(
  text: LocalizedText,
  lang: string,
  defaultLang: string,
): string {
  if (typeof text === 'string') return text;
  return text[lang] ?? text[defaultLang] ?? '';
}

/** An interface text by key; an unknown key shows the key itself, so the gap is visible. */
export function uiText(ui: UiTexts, key: string, lang: string, defaultLang: string): string {
  const text = ui[key];
  return text === undefined ? key : resolveText(text, lang, defaultLang);
}
