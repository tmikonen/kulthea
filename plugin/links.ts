import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  alt?: string | null;
  title?: string | null;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

/** A journal link: `[[id]]` or `[[id|text]]`, with no brackets, bars or line breaks inside. */
const LINK = /\[\[([^[\]|\n]*)(?:\|([^[\]\n]*))?\]\]/g;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A paragraph of the text, rendered on its own, with the ids of the entries it links to. */
export interface Paragraph {
  html: string;
  links: string[];
}

/** What is known of an image file: its size, or what is wrong with it. */
export type ImageInfo = { width: number; height: number } | { error: string };

/** Finds an image by the path written in the text. */
export type ImageLookup = (path: string) => ImageInfo;

/** The mark that the build puts where the served address of an image goes. The plugin replaces it. */
export const imageMark = (path: string) => `@@image:${path}@@`;

export interface RenderedText {
  html: string;
  /** The ids of the entries the text links to, once each, in the order they first appear. */
  links: string[];
  /** Every paragraph of the text in document order, also those inside lists and quotes. */
  paragraphs: Paragraph[];
  errors: string[];
  /** Things that are not wrong enough to stop the build, such as an image with no alt text. */
  warnings: string[];
}

/**
 * Renders Markdown to HTML, turning the journal links into anchors with a `data-journal` attribute
 * (the app sets the address and handles the click). `nameOf` gives the text of a link with no text of
 * its own, or undefined when no entry has that id. A link in code is left as written. Raw HTML is dropped,
 * so reject it first.
 */
export function renderWithLinks(
  markdown: string,
  nameOf: (id: string) => string | undefined,
  imageOf?: ImageLookup,
): RenderedText {
  const links: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const imageElement = (node: MdNode, info: { width: number; height: number }) => ({
    type: 'element',
    tagName: 'img',
    properties: {
      src: imageMark(node.url ?? ''),
      alt: node.alt ?? '',
      width: info.width,
      height: info.height,
      loading: 'lazy',
      decoding: 'async',
      dataImage: '',
      tabIndex: 0,
      role: 'button',
    },
    children: [],
  });

  /**
   * Gives each image its size, lazy loading and a served address (the app opens it large on a click).
   * A paragraph that holds only an image becomes a figure, with the image's title as a visible caption.
   */
  function processImages(node: MdNode) {
    for (const child of node.children ?? []) {
      if (child.type === 'image') {
        const path = child.url ?? '';
        const info = imageOf ? imageOf(path) : null;
        if (info && 'error' in info) {
          errors.push(info.error);
        } else if (info) {
          if ((child.alt ?? '').trim() === '') warnings.push(`the image "${path}" has no alt text`);
          const element = imageElement(child, info);
          child.data = { hName: 'img', hProperties: element.properties };
          child.title = null;
        }
      }
      processImages(child);
    }
  }

  /** Turns paragraphs that hold only an image into figures. Runs after `processImages`, which needs the titles. */
  function makeFigures(node: MdNode, titles: Map<MdNode, string | undefined>) {
    for (const child of node.children ?? []) {
      if (child.type === 'paragraph' && child.children?.length === 1 && child.children[0].type === 'image' && child.children[0].data) {
        const image = child.children[0];
        const caption = titles.get(image);
        const img = { type: 'element', tagName: 'img', properties: image.data!.hProperties, children: [] };
        child.data = {
          hName: 'figure',
          hProperties: { className: ['text-figure'] },
          hChildren: [
            img,
            ...(caption ? [{ type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: caption }] }] : []),
          ],
        };
      } else {
        makeFigures(child, titles);
      }
    }
  }

  /** The titles of the images, which are the captions, noted before `processImages` takes them off the nodes. */
  const titles = new Map<MdNode, string | undefined>();
  const rememberTitles = (node: MdNode) => {
    for (const child of node.children ?? []) {
      if (child.type === 'image') titles.set(child, child.title ?? undefined);
      rememberTitles(child);
    }
  };

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

  const paragraphs: Paragraph[] = [];
  const linksIn = (node: MdNode, found: string[]) => {
    const id = (node.data?.hProperties as Record<string, string> | undefined)?.['data-journal'];
    if (id && !found.includes(id)) found.push(id);
    for (const child of node.children ?? []) linksIn(child, found);
    return found;
  };
  const toHtml = unified().use(remarkRehype).use(rehypeStringify);
  const collect = (node: MdNode) => {
    if (node.type === 'paragraph') {
      const root = { type: 'root', children: [node] };
      paragraphs.push({ html: String(toHtml.stringify(toHtml.runSync(root as never))), links: linksIn(node, []) });
      return;
    }
    for (const child of node.children ?? []) collect(child);
  };

  const processor = unified()
    .use(remarkParse)
    .use(() => (tree: MdNode) => {
      transform(tree, false);
      if (imageOf) {
        rememberTitles(tree);
        processImages(tree);
        makeFigures(tree, titles);
      }
      collect(tree);
    })
    .use(remarkRehype)
    .use(rehypeStringify);
  const html = String(processor.processSync(markdown));
  return { html, links, paragraphs, errors, warnings };
}
