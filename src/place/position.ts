import type { Position } from '../map/coords';

/** True when a percent position lies on the image. */
export function isOnImage([x, y]: Position): boolean {
  return x >= 0 && x <= 100 && y >= 0 && y <= 100;
}

/** A position rounded to one decimal, as it is written in the content files. */
export function roundPosition([x, y]: Position): Position {
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/** `[45.3, 79.0]`: one decimal always, so the text is the same length as the values change. */
export function formatPosition(position: Position): string {
  const [x, y] = roundPosition(position);
  return `[${x.toFixed(1)}, ${y.toFixed(1)}]`;
}

/** The `positions` entry for a place on a map, ready to paste into `locations.json`. */
export function snippet(locationId: string, mapId: string, position: Position): string {
  return `"${locationId}": { "${mapId}": ${formatPosition(position)} }`;
}
