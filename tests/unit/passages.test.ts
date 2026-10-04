import { describe, expect, it } from 'vitest';
import { extractPassages } from '../../plugin/passages';

const types: Record<string, string> = { aldric: 'pc', mira: 'npc', ring: 'item', lore: 'note', place: 'location' };
const typeOf = (id: string) => types[id];
const run = (markdown: string) => extractPassages(markdown, typeOf);

describe('journal-only passages (B-26)', () => {
  it('FR-6 a passage is taken out of the text and kept with its ids, in document order with the text around it', () => {
    const { segments, text, errors } = run('Before.\n\n:::journal{for="aldric"}\nSecret.\n:::\n\nAfter.');
    expect(errors).toEqual([]);
    expect(segments).toEqual([
      { kind: 'text', markdown: 'Before.\n' },
      { kind: 'passage', ids: ['aldric'], markdown: 'Secret.' },
      { kind: 'text', markdown: '\nAfter.' },
    ]);
    expect(text).toBe('Before.\n\n\n\n\nAfter.');
    expect(text).not.toContain('Secret');
  });

  it('FR-6 a passage for several characters names all of them, ignoring spaces', () => {
    const { segments, errors } = run(':::journal{for="aldric, mira"}\nBoth.\n:::');
    expect(errors).toEqual([]);
    expect(segments).toEqual([{ kind: 'passage', ids: ['aldric', 'mira'], markdown: 'Both.' }]);
  });

  it('FR-6 a passage may have several paragraphs and Markdown', () => {
    const { segments } = run(':::journal{for="aldric"}\nOne *two*.\n\nThree [[mira]].\n:::');
    expect(segments).toEqual([{ kind: 'passage', ids: ['aldric'], markdown: 'One *two*.\n\nThree [[mira]].' }]);
  });

  it('FR-6 several passages, and text with none', () => {
    const { segments } = run(':::journal{for="aldric"}\nA\n:::\nmiddle\n:::journal{for="mira"}\nB\n:::');
    expect(segments.map((s) => s.kind)).toEqual(['passage', 'text', 'passage']);
    expect(run('Just text.\n').segments).toEqual([{ kind: 'text', markdown: 'Just text.\n' }]);
    expect(run('').segments).toEqual([]);
  });

  it('FR-6 a colon in ordinary text is not a block', () => {
    const text = 'Time 10:30 and a:::b and ::: not at the start of a line';
    expect(run(text)).toEqual({ segments: [{ kind: 'text', markdown: text }], text, errors: [] });
  });

  it('FR-6 a block inside a fenced code block is left as written', () => {
    const { segments, errors } = run('Example:\n\n```\n:::journal{for="aldric"}\nx\n:::\n```\n');
    expect(errors).toEqual([]);
    expect(segments.every((s) => s.kind === 'text')).toBe(true);
  });

  describe('errors', () => {
    it('FR-6 an id that is not an entry, or not a player character or an NPC', () => {
      expect(run(':::journal{for="nobody"}\nx\n:::').errors).toEqual(['the passage is for "nobody", which is not a journal entry']);
      for (const id of ['ring', 'lore', 'place']) {
        expect(run(`:::journal{for="${id}"}\nx\n:::`).errors).toEqual([`the passage is for "${id}", which is not a player character or an NPC`]);
      }
    });

    it('FR-6 an empty for', () => {
      expect(run(':::journal{for=""}\nx\n:::').errors).toEqual([expect.stringMatching(/has an empty id in "for"/)]);
      expect(run(':::journal{for="aldric,"}\nx\n:::').errors).toEqual([expect.stringMatching(/has an empty id in "for"/)]);
    });

    it('FR-6 a passage that is not closed', () => {
      expect(run(':::journal{for="aldric"}\nx').errors).toEqual(['a journal passage is not closed with a ":::" line']);
    });

    it('FR-6 a passage inside a passage', () => {
      expect(run(':::journal{for="aldric"}\n:::journal{for="mira"}\nx\n:::').errors).toEqual([
        expect.stringMatching(/is inside a journal passage, and passages cannot be nested/),
      ]);
    });

    it('FR-6 another block name, a malformed opening, and a stray closing line', () => {
      expect(run(':::foo\nx\n:::').errors[0]).toMatch(/the block ":::foo" is not a journal passage/);
      expect(run(':::journal\nx\n:::').errors[0]).toMatch(/the block ":::journal" is not a journal passage/);
      expect(run('text\n:::\n').errors).toEqual(['a ":::" line closes no passage']);
    });

    it('FR-6 every problem is reported', () => {
      expect(run(':::journal{for="a1"}\nx\n:::\n:::journal{for="b2"}\ny\n:::').errors).toHaveLength(2);
    });
  });
});
