import { useEffect, type ReactNode } from 'react';
import { CRS } from 'leaflet';
import { CircleMarker, ImageOverlay, MapContainer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ContentMap } from '../content/types';
import { imageBounds, toLeaflet } from './coords';
import type { MapMarker } from './markers';
import styles from './MapView.module.css';

/**
 * Leaflet clamps the zoom that fits an image to the map's zoom limits, which default to a
 * minimum of 0 (the image's native size). Large images need a negative zoom to fit, so the map
 * starts with wide limits, and FitToImage widens them again before every fit and then sets the
 * real ones.
 */
const INITIAL_MIN_ZOOM = -20;
const INITIAL_MAX_ZOOM = 20;

/** How far past the fitted view, and past the image's native size, the user can zoom in. */
const EXTRA_ZOOM = 2;

/** Fits the image to the area, and refits it on resize unless the user has zoomed in. */
function FitToImage({ map: def }: { map: ContentMap }) {
  const map = useMap();
  useEffect(() => {
    const bounds = imageBounds(def);
    let fittedZoom: number | undefined;

    const fit = () => {
      // getBoundsZoom clamps to the current zoom limits, which belong to the previous size.
      map.setMinZoom(INITIAL_MIN_ZOOM);
      map.setMaxZoom(INITIAL_MAX_ZOOM);
      const fitZoom = map.getBoundsZoom(bounds);
      if (!Number.isFinite(fitZoom)) return;
      const wasFitted = fittedZoom === undefined || Math.abs(map.getZoom() - fittedZoom) < 0.01;
      // Move the view first, while the limits are still wide. Setting a limit that the current
      // zoom violates makes Leaflet start an animated zoom, and while that runs it silently
      // ignores any further fitBounds, so a quick shrink-then-grow would be lost.
      if (wasFitted) map.fitBounds(bounds, { animate: false });
      else if (map.getZoom() < fitZoom) map.setZoom(fitZoom, { animate: false });
      map.setMinZoom(fitZoom);
      map.setMaxZoom(Math.max(fitZoom, 0) + EXTRA_ZOOM);
      fittedZoom = fitZoom;
    };

    map.invalidateSize();
    fit();
    map.on('resize', fit);
    return () => {
      map.off('resize', fit);
    };
  }, [map, def]);
  return null;
}

interface MapViewProps {
  map: ContentMap;
  label: string;
  /** Called when the map image has loaded, that is, when the map is shown. */
  onImageLoad?: () => void;
  /** Location markers to draw on this map. */
  markers?: MapMarker[];
  /** Controls drawn over the map area. */
  children?: ReactNode;
}

export function MapView({ map: def, label, onImageLoad, markers = [], children }: MapViewProps) {
  const bounds = imageBounds(def);
  return (
    <div className={styles.map} role="region" aria-label={label}>
      {children}
      <MapContainer
        // A different image is a different coordinate space, so start a new Leaflet map.
        key={def.id}
        crs={CRS.Simple}
        bounds={bounds}
        maxBounds={bounds}
        maxBoundsViscosity={1}
        minZoom={INITIAL_MIN_ZOOM}
        zoomSnap={0}
        zoomDelta={0.5}
        attributionControl={false}
        className={styles.container}
      >
        <ImageOverlay url={def.imageUrl} bounds={bounds} eventHandlers={{ load: () => onImageLoad?.() }} />
        {markers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={toLeaflet(marker.position, def)}
            radius={6}
            pathOptions={{ color: '#7a1f1f', weight: 2, fillColor: '#d94a3d', fillOpacity: 0.9 }}
          >
            <Tooltip>{marker.label}</Tooltip>
          </CircleMarker>
        ))}
        <FitToImage map={def} />
      </MapContainer>
    </div>
  );
}
