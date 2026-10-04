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

  describe('paragraphs', () => {
    const paragraphs = (markdown: string) => render(markdown).paragraphs;

    it('FR-6 every paragraph is rendered on its own, with the ids it links to', () => {
      const result = paragraphs('First, no links.\n\n[[aldric]] met [[mira]] and [[aldric|him]].\n\nLast one [[mira]].');
      expect(result).toEqual([
        { html: '<p>First, no links.</p>', links: [] },
        { html: `<p>${anchor('aldric', 'Aldric of Stroane')} met ${anchor('mira', 'Mira')} and ${anchor('aldric', 'him')}.</p>`, links: ['aldric', 'mira'] },
        { html: `<p>Last one ${anchor('mira', 'Mira')}.</p>`, links: ['mira'] },
      ]);
    });

    it('FR-6 a paragraph in a list item or a quote counts, and a heading or a code block does not', () => {
      const result = paragraphs('# [[mira]] heading\n\n- item [[aldric]]\n\n> quote [[mira]]\n\n```\n[[x]]\n```');
      expect(result.map((p) => p.links)).toEqual([['aldric'], ['mira']]);
    });

    it('FR-6 a paragraph with Markdown inside keeps it', () => {
      expect(paragraphs('*[[mira]]* said **no**.')[0].html).toBe(`<p><em>${anchor('mira', 'Mira')}</em> said <strong>no</strong>.</p>`);
    });

    it('FR-6 text with no paragraphs gives none', () => {
      expect(paragraphs('')).toEqual([]);
      expect(paragraphs('# Only a heading')).toEqual([]);
    });
  });

  describe('images', () => {
    const lookup = (path: string) => (path === 'images/a.png' ? { width: 60, height: 40 } : { error: `image file "${path}" not found` });
    const withImages = (markdown: string) => renderWithLinks(markdown, nameOf, lookup);
    const img = (alt: string) =>
      `<img src="@@image:images/a.png@@" alt="${alt}" width="60" height="40" loading="lazy" decoding="async" data-image="" tabindex="0" role="button">`;

    it('FR-3 an image alone in a paragraph is a figure with the title as a visible caption', () => {
      const { html, errors, warnings } = withImages('![Alt text](images/a.png "The caption")');
      expect(errors).toEqual([]);
      expect(warnings).toEqual([]);
      expect(html).toBe(`<figure class="text-figure">${img('Alt text')}<figcaption>The caption</figcaption></figure>`);
    });

    it('FR-3 with no title there is no caption, and lazy loading, the size and the address mark are always there', () => {
      const { html } = withImages('![Alt](images/a.png)');
      expect(html).toBe(`<figure class="text-figure">${img('Alt')}</figure>`);
      expect(html).toContain('loading="lazy"');
      expect(html).toContain('width="60" height="40"');
    });

    it('FR-3 an image among text stays in the line, without a caption', () => {
      expect(withImages('Text ![in](images/a.png "t") more').html).toBe(`<p>Text ${img('in')} more</p>`);
    });

    it('FR-3 a missing image is an error, and an image with no alt text is a warning', () => {
      expect(withImages('![x](images/no.png)').errors).toEqual(['image file "images/no.png" not found']);
      const empty = withImages('![](images/a.png)');
      expect(empty.errors).toEqual([]);
      expect(empty.warnings).toEqual(['the image "images/a.png" has no alt text']);
      expect(withImages('![   ](images/a.png)').warnings).toHaveLength(1);
    });

    it('FR-3 an image in a paragraph that names a character is in the paragraph\'s excerpt', () => {
      const { paragraphs } = withImages('See [[mira]] ![pic](images/a.png) here.');
      expect(paragraphs).toHaveLength(1);
      expect(paragraphs[0].links).toEqual(['mira']);
      expect(paragraphs[0].html).toContain('data-image');
    });

    it('FR-3 without a lookup, images are left as they are', () => {
      expect(render('![x](images/a.png)').html).toBe('<p><img src="images/a.png" alt="x"></p>');
    });
  });
});
