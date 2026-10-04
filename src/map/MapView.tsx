import { useEffect, useRef, type ReactNode } from 'react';
import { CRS, latLng } from 'leaflet';
import { CircleMarker, ImageOverlay, MapContainer, Pane, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ContentMap } from '../content/types';
import { imageBounds, toLeaflet, type Position } from './coords';
import type { MapMarker } from './markers';
import { focusCenter, focusLevel, isInView } from './view';
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

/**
 * On a map without a focus zoom, pans to the current marker when it is outside the visible area.
 * The zoom is never changed.
 */
function PanToMarker({ map: def, marker }: { map: ContentMap; marker: CurrentMarker | undefined }) {
  const map = useMap();
  const [x, y] = marker?.position ?? [];
  useEffect(() => {
    if (def.focusZoom > 0 || x === undefined || y === undefined) return;
    const target = toLeaflet([x, y], def);
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    if (!isInView(map.latLngToContainerPoint(target), size)) {
      map.panTo(target, { animate: true, duration: 0.3 });
    }
  }, [map, def, x, y]);
  return null;
}

/** How long the view takes to move to the focused view of the next event on the same map, in seconds. */
const FOCUS_SECONDS = 0.6;

/**
 * On a map with a focus zoom, shows the current event in a focused view: centred on its marker (as
 * far as the image allows), zoomed in by the map's number of steps from the whole map. It runs for
 * every event, so the user's own zooming and panning last until the next step. The first focus on a
 * map is immediate, and the move to the next event on the same map is animated.
 */
function FocusOnMarker({ map: def, marker, eventId }: { map: ContentMap; marker: CurrentMarker | undefined; eventId: string | undefined }) {
  const map = useMap();
  const focused = useRef<string | undefined>(undefined);
  const [x, y] = marker?.position ?? [];
  useEffect(() => {
    if (def.focusZoom <= 0 || x === undefined || y === undefined) return;
    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;
    // FitToImage runs first, and has set the minimum zoom to the fitted zoom.
    const zoom = focusLevel(map.getMinZoom(), def.focusZoom, map.options.zoomDelta ?? 1, map.getMaxZoom());
    const [[south, west], [north, east]] = imageBounds(def);
    const corner = map.project(latLng(south, west), zoom);
    const opposite = map.project(latLng(north, east), zoom);
    const centre = focusCenter(
      map.project(toLeaflet([x, y], def), zoom),
      {
        minX: Math.min(corner.x, opposite.x),
        maxX: Math.max(corner.x, opposite.x),
        minY: Math.min(corner.y, opposite.y),
        maxY: Math.max(corner.y, opposite.y),
      },
      size,
    );
    const target = map.unproject([centre.x, centre.y], zoom);
    const animate = focused.current !== undefined && focused.current !== eventId;
    focused.current = eventId;
    if (animate) map.flyTo(target, zoom, { duration: FOCUS_SECONDS });
    else map.setView(target, zoom, { animate: false });
  }, [map, def, eventId, x, y]);
  return null;
}

interface MapViewProps {
  map: ContentMap;
  label: string;
  /** Called when the map image has loaded, that is, when the map is shown. */
  onImageLoad?: () => void;
  /** Lines of the party's route on this map, each a list of positions in order. A line of one point is not drawn. */
  routes?: Position[][];
  /** Small dots for the places visited so far on this map. */
  markers?: MapMarker[];
  /** The current event's marker, drawn above the others, or none when the event is not on this map. */
  current?: CurrentMarker;
  /** The current event, so that the focused view is applied again at every event. */
  eventId?: string;
  /** Controls drawn over the map area. */
  children?: ReactNode;
}

export function MapView({ map: def, label, onImageLoad, routes = [], markers = [], current, eventId, children }: MapViewProps) {
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
        {/* Panes, from the bottom: the map image (400), the route lines, the visited places, the current marker. */}
        <Pane name="routes" style={{ zIndex: 410 }}>
          {routes
            .filter((points) => points.length >= 2)
            .map((points, i) => (
              <Polyline
                key={`${i}:${points.map((p) => p.join(',')).join(' ')}`}
                positions={points.map((point) => toLeaflet(point, def))}
                className="route-line route-party"
                interactive={false}
                pathOptions={{ color: '#1f4e8c', weight: 4, opacity: 0.85, lineJoin: 'round' }}
              />
            ))}
        </Pane>
        <Pane name="visited-places" style={{ zIndex: 420 }}>
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
        </Pane>
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
        <FitToImage map={def} />
        <FocusOnMarker map={def} marker={current} eventId={eventId} />
        <PanToMarker map={def} marker={current} />
      </MapContainer>
    </div>
  );
}
