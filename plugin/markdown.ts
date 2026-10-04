import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

function collectHtml(node: MdNode, found: string[]) {
  if (node.type === 'html') found.push((node.value ?? '').trim());
  for (const child of node.children ?? []) collectHtml(child, found);
}

/** The raw HTML in a Markdown text (code spans and code blocks are not HTML). */
export function findRawHtml(markdown: string): string[] {
  const tree = unified().use(remarkParse).parse(markdown) as MdNode;
  const found: string[] = [];
  collectHtml(tree, found);
  return found;
}

/** Renders Markdown to HTML. Raw HTML is dropped, so reject it with `findRawHtml` first. */
export function renderMarkdown(markdown: string): string {
  return String(unified().use(remarkParse).use(remarkRehype).use(rehypeStringify).processSync(markdown));
}
