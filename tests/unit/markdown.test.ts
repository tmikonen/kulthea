import { describe, expect, it } from 'vitest';
import { findRawHtml, renderMarkdown } from '../../plugin/markdown';

describe('Markdown rendering (B-10)', () => {
  it('FR-3 renders paragraphs, emphasis and lists to HTML', () => {
    expect(renderMarkdown('Hei *maailma*, **lihavoitu**.\n\nToinen kappale.'))
      .toBe('<p>Hei <em>maailma</em>, <strong>lihavoitu</strong>.</p>\n<p>Toinen kappale.</p>');
    expect(renderMarkdown('- a\n- b')).toBe('<ul>\n<li>a</li>\n<li>b</li>\n</ul>');
  });

  it('FR-3 renders links and keeps Finnish letters', () => {
    expect(renderMarkdown('[Kartta](https://example.com) ääkköset')).toBe('<p><a href="https://example.com">Kartta</a> ääkköset</p>');
  });

  it('FR-3 escapes characters that could start a tag', () => {
    expect(renderMarkdown('1 < 2 & 3')).toBe('<p>1 &#x3C; 2 &#x26; 3</p>');
  });
});

describe('raw HTML in Markdown (B-10)', () => {
  it('FR-3 finds an HTML tag in a paragraph, and a block of HTML', () => {
    expect(findRawHtml('teksti <i>x</i> loppu')).toEqual(['<i>', '</i>']);
    expect(findRawHtml('<div>\nblokki\n</div>')).toEqual(['<div>\nblokki\n</div>']);
  });

  it('FR-3 finds an HTML comment, and a tag in a list or a quote', () => {
    expect(findRawHtml('<!-- piilotettu -->')).toEqual(['<!-- piilotettu -->']);
    expect(findRawHtml('- kohta <b>x</b>')).toEqual(['<b>', '</b>']);
    expect(findRawHtml('> lainaus <u>x</u>')).toEqual(['<u>', '</u>']);
  });

  it('FR-3 does not drop a script tag silently: it is found', () => {
    expect(findRawHtml('<script>alert(1)</script>')).toEqual(['<script>alert(1)</script>']);
  });

  it('FR-3 allows a tag written in a code span, a code block, or escaped', () => {
    expect(findRawHtml('Kirjoita `<b>` näin')).toEqual([]);
    expect(findRawHtml('```\n<div>\n```')).toEqual([]);
    expect(findRawHtml('\\<b>')).toEqual([]);
  });

  it('FR-3 allows an automatic link in angle brackets, and plain text', () => {
    expect(findRawHtml('<https://example.com>')).toEqual([]);
    expect(findRawHtml('Ei mitään erikoista.')).toEqual([]);
  });
});
