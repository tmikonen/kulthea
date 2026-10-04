/** The margin, in pixels, that a marker keeps from the edge of the visible area. */
export const VIEW_MARGIN = 24;

/** Whether a point in the map container, in pixels from its top-left corner, is inside the visible area. */
export function isInView(
  point: { x: number; y: number },
  size: { x: number; y: number },
  margin = VIEW_MARGIN,
): boolean {
  return point.x >= margin && point.y >= margin && point.x <= size.x - margin && point.y <= size.y - margin;
}
