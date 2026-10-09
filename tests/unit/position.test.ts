import { describe, expect, it } from 'vitest';
import { formatPosition, isOnImage, roundPosition, snippet } from '../../src/place/position';

describe('the position helper text (B-40)', () => {
  it('writes a position with one decimal, always', () => {
    expect(formatPosition([45.31, 79])).toBe('[45.3, 79.0]');
    expect(formatPosition([0, 100])).toBe('[0.0, 100.0]');
    expect(formatPosition([12.25, 7.96])).toBe('[12.3, 8.0]');
  });

  it('rounds to one decimal', () => {
    expect(roundPosition([45.349, 79.051])).toEqual([45.3, 79.1]);
  });

  it('writes the positions entry for a place on a map', () => {
    expect(snippet('ford-crossing', 'bog-end', [40, 31.04])).toBe('"ford-crossing": { "bog-end": [40.0, 31.0] }');
  });

  it('knows whether a position is on the image, the edges included', () => {
    expect(isOnImage([0, 0])).toBe(true);
    expect(isOnImage([100, 100])).toBe(true);
    expect(isOnImage([-0.1, 50])).toBe(false);
    expect(isOnImage([50, 100.1])).toBe(false);
  });
});
