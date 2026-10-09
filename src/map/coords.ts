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

/** The reverse of `toLeaflet`: a Leaflet point `[lat, lng]` as a percent position. It can lie outside 0 to 100 when the point is outside the image. */
export function fromLeaflet([lat, lng]: LatLngTuple, { width, height }: ImageSize): Position {
  return [(lng / width) * 100, 100 - (lat / height) * 100];
}

/** The Leaflet bounds covered by the whole image. */
export function imageBounds({ width, height }: ImageSize): LatLngBoundsLiteral {
  return [[0, 0], [height, width]];
}
