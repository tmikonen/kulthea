import { describe, expect, it } from 'vitest';
import { fromLeaflet, imageBounds, toLeaflet } from '../../src/map/coords';

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

describe('fromLeaflet (B-40, the position helper)', () => {
  it('is the reverse of toLeaflet at the corners and the centre', () => {
    for (const position of [[0, 0], [100, 0], [0, 100], [100, 100], [50, 50]] as [number, number][]) {
      const back = fromLeaflet(toLeaflet(position, size), size);
      expect(back[0]).toBeCloseTo(position[0], 9);
      expect(back[1]).toBeCloseTo(position[1], 9);
    }
  });

  it('round-trips random positions on images of other shapes', () => {
    let seed = 12345;
    const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 200; i++) {
      const shape = { width: 100 + Math.floor(random() * 4900), height: 100 + Math.floor(random() * 4900) };
      const position: [number, number] = [random() * 100, random() * 100];
      const back = fromLeaflet(toLeaflet(position, shape), shape);
      expect(back[0]).toBeCloseTo(position[0], 7);
      expect(back[1]).toBeCloseTo(position[1], 7);
    }
  });

  it('gives positions outside 0 to 100 for points outside the image', () => {
    const [x, y] = fromLeaflet([1100, -200], size);
    expect(x).toBeCloseTo(-10, 9);
    expect(y).toBeCloseTo(-10, 9);
  });
});
