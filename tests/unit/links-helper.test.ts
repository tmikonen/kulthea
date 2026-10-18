import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTerms, draftLinks, findCandidates, linkText, matchNames, scanFile, type KnownEntry } from '../../scripts/drafts/links';

const entries: KnownEntry[] = [
  { id: 'marek-baalik', type: 'pc', names: ['Marek Baalik'] },
  { id: 'og-og', type: 'pc', names: ['Og-Og'] },
  { id: 'lean', type: 'location', names: ['Lean'] },
  { id: 'bentara', type: 'location', names: ['Bentara'] },
  { id: 'ring-of-stroane', type: 'item', names: ['Stroanen sormus', 'Ring of Stroane'] },
  { id: 'bain', type: 'pc', names: ['Bain Pitkävihainen'] },
];
const terms = buildTerms(entries);
const words = (text: string, from = terms) => matchNames(text, from).map((m) => [m.word, m.ids]);

describe('matching names with Finnish endings (B-42)', () => {
  it('FR-6 matches a name and its endings, vowel and consonant names alike', () => {
    expect(words('Og-Og, Og-Ogin, Og-Ogia, Og-Ogille ja Og-Ogista.').map((m) => m[0])).toEqual(['Og-Og', 'Og-Ogin', 'Og-Ogia', 'Og-Ogille', 'Og-Ogista']);
    expect(words('Bentara, Bentaran, Bentaraa, Bentarassa, Bentaraan, Bentaralle').map((m) => m[0])).toEqual(
      ['Bentara', 'Bentaran', 'Bentaraa', 'Bentarassa', 'Bentaraan', 'Bentaralle'],
    );
  });

  it('FR-6 matches "Lean", "Leanin" and "Leanista" for the place Lean, and not "Leaa" or "Leanna"', () => {
    expect(words('Lean, Leanin, Leanista.').map((m) => m[0])).toEqual(['Lean', 'Leanin', 'Leanista']);
    expect(words('Leaa ja Leanna ja Leaning.')).toEqual([]);
  });

  it('FR-6 matches only whole words', () => {
    expect(words('Pohjoislean ja Leania ja eLean')).toEqual([['Leania', ['lean']]]);
    expect(words('Marekkia Bentaraton')).toEqual([]);
  });

  it('FR-6 matches the first word of the name of a character, and its endings', () => {
    expect(words('Marek kiitti Og-Ogia, ja Marekille annettiin Marekin sormus.')).toEqual([
      ['Marek', ['marek-baalik']],
      ['Og-Ogia', ['og-og']],
      ['Marekille', ['marek-baalik']],
      ['Marekin', ['marek-baalik']],
    ]);
  });

  it('FR-6 takes the full name before its first word, and a name of two words with endings on the last', () => {
    expect(words('Marek Baalik tuli. Marek Baalikin kanssa.')).toEqual([
      ['Marek Baalik', ['marek-baalik']],
      ['Marek Baalikin', ['marek-baalik']],
    ]);
  });

  it('FR-6 does not take the first word of a place or an item', () => {
    expect(words('Stroanen tuli, Ring valui.')).toEqual([]);
  });

  it('FR-6 matches names in every language and the id', () => {
    expect(words('Ring of Stroane ja Stroanen sormus ja ring-of-stroane').map((m) => m[1])).toEqual([['ring-of-stroane'], ['ring-of-stroane'], ['ring-of-stroane']]);
  });

  it('FR-6 matches a name of the form -nen with its changed stem', () => {
    expect(words('Bain Pitkävihainen, Pitkävihaisen miekka')).toEqual([['Bain Pitkävihainen', ['bain']]]);
    const t = buildTerms([{ id: 'p', type: 'npc', names: ['Pitkävihainen'] }]);
    expect(words('Pitkävihaisen ja Pitkävihaiselle ja Pitkävihaista', t).map((m) => m[0])).toEqual(['Pitkävihaisen', 'Pitkävihaiselle', 'Pitkävihaista']);
  });

  it('FR-6 matches a lowercase name at the start of a sentence too, and an uppercase name only as written', () => {
    const items = buildTerms([{ id: 'sormus', type: 'item', names: ['sormus'] }, { id: 'lean-place', type: 'location', names: ['Lean'] }]);
    expect(words('Sormus oli kadonnut. Löytyi sormuksen... sormus.', items).map((m) => m[0])).toEqual(['Sormus', 'sormuksen', 'sormus']);
    expect(words('lean LEAN', items)).toEqual([]);
  });

  it('FR-6 says a word that could be two entries is unsure: it has both ids', () => {
    const ambiguous = buildTerms([
      { id: 'lea', type: 'npc', names: ['Lea'] },
      { id: 'lean', type: 'location', names: ['Lean'] },
    ]);
    expect(words('Lean ja Leanin', ambiguous)).toEqual([['Lean', ['lea', 'lean']], ['Leanin', ['lean']]]);
  });

  it('FR-6 takes a name from the aliases', () => {
    const withAlias = buildTerms(entries, { Baalik: 'marek-baalik', 'Peikkojen Kuningas': 'og-og' });
    expect(words('Baalikin kanssa. Peikkojen Kuninkaalle.', withAlias)).toEqual([['Baalikin', ['marek-baalik']]]);
    expect(words('Peikkojen Kuningas', withAlias)).toEqual([['Peikkojen Kuningas', ['og-og']]]);
  });

  it('FR-6 takes the longest name where two overlap', () => {
    const two = buildTerms([
      { id: 'ton', type: 'location', names: ['Ton'] },
      { id: 'ton-bor', type: 'location', names: ['Ton-Bor'] },
    ]);
    expect(words('Ton-Borin portti', two)).toEqual([['Ton-Borin', ['ton-bor']]]);
  });
});

describe('where the links are looked for (B-42)', () => {
  const lang = 'fi';
  const found = (text: string) => scanFile(text, terms, lang).map((m) => m.word);

  it('FR-6 skips the front matter, headings, code, markers and the other languages', () => {
    const text = [
      '---', 'title: Lean ja Bentara', 'location: lean', '---',
      '@fi',
      '# Lean',
      'Lean näkyi.',
      '`Bentara` ja ```Lean```',
      '```', 'Bentara', '```',
      ':::journal{for="og-og"}', 'Og-Og pohti.', ':::',
      '@en',
      'Lean was there.',
    ].join('\n');
    expect(found(text)).toEqual(['Lean', 'Og-Og']);
  });

  it('FR-6 skips text inside links, Markdown links and pictures, and addresses', () => {
    expect(found('[[lean]] ja [[og-og|Og-Ogia]] ja [Lean](https://x.fi/Lean) ja ![Lean](images/lean.png "Lean") ja https://x.fi/Bentara')).toEqual([]);
    expect(found('Lean ja [[bentara|Bentara]] ja Bentarassa')).toEqual(['Lean', 'Bentarassa']);
  });

  it('FR-6 reads an unmarked text as the default language, and a marked section only when it is the default', () => {
    expect(found('Lean.')).toEqual(['Lean']);
    expect(found('@en\nLean.\n@fi\nBentara.')).toEqual(['Bentara']);
  });

  it('FR-6 gives the line of each match', () => {
    expect(scanFile('Eka.\n\nLean.\nBentara.', terms, lang).map((m) => m.line)).toEqual([3, 4]);
  });

  it('FR-6 does not link an entry to itself', () => {
    expect(scanFile('Lean ja Bentara', terms, lang, 'lean').map((m) => m.word)).toEqual(['Bentara']);
  });
});

describe('writing the links (B-42)', () => {
  it('FR-6 writes [[id|word]] for the sure ones, keeps the words as written, and leaves the rest byte for byte', () => {
    const text = '---\ntitle: X\n---\r\nMarek kiitti Og-Ogia.\r\n\r\nLean, ä ö.\n';
    const out = linkText(text, scanFile(text, terms, 'fi'));
    expect(out).toBe('---\ntitle: X\n---\r\n[[marek-baalik|Marek]] kiitti [[og-og|Og-Ogia]].\r\n\r\n[[lean|Lean]], ä ö.\n');
  });

  it('FR-6 never writes an unsure match', () => {
    const ambiguous = buildTerms([
      { id: 'lea', type: 'npc', names: ['Lea'] },
      { id: 'lean', type: 'location', names: ['Lean'] },
    ]);
    const text = 'Lean ja Leanin.';
    expect(linkText(text, scanFile(text, ambiguous, 'fi'))).toBe('Lean ja [[lean|Leanin]].');
  });

  it('FR-6 is idempotent: after writing, nothing more is suggested', () => {
    const text = 'Marek kiitti Og-Ogia Bentarassa, ja Lean oli kaukana.';
    const once = linkText(text, scanFile(text, terms, 'fi'));
    expect(scanFile(once, terms, 'fi')).toEqual([]);
    expect(linkText(once, scanFile(once, terms, 'fi'))).toBe(once);
  });
});

describe('names that look like entries (B-42)', () => {
  const text = (body: string) => `---\ntitle: X\n---\n${body}\n`;

  it('FR-6 lists capitalized words that come back in the middle of sentences and have no entry', () => {
    const body = 'Seurue tapasi Sammalin. Sitten Sammal puhui. Sitten mentiin Sammalin kanssa. Lean oli lähellä.';
    expect(findCandidates([text(body)], terms, 'fi')).toEqual([{ word: 'Sammal', count: 3 }]);
  });

  it('FR-6 does not count words at the start of a sentence, known names, or words already linked', () => {
    const body = 'Kuka tuli. Kuka lähti. Kuka jäi. Kuka meni. Lean ja Lean ja Lean. Hän tapasi [[x|Zorg]] ja [[x|Zorg]] ja [[x|Zorg]].';
    expect(findCandidates([text(body)], terms, 'fi')).toEqual([]);
  });

  it('FR-6 counts over all the files, and a word below the minimum is not listed', () => {
    expect(findCandidates([text('Hän tapasi Zorgin.'), text('Hän näki Zorgin.')], terms, 'fi')).toEqual([]);
    expect(findCandidates([text('Hän tapasi Zorgin.'), text('Hän näki Zorgin. Se oli Zorg.')], terms, 'fi')).toEqual([{ word: 'Zorg', count: 3 }]);
  });
});

describe('the files of a draft (B-42)', () => {
  const temps: string[] = [];
  afterEach(() => {
    for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function makeRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kulthea-links-'));
    temps.push(root);
    const write = (file: string, text: string) => {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    };
    write('content/campaign.json', '{ "defaultLanguage": "fi" }');
    write('content/locations.json', JSON.stringify([{ id: 'lean', name: 'Lean', positions: {} }, { id: 'bentara', name: 'Bentara', positions: {} }]));
    write('content/journal/lean.md', '---\ntype: location\n---\nKylä.\n');
    write('content/journal/marek-baalik.md', '---\ntype: pc\nname: Marek Baalik\n---\nSankari.\n');
    write('content/journal/og-og.md', '---\ntype: pc\nname:\n  fi: Og-Og\n  en: Og-Og\n---\nSankari.\n');
    write('drafts/test/events/6052-2-021-06-testi.md', '---\ntitle: Testi\nlocation: lean\n---\nMarek kiitti Og-Ogia Leanissa.\n');
    return root;
  }
  const draftFile = (root: string, file: string) => fs.readFileSync(path.join(root, 'drafts/test', file), 'utf8');

  it('FR-6 suggests two links for "Marek kiitti Og-Ogia", with the file, the line and the words as written', () => {
    const root = makeRoot();
    const report = draftLinks(root, 'test');
    expect(report.suggestions.map((s) => [s.file, s.line, s.word, s.ids, s.sure])).toEqual([
      ['drafts/test/events/6052-2-021-06-testi.md', 5, 'Marek', ['marek-baalik'], true],
      ['drafts/test/events/6052-2-021-06-testi.md', 5, 'Og-Ogia', ['og-og'], true],
      ['drafts/test/events/6052-2-021-06-testi.md', 5, 'Leanissa', ['lean'], true],
    ]);
    expect(draftFile(root, 'events/6052-2-021-06-testi.md')).toContain('Marek kiitti Og-Ogia');
  });

  it('FR-6 writes the links with --apply only into the draft, and a second run suggests nothing', () => {
    const root = makeRoot();
    const report = draftLinks(root, 'test', { apply: true });
    expect(report.changed).toEqual(['drafts/test/events/6052-2-021-06-testi.md']);
    expect(draftFile(root, 'events/6052-2-021-06-testi.md')).toContain('[[marek-baalik|Marek]] kiitti [[og-og|Og-Ogia]] [[lean|Leanissa]].');
    expect(draftLinks(root, 'test').suggestions).toEqual([]);
    expect(draftLinks(root, 'test', { apply: true }).changed).toEqual([]);
    expect(fs.readFileSync(path.join(root, 'content/journal/og-og.md'), 'utf8')).toBe('---\ntype: pc\nname:\n  fi: Og-Og\n  en: Og-Og\n---\nSankari.\n');
  });

  it('FR-6 knows the names that the draft introduces, and a location only when it has an entry', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'drafts/test/events/6052-2-021-07-toinen.md'), '---\ntitle: T\nlocation: lean\n---\nSammal ja Ton-Bor ja Bentaran tori.\n');
    fs.mkdirSync(path.join(root, 'drafts/test/journal'), { recursive: true });
    fs.writeFileSync(path.join(root, 'drafts/test/journal/sammal.md'), '---\ntype: npc\nname: Sammal\n---\nLammastilallinen.\n');
    const words = draftLinks(root, 'test').suggestions.filter((s) => s.file.endsWith('07-toinen.md')).map((s) => s.word);
    // Bentara is a location without an entry, so no link can point to it; Ton-Bor is unknown.
    expect(words).toEqual(['Sammal']);
  });

  it('FR-6 does not link an entry to itself, and reads only the default language', () => {
    const root = makeRoot();
    fs.mkdirSync(path.join(root, 'drafts/test/journal'), { recursive: true });
    fs.writeFileSync(path.join(root, 'drafts/test/journal/lean.md'), '---\ntype: location\n---\nLean on kylä. Og-Og asui Leanissa.\n@en\nOg-Og lived in Lean.\n');
    const own = draftLinks(root, 'test').suggestions.filter((s) => s.file.endsWith('journal/lean.md'));
    expect(own.map((s) => s.word)).toEqual(['Og-Og']);
  });

  it('FR-6 reads aliases.json, and an alias for an id that does not exist is an error', () => {
    const root = makeRoot();
    fs.writeFileSync(path.join(root, 'drafts/test/aliases.json'), JSON.stringify({ Kuningas: 'og-og' }));
    fs.appendFileSync(path.join(root, 'drafts/test/events/6052-2-021-06-testi.md'), 'Kuninkaalle ja Kuningasta.\n');
    expect(draftLinks(root, 'test').suggestions.map((s) => s.word)).toContain('Kuningasta');
    fs.writeFileSync(path.join(root, 'drafts/test/aliases.json'), JSON.stringify({ Kuningas: 'ei-ole' }));
    expect(() => draftLinks(root, 'test')).toThrow(/aliases\.json.*"Kuningas" names "ei-ole"/);
    fs.writeFileSync(path.join(root, 'drafts/test/aliases.json'), '[1]');
    expect(() => draftLinks(root, 'test')).toThrow('must be an object');
  });

  it('refuses a draft that does not exist', () => {
    expect(() => draftLinks(makeRoot(), 'nothing')).toThrow('drafts/nothing/ was not found');
  });
});

describe('names in -s (B-42)', () => {
  it('FR-6 matches the cases of a name in -s', () => {
    const t = buildTerms([{ id: 'magnus-bombus', type: 'pc', names: ['Magnus Bombus'] }]);
    expect(matchNames('Magnus Bombusta, Magnus Bombuksen, Magnus Bombuksella', t).map((m) => m.word)).toEqual(['Magnus Bombusta', 'Magnus Bombuksen', 'Magnus Bombuksella']);
  });
});
