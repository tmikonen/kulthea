import { describe, expect, it } from 'vitest';
import { activeLanguage } from '../../src/content/language';
import { resolveText, uiText } from '../../src/content/text';

describe('the lang URL parameter (B-6)', () => {
  const languages = ['fi', 'en'];

  it('FR-9 a configured language is selected', () => {
    expect(activeLanguage(languages, 'fi', 'en')).toBe('en');
  });

  it('FR-9 a missing or unknown value means the default language', () => {
    expect(activeLanguage(languages, 'fi', null)).toBe('fi');
    expect(activeLanguage(languages, 'fi', 'xx')).toBe('fi');
    expect(activeLanguage(languages, 'fi', '')).toBe('fi');
  });
});

describe('text resolver (B-6)', () => {
  it('FR-9 a plain value is the default language only, in every language', () => {
    expect(resolveText('Haestra', 'fi', 'fi')).toBe('Haestra');
    expect(resolveText('Haestra', 'en', 'fi')).toBe('Haestra');
  });

  it('FR-9 a language map gives the chosen language', () => {
    expect(resolveText({ fi: 'Suonperä', en: 'Bog End' }, 'en', 'fi')).toBe('Bog End');
    expect(resolveText({ fi: 'Suonperä', en: 'Bog End' }, 'fi', 'fi')).toBe('Suonperä');
  });

  it('FR-9 falls back to the default language when the chosen one is missing', () => {
    expect(resolveText({ fi: 'Suonperä' }, 'en', 'fi')).toBe('Suonperä');
  });

  it('FR-9 returns an empty string when nothing is available', () => {
    expect(resolveText({ sv: 'Träsk' }, 'en', 'fi')).toBe('');
  });
});

describe('interface texts (B-6)', () => {
  const ui = { next: { fi: 'Seuraava', en: 'Next' }, previous: { fi: 'Edellinen' } };

  it('FR-9 gives the text in the chosen language', () => {
    expect(uiText(ui, 'next', 'en', 'fi')).toBe('Next');
  });

  it('FR-9 falls back to the default language without an error', () => {
    expect(uiText(ui, 'previous', 'en', 'fi')).toBe('Edellinen');
  });

  it('FR-9 shows the key for an unknown text, so the gap is visible', () => {
    expect(uiText(ui, 'journal', 'en', 'fi')).toBe('journal');
  });
});
