/** A part of a language section of an event: ordinary text, or a journal-only passage. */
export type Segment =
  | { kind: 'text'; markdown: string }
  | { kind: 'passage'; ids: string[]; markdown: string };

export interface Passages {
  segments: Segment[];
  /** The text without the passages, as the event shows it. */
  text: string;
  errors: string[];
}

const OPEN = /^:::journal\{for="([^"]*)"\}\s*$/;
const BLOCK_LINE = /^:::\S/;
const CLOSE = /^:::\s*$/;
const FENCE = /^\s{0,3}(```|~~~)/;

/**
 * Finds the journal-only passages of a text: a line `:::journal{for="id"}` (or `for="id1,id2"`) up to a
 * line `:::`. It reads lines, so a colon in ordinary text is never taken for a block. Lines inside a fenced
 * code block are left alone. `typeOf` gives the type of an entry, or undefined when there is no such entry:
 * a passage may only be for a player character or an NPC.
 */
export function extractPassages(markdown: string, typeOf: (id: string) => string | undefined): Passages {
  const errors: string[] = [];
  const segments: Segment[] = [];
  const text: string[] = [];
  let current: string[] = [];
  let open: { ids: string[]; lines: string[] } | null = null;
  let fence: string | null = null;

  const flush = () => {
    if (current.some((line) => line.trim() !== '')) segments.push({ kind: 'text', markdown: current.join('\n') });
    current = [];
  };

  for (const line of markdown.split(/\r?\n/)) {
    const fenceMatch = FENCE.exec(line);
    if (open === null && fenceMatch) {
      fence = fence === null ? fenceMatch[1] : fence === fenceMatch[1] ? null : fence;
    }
    if (fence !== null || (open === null && fenceMatch)) {
      current.push(line);
      text.push(line);
      continue;
    }

    if (open !== null) {
      if (CLOSE.test(line)) {
        segments.push({ kind: 'passage', ids: open.ids, markdown: open.lines.join('\n') });
        open = null;
        text.push(''); // The event's own text goes on as a new paragraph.
      } else if (BLOCK_LINE.test(line)) {
        errors.push(`a "${line.trim()}" block is inside a journal passage, and passages cannot be nested`);
      } else {
        open.lines.push(line);
      }
      continue;
    }

    const opening = OPEN.exec(line);
    if (opening) {
      flush();
      const ids = opening[1].split(',').map((id) => id.trim());
      if (ids.some((id) => id === '')) errors.push(`the passage "${line.trim()}" has an empty id in "for"`);
      for (const id of ids.filter((candidate) => candidate !== '')) {
        const type = typeOf(id);
        if (type === undefined) errors.push(`the passage is for "${id}", which is not a journal entry`);
        else if (type !== 'pc' && type !== 'npc') errors.push(`the passage is for "${id}", which is not a player character or an NPC`);
      }
      open = { ids: ids.filter((id) => id !== ''), lines: [] };
      text.push('');
      continue;
    }
    if (BLOCK_LINE.test(line)) {
      errors.push(`the block "${line.trim()}" is not a journal passage (use :::journal{for="id"})`);
      continue;
    }
    if (CLOSE.test(line)) {
      errors.push('a ":::" line closes no passage');
      continue;
    }
    current.push(line);
    text.push(line);
  }
  if (open !== null) errors.push('a journal passage is not closed with a ":::" line');
  flush();
  return { segments, text: text.join('\n'), errors };
}
