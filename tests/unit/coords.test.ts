import { describe, expect, it } from 'vitest';
import { imageBounds, toLeaflet } from '../../src/map/coords';

const size = { width: 2000, height: 1000 };

describe('toLeaflet (FR-1, positions)', () => {
  it('maps the top-left corner to the top of the image, left edge', () => {
    expect(toLeaflet([0, 0], size)).toEqual([1000, 0]);
  });

  it('maps the bottom-right corner to the bottom of the image, right edge', () => {
    expect(toLeaflet([100, 100], size)).toEqual([0, 2000]);
  });

  it('maps the top-right and bottom-left corners', () => {
    expect(toLeaflet([100, 0], size)).toEqual([1000, 2000]);
    expect(toLeaflet([0, 100], size)).toEqual([0, 0]);
  });

  it('maps the centre to the centre', () => {
    expect(toLeaflet([50, 50], size)).toEqual([500, 1000]);
  });

  it('inverts the y axis: a larger percent y is lower on the image, so a smaller latitude', () => {
    const [latHigh] = toLeaflet([10, 20], size);
    const [latLow] = toLeaflet([10, 80], size);
    expect(latHigh).toBeGreaterThan(latLow);
  });

  it('scales x by the width and y by the height', () => {
    expect(toLeaflet([25, 10], size)).toEqual([900, 500]);
  });
});

describe('imageBounds', () => {
  it('covers the whole image from the bottom-left corner', () => {
    expect(imageBounds(size)).toEqual([[0, 0], [1000, 2000]]);
  });
});
