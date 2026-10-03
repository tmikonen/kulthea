import type { LatLngBoundsLiteral, LatLngTuple } from 'leaflet';

/** A position on a map: `[x, y]` in percent of the image, from the top-left corner. */
export type Position = [x: number, y: number];

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * The only place where percent positions become Leaflet coordinates.
 * The image is laid out in pixel units with its bottom-left corner at [0, 0],
 * so Leaflet's y (latitude) runs upward while the percent y runs downward.
 */
export function toLeaflet([x, y]: Position, { width, height }: ImageSize): LatLngTuple {
  return [((100 - y) / 100) * height, (x / 100) * width];
}

/** The Leaflet bounds covered by the whole image. */
export function imageBounds({ width, height }: ImageSize): LatLngBoundsLiteral {
  return [[0, 0], [height, width]];
}
