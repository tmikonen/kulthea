import { useEffect } from 'react';
import { CRS } from 'leaflet';
import { ImageOverlay, MapContainer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ContentMap } from '../content/types';
import { imageBounds } from './coords';
import styles from './MapView.module.css';

/** How far past the fitted view, and past the image's native size, the user can zoom in. */
const EXTRA_ZOOM = 2;

/** Fits the image to the area, and keeps the zoom limits right when the area is resized. */
function FitToImage({ map: def }: { map: ContentMap }) {
  const map = useMap();
  useEffect(() => {
    const bounds = imageBounds(def);
    const fit = () => {
      const fitZoom = map.getBoundsZoom(bounds);
      if (!Number.isFinite(fitZoom)) return;
      map.setMinZoom(fitZoom);
      map.setMaxZoom(Math.max(fitZoom, 0) + EXTRA_ZOOM);
      return fitZoom;
    };
    map.invalidateSize();
    if (fit() !== undefined) map.fitBounds(bounds, { animate: false });
    map.on('resize', fit);
    return () => {
      map.off('resize', fit);
    };
  }, [map, def]);
  return null;
}

export function MapView({ map: def, label }: { map: ContentMap; label: string }) {
  const bounds = imageBounds(def);
  return (
    <div className={styles.map} role="region" aria-label={label}>
      <MapContainer
        // A different image is a different coordinate space, so start a new Leaflet map.
        key={def.id}
        crs={CRS.Simple}
        bounds={bounds}
        maxBounds={bounds}
        maxBoundsViscosity={1}
        zoomSnap={0}
        zoomDelta={0.5}
        attributionControl={false}
        className={styles.container}
      >
        <ImageOverlay url={def.imageUrl} bounds={bounds} />
        <FitToImage map={def} />
      </MapContainer>
    </div>
  );
}
