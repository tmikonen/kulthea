import { useEffect, type ReactNode } from 'react';
import { CRS } from 'leaflet';
import { CircleMarker, ImageOverlay, MapContainer, Pane, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ContentMap } from '../content/types';
import { imageBounds, toLeaflet, type Position } from './coords';
import type { MapMarker } from './markers';
import { isInView } from './view';
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
    // Leaflet only notices window resizes. The area also changes size with the layout around it
    // (the event panel, a notice), so watch the container itself and let Leaflet refit on change.
    const observer = new ResizeObserver(() => map.invalidateSize({ debounceMoveend: true }));
    observer.observe(map.getContainer());
    return () => {
      observer.disconnect();
      map.off('resize', fit);
    };
  }, [map, def]);
  return null;
}

/** The current event's marker: where it is on the displayed map, and its location's name if it has one. */
export interface CurrentMarker {
  position: Position;
  label: string | null;
}

/** Pans to the current marker when it is outside the visible area. The zoom is never changed. */
function PanToMarker({ map: def, marker }: { map: ContentMap; marker: CurrentMarker | undefined }) {
  const map = useMap();
  const [x, y] = marker?.position ?? [];
  useEffect(() => {
    if (x === undefined || y === undefined) return;
    const target = toLeaflet([x, y], def);
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    if (!isInView(map.latLngToContainerPoint(target), size)) {
      map.panTo(target, { animate: true, duration: 0.3 });
    }
  }, [map, def, x, y]);
  return null;
}

interface MapViewProps {
  map: ContentMap;
  label: string;
  /** Called when the map image has loaded, that is, when the map is shown. */
  onImageLoad?: () => void;
  /** Small dots for the places visited so far on this map. */
  markers?: MapMarker[];
  /** The current event's marker, drawn above the others, or none when the event is not on this map. */
  current?: CurrentMarker;
  /** Controls drawn over the map area. */
  children?: ReactNode;
}

export function MapView({ map: def, label, onImageLoad, markers = [], current, children }: MapViewProps) {
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
            radius={5}
            className="visited-dot"
            pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#8f2d24', fillOpacity: 0.9 }}
          >
            {marker.label && <Tooltip>{marker.label}</Tooltip>}
          </CircleMarker>
        ))}
        {current && (
          <Pane name="current-event" style={{ zIndex: 650 }}>
            <CircleMarker
              center={toLeaflet(current.position, def)}
              radius={11}
              className="current-marker"
              pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#e0301e', fillOpacity: 1 }}
            >
              {current.label && <Tooltip>{current.label}</Tooltip>}
            </CircleMarker>
          </Pane>
        )}
        <PanToMarker map={def} marker={current} />
        <FitToImage map={def} />
      </MapContainer>
    </div>
  );
}
