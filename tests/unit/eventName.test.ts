import { describe, expect, it } from 'vitest';
import { compareEvents, parseEventFileName } from '../../src/content/eventName';

describe('event file names (B-8)', () => {
  it('FR-7 reads year, month, day, order and slug', () => {
    expect(parseEventFileName('6050-1-037-02-ambush.md')).toEqual({
      year: 6050, month: 1, day: 37, order: 2, slug: 'ambush',
    });
  });

  it('FR-7 accepts days and orders without leading zeros, and a slug with dashes', () => {
    expect(parseEventFileName('6050-5-9-1-at-the-ford.md')).toEqual({
      year: 6050, month: 5, day: 9, order: 1, slug: 'at-the-ford',
    });
  });

  it.each([
    'ambush.md',
    '6050-1-037-ambush.md',
    '6050-1-037-02.md',
    '6050-1-037-02-ambush.txt',
    '6050-1-037-02-ambush',
    '6050-a-037-02-ambush.md',
    '-1-037-02-ambush.md',
  ])('FR-7 rejects the file name %s', (name) => {
    expect(parseEventFileName(name)).toBeNull();
  });
});

describe('event order (B-8)', () => {
  const at = (year: number, month: number, day: number, order: number) => ({ year, month, day, order });

  it('FR-7 sorts by year, then month, then day, then order number', () => {
    const sorted = [at(6051, 1, 1, 1), at(6050, 2, 1, 1), at(6050, 1, 10, 1), at(6050, 1, 9, 2), at(6050, 1, 9, 1)]
      .sort(compareEvents);
    expect(sorted).toEqual([at(6050, 1, 9, 1), at(6050, 1, 9, 2), at(6050, 1, 10, 1), at(6050, 2, 1, 1), at(6051, 1, 1, 1)]);
  });

  it('FR-7 compares numbers, not text: day 9 comes before day 10', () => {
    expect(compareEvents(at(6050, 1, 9, 1), at(6050, 1, 10, 1))).toBeLessThan(0);
  });

  it('FR-7 equal dates compare as equal', () => {
    expect(compareEvents(at(6050, 1, 1, 1), at(6050, 1, 1, 1))).toBe(0);
  });
});
