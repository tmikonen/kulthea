import type { Locator } from '@playwright/test';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Waits until an element has stopped moving and changing size: its box is the same on several reads in
 * a row. Use it after an action that starts an animation (a zoom, a slide, a resize) instead of sleeping
 * for a guessed time, which is too short on a slow machine. Returns the settled box.
 */
export async function settled(locator: Locator, { reads = 4, interval = 80, timeout = 10_000 } = {}): Promise<Box> {
  const start = Date.now();
  let last = '';
  let same = 0;
  while (Date.now() - start < timeout) {
    const box = await locator.boundingBox();
    const key = box ? JSON.stringify([box.x, box.y, box.width, box.height].map((value) => Math.round(value * 10) / 10)) : '';
    if (box && key === last) {
      same += 1;
      if (same >= reads) return box;
    } else {
      same = 0;
      last = key;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('the element did not settle: its box kept changing');
}
