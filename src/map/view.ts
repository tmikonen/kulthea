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

/** A box in pixels at some zoom. */
export interface PixelBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * The zoom of the focused view: the fitted zoom plus the given number of zoom-in steps, but not
 * beyond the maximum zoom.
 */
export function focusLevel(fittedZoom: number, steps: number, zoomDelta: number, maxZoom: number): number {
  return Math.min(fittedZoom + steps * zoomDelta, maxZoom);
}

/**
 * The centre of a view of the given size that shows the target as near the middle as the image
 * allows: the view is kept inside the image, and an image smaller than the view is centred.
 */
export function focusCenter(
  target: { x: number; y: number },
  image: PixelBox,
  size: { x: number; y: number },
): { x: number; y: number } {
  const fit = (value: number, min: number, max: number, view: number) => {
    const low = min + view / 2;
    const high = max - view / 2;
    return low > high ? (min + max) / 2 : Math.min(Math.max(value, low), high);
  };
  return {
    x: fit(target.x, image.minX, image.maxX, size.x),
    y: fit(target.y, image.minY, image.maxY, size.y),
  };
}
