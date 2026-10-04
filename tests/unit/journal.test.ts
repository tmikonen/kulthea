import { describe, expect, it } from 'vitest';
import type { JournalEntryDef } from '../../src/content/types';
import { groupEntries, journalView } from '../../src/journal/journal';

const entry = (id: string, type: JournalEntryDef['type'], name: JournalEntryDef['name']): JournalEntryDef => ({
  id, type, name, motto: null, text: { fi: '<p>x</p>' }, image: null,
});

const entries = [
  entry('note', 'note', 'Muistio'),
  entry('b-npc', 'npc', { fi: 'Östen', en: 'Osten' }),
  entry('a-npc', 'npc', { fi: 'Zorro', en: 'Aaron' }),
  entry('hero', 'pc', 'Sankari'),
  entry('c-npc', 'npc', 'Ääni'),
];

describe('journal view (B-21)', () => {
  it('FR-6 the parameter names the index, an entry, or nothing', () => {
    expect(journalView(null, entries)).toBeNull();
    expect(journalView('index', entries)).toEqual({ kind: 'index' });
    expect(journalView('hero', entries)).toEqual({ kind: 'entry', entry: entries[3] });
  });

  it('FR-6 an unknown entry is ignored', () => {
    expect(journalView('nowhere', entries)).toBeNull();
    expect(journalView('', entries)).toBeNull();
  });

  it('FR-6 the index groups by type in the order of the types, leaving empty types out', () => {
    expect(groupEntries(entries, 'fi', 'fi').map((g) => g.type)).toEqual(['pc', 'npc', 'note']);
  });

  it('FR-6 names are sorted in the chosen language, with the fallback for a name with no text in it', () => {
    const names = (lang: string) => groupEntries(entries, lang, 'fi')[1].entries.map((e) => e.id);
    // Finnish puts Å, Ä and Ö after Z, with Ä before Ö: Zorro, Ääni, Östen.
    expect(names('fi')).toEqual(['a-npc', 'c-npc', 'b-npc']);
    // English: Aaron, Osten, and Ääni (the Finnish fallback, which sorts as A).
    expect(names('en')).toEqual(['c-npc', 'a-npc', 'b-npc']);
  });

  it('FR-6 grouping does not change the order of the list it is given', () => {
    const before = entries.map((e) => e.id);
    groupEntries(entries, 'fi', 'fi');
    expect(entries.map((e) => e.id)).toEqual(before);
  });
});
