import { describe, expect, it } from 'vitest';
import { renderWithLinks } from '../../plugin/links';

const names: Record<string, string> = { aldric: 'Aldric of Stroane', 'ring-of-stroane': 'Ring', mira: 'Mira' };
const nameOf = (id: string) => names[id];
const render = (markdown: string) => renderWithLinks(markdown, nameOf);
const anchor = (id: string, text: string) => `<a href="#" class="journal-link" data-journal="${id}">${text}</a>`;

describe('journal links (B-23)', () => {
  it('FR-6 [[id]] becomes a link with the entry\'s name', () => {
    const { html, errors, links } = render('Hello [[aldric]] there.');
    expect(errors).toEqual([]);
    expect(html).toBe(`<p>Hello ${anchor('aldric', 'Aldric of Stroane')} there.</p>`);
    expect(links).toEqual(['aldric']);
  });

  it('FR-6 [[id|text]] becomes a link with that text', () => {
    const { html, errors } = render('The [[aldric|knight]] came.');
    expect(errors).toEqual([]);
    expect(html).toBe(`<p>The ${anchor('aldric', 'knight')} came.</p>`);
  });

  it('FR-6 several links in a paragraph, and in several paragraphs, are all links, listed once each in order', () => {
    const { html, links, errors } = render('[[mira]] met [[aldric]] and [[mira|her]].\n\nThen [[ring-of-stroane]] and [[aldric]].');
    expect(errors).toEqual([]);
    expect(html.match(/journal-link/g)).toHaveLength(5);
    expect(links).toEqual(['mira', 'aldric', 'ring-of-stroane']);
  });

  it('FR-6 links work in emphasis, lists, quotes and headings, next to ordinary Markdown', () => {
    const { html, errors } = render('# About [[mira]]\n\n*Seen by [[aldric]]*\n\n- [[ring-of-stroane|the ring]]\n\n> [[mira]] said **no**.');
    expect(errors).toEqual([]);
    expect(html).toContain(`<h1>About ${anchor('mira', 'Mira')}</h1>`);
    expect(html).toContain(`<em>Seen by ${anchor('aldric', 'Aldric of Stroane')}</em>`);
    expect(html).toContain(`<li>${anchor('ring-of-stroane', 'the ring')}</li>`);
    expect(html).toContain('<strong>no</strong>');
  });

  it('FR-6 the syntax in code spans and code blocks is left as written', () => {
    const { html, errors, links } = render('Write `[[aldric]]` to link.\n\n```\n[[nobody]]\n```');
    expect(errors).toEqual([]);
    expect(links).toEqual([]);
    expect(html).toContain('<code>[[aldric]]</code>');
    expect(html).toContain('[[nobody]]');
    expect(html).not.toContain('journal-link');
  });

  it('FR-6 spaces around the id and the text are ignored', () => {
    const { html, errors } = render('[[ aldric | the knight ]]');
    expect(errors).toEqual([]);
    expect(html).toBe(`<p>${anchor('aldric', 'the knight')}</p>`);
  });

  it('FR-6 an id that is not an entry is an error naming the id', () => {
    expect(render('See [[nobody]].').errors).toEqual(['the link [[nobody]] names no journal entry "nobody"']);
    expect(render('See [[nobody|him]].').errors).toEqual(['the link [[nobody|him]] names no journal entry "nobody"']);
    expect(render('See [[Aldric]].').errors).toEqual(['the link [[Aldric]] names no journal entry "Aldric"']);
  });

  it('FR-6 a malformed link is an error: an empty id, an empty text, an unclosed or stray bracket', () => {
    expect(render('[[]]').errors).toEqual(['the link [[]] has no id']);
    expect(render('[[|text]]').errors).toEqual(['the link [[|text]] has no id']);
    expect(render('[[aldric|]]').errors).toEqual(['the link [[aldric|]] has no text after the "|"']);
    expect(render('Open [[aldric and more').errors).toEqual([expect.stringMatching(/not part of a link/)]);
    expect(render('Close aldric]] here').errors).toEqual([expect.stringMatching(/not part of a link/)]);
  });

  it('FR-6 a link inside an ordinary Markdown link is an error', () => {
    expect(render('[see [[aldric]]](https://example.com)').errors).toEqual([expect.stringMatching(/inside another link/)]);
  });

  it('FR-6 every problem in the text is reported, not only the first', () => {
    expect(render('[[a1]] and [[b2]]').errors).toHaveLength(2);
  });

  it('FR-6 text with no links is rendered as before', () => {
    const { html, links } = render('Plain *text*.\n\nTwo paragraphs.');
    expect(html).toBe('<p>Plain <em>text</em>.</p>\n<p>Two paragraphs.</p>');
    expect(links).toEqual([]);
  });
});
