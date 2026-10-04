import { useEffect } from 'react';
import type { ContentMap } from '../content/types';

/** Once the displayed map is shown, downloads every map image in the background. */
export function usePreloadMaps(maps: ContentMap[], shown: boolean) {
  useEffect(() => {
    if (!shown) return;
    for (const map of maps) new Image().src = map.imageUrl;
  }, [maps, shown]);
}
