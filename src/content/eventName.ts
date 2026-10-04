/** The parts of an event file name `year-month-day-order-slug.md`. */
export interface EventFileName {
  year: number;
  month: number;
  day: number;
  order: number;
  slug: string;
}

const EVENT_FILE = /^(\d+)-(\d+)-(\d+)-(\d+)-(.+)\.md$/;

/** Reads an event file name; null when it does not match the pattern. */
export function parseEventFileName(fileName: string): EventFileName | null {
  const match = EVENT_FILE.exec(fileName);
  if (!match) return null;
  const [, year, month, day, order, slug] = match;
  return { year: Number(year), month: Number(month), day: Number(day), order: Number(order), slug };
}

interface Dated {
  year: number;
  month: number;
  day: number;
  order: number;
}

/** Date order: year, month, day, then the order number within the day. */
export function compareEvents(a: Dated, b: Dated): number {
  return a.year - b.year || a.month - b.month || a.day - b.day || a.order - b.order;
}
