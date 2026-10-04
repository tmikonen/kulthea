import { describe, expect, it } from 'vitest';
import { splitSections } from '../../src/content/sections';

const split = (body: string) => splitSections(body, ['fi', 'en'], 'fi');

describe('language sections (B-10)', () => {
  it('FR-9 text with no marker is the default language', () => {
    expect(split('Pelkkää tekstiä.\n\nToinen kappale.')).toEqual({
      sections: { fi: 'Pelkkää tekstiä.\n\nToinen kappale.' },
      errors: [],
    });
  });

  it('FR-9 marker lines split the text into the languages', () => {
    expect(split('@fi\nSuomeksi.\n\n@en\nIn English.\n')).toEqual({
      sections: { fi: 'Suomeksi.', en: 'In English.' },
      errors: [],
    });
  });

  it('FR-9 the order of the sections does not matter', () => {
    expect(split('@en\nIn English.\n\n@fi\nSuomeksi.').sections).toEqual({ en: 'In English.', fi: 'Suomeksi.' });
  });

  it('FR-9 unmarked text is the default language, and a section for another language may follow it', () => {
    expect(split('Suomeksi.\n\n@en\nIn English.')).toEqual({
      sections: { fi: 'Suomeksi.', en: 'In English.' },
      errors: [],
    });
  });

  it('FR-9 a section keeps its paragraphs and its own lines, and not the marker lines', () => {
    const { sections } = split('@fi\nEnsimmäinen.\n\nToinen.\n@en\nFirst.');
    expect(sections.fi).toBe('Ensimmäinen.\n\nToinen.');
    expect(sections.en).toBe('First.');
  });

  it('FR-9 reads Windows line endings and spaces after a marker', () => {
    expect(split('@fi  \r\nSuomeksi.\r\n\r\n@en\r\nIn English.\r\n').sections).toEqual({
      fi: 'Suomeksi.', en: 'In English.',
    });
  });

  it('FR-9 a section with no text is left out, without an error', () => {
    expect(split('@fi\nSuomeksi.\n\n@en\n\n')).toEqual({ sections: { fi: 'Suomeksi.' }, errors: [] });
  });

  it('FR-9 a line that is not only a language code is text, not a marker', () => {
    const { sections, errors } = split('Kirjoita osoitteeseen @fi tai\n@mira\n  @en\n@en jotain');
    expect(errors).toEqual([]);
    expect(sections.fi).toBe('Kirjoita osoitteeseen @fi tai\n@mira\n  @en\n@en jotain');
  });

  describe('errors', () => {
    it('FR-9 rejects a language that is not configured, once however many times it is used', () => {
      const { errors } = split('Suomeksi.\n\n@de\nAuf Deutsch.\n\n@de\nNoch mal.');
      expect(errors).toEqual(['the text uses the language "de", which is not configured (fi, en)']);
    });

    it('FR-9 rejects a language section that is repeated', () => {
      const { errors } = split('@fi\nYksi.\n\n@en\nOne.\n\n@en\nTwo.');
      expect(errors).toEqual(['the text has more than one "@en" section']);
    });

    it('FR-9 rejects a text with no default-language text', () => {
      expect(split('@en\nOnly English.').errors).toEqual(['the text has no text in the default language "fi"']);
    });

    it('FR-9 rejects an empty text, and a text of blank lines', () => {
      expect(split('').errors).toEqual(['the text has no text in the default language "fi"']);
      expect(split('\n  \n\n').errors).toEqual(['the text has no text in the default language "fi"']);
    });

    it('FR-9 rejects a blank default-language section', () => {
      expect(split('@fi\n\n@en\nOne.').errors).toEqual(['the text has no text in the default language "fi"']);
    });

    it('FR-9 rejects unmarked text together with an explicit default-language section', () => {
      const { errors } = split('Ensin tekstiä.\n\n@fi\nJa sitten merkitty.');
      expect(errors).toEqual(['the text has unmarked text together with an explicit "@fi" section']);
    });

    it('FR-9 reports each problem', () => {
      const { errors } = split('@en\nOne.\n\n@en\nTwo.\n\n@de\nZwei.');
      expect(errors).toHaveLength(3);
    });
  });
});
