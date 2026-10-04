import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

/** A journal link: `[[id]]` or `[[id|text]]`, with no brackets, bars or line breaks inside. */
const LINK = /\[\[([^[\]|\n]*)(?:\|([^[\]\n]*))?\]\]/g;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface RenderedText {
  html: string;
  /** The ids of the entries the text links to, once each, in the order they first appear. */
  links: string[];
  errors: string[];
}

/**
 * Renders Markdown to HTML, turning the journal links into anchors with a `data-journal` attribute
 * (the app sets the address and handles the click). `nameOf` gives the text of a link with no text of
 * its own, or undefined when no entry has that id. A link in code is left as written. Raw HTML is dropped,
 * so reject it first.
 */
export function renderWithLinks(markdown: string, nameOf: (id: string) => string | undefined): RenderedText {
  const links: string[] = [];
  const errors: string[] = [];

  /** Replaces the links in the text nodes by link nodes, and reports what is wrong with the rest. */
  function transform(node: MdNode, insideLink: boolean) {
    const inside = insideLink || node.type === 'link' || node.type === 'linkReference';
    if (!node.children) return;
    const result: MdNode[] = [];
    for (const child of node.children) {
      if (child.type !== 'text') {
        transform(child, inside);
        result.push(child);
        continue;
      }
      const text = child.value ?? '';
      let last = 0;
      let rest = '';
      for (const match of text.matchAll(LINK)) {
        const [whole, rawId, rawText] = match;
        const start = match.index!;
        rest += text.slice(last, start);
        last = start + whole.length;
        const id = rawId.trim();
        const label = rawText === undefined ? undefined : rawText.trim();
        if (id === '') {
          errors.push(`the link ${whole} has no id`);
          continue;
        }
        if (label === '') {
          errors.push(`the link ${whole} has no text after the "|"`);
          continue;
        }
        const name = ID.test(id) ? nameOf(id) : undefined;
        if (name === undefined) {
          errors.push(`the link ${whole} names no journal entry "${id}"`);
          continue;
        }
        if (inside) {
          errors.push(`the link ${whole} is inside another link, which is not allowed`);
          continue;
        }
        if (rest !== '') result.push({ type: 'text', value: rest });
        rest = '';
        if (!links.includes(id)) links.push(id);
        result.push({
          type: 'link',
          url: '#',
          children: [{ type: 'text', value: label ?? name }],
          data: { hProperties: { className: ['journal-link'], 'data-journal': id } },
        });
      }
      rest += text.slice(last);
      if (/\[\[|\]\]/.test(rest)) errors.push(`a "[[" or "]]" in the text is not part of a link like [[id]] or [[id|text]]`);
      if (rest !== '') result.push({ type: 'text', value: rest });
    }
    node.children = result;
  }

  const processor = unified()
    .use(remarkParse)
    .use(() => (tree: MdNode) => transform(tree, false))
    .use(remarkRehype)
    .use(rehypeStringify);
  const html = String(processor.processSync(markdown));
  return { html, links, errors };
}
