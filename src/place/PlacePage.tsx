import { useState } from 'react';
import { CRS } from 'leaflet';
import { CircleMarker, ImageOverlay, MapContainer, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import content from 'virtual:content';
import { resolveText } from '../content/text';
import { fromLeaflet, imageBounds, toLeaflet, type Position } from '../map/coords';
import { FitToImage, INITIAL_MIN_ZOOM } from '../map/MapView';
import type { ContentMap } from '../content/types';
import { formatPosition, isOnImage, roundPosition, snippet } from './position';
import styles from './PlacePage.module.css';

/**
 * A development tool, served by the dev server only (the build has no `place.html`): click on a map to read the
 * position as a percent of the image, and get a snippet for a place that has no position on that map yet. It
 * writes nothing. The texts are English and fixed, because the page is not part of the site.
 */

function ClickToPosition({ map: def, onPick }: { map: ContentMap; onPick: (position: Position) => void }) {
  useMapEvents({
    click(event) {
      const position = fromLeaflet([event.latlng.lat, event.latlng.lng], def);
      // The area can show more than the image, so a click beside the image is ignored.
      if (isOnImage(position)) onPick(position);
    },
  });
  return null;
}

export function PlacePage() {
  const { campaign, maps, locations } = content;
  const name = (text: Parameters<typeof resolveText>[0]) => resolveText(text, campaign.defaultLanguage, campaign.defaultLanguage);
  const [mapId, setMapId] = useState(maps.find((map) => map.main)?.id ?? maps[0].id);
  const [picked, setPicked] = useState<string | null>(null);
  const [point, setPoint] = useState<Position | null>(null);
  const [copied, setCopied] = useState('');
  const def = maps.find((map) => map.id === mapId)!;
  const bounds = imageBounds(def);
  const placed = locations.filter((location) => location.positions[mapId]);
  const unplaced = locations.filter((location) => !location.positions[mapId]);
  const pickedLocation = unplaced.find((location) => location.id === picked);

  const changeMap = (id: string) => {
    setMapId(id);
    setPicked(null);
    setPoint(null);
    setCopied('');
  };
  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => setCopied(text));
  };

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <h1>Position helper</h1>
        <label>
          Map{' '}
          <select value={mapId} onChange={(event) => changeMap(event.target.value)}>
            {maps.map((map) => (
              <option key={map.id} value={map.id}>{name(map.name)}</option>
            ))}
          </select>
        </label>
        <span className={styles.result}>
          {point ? (
            <>
              Position <code data-testid="position">{formatPosition(point)}</code>{' '}
              <button type="button" onClick={() => copy(formatPosition(point))}>Copy position</button>
            </>
          ) : (
            'Click on the map to read a position.'
          )}
        </span>
        {point && pickedLocation && (
          <span className={styles.result}>
            <code data-testid="snippet">{snippet(pickedLocation.id, mapId, point)}</code>{' '}
            <button type="button" onClick={() => copy(snippet(pickedLocation.id, mapId, point))}>Copy snippet</button>
          </span>
        )}
        {copied && <span role="status">Copied</span>}
      </div>
      <div className={styles.body}>
        <div className={styles.side}>
          <h2>Places with no position on this map</h2>
          {unplaced.length === 0 ? (
            <p>None.</p>
          ) : (
            <ul>
              {unplaced.map((location) => (
                <li key={location.id}>
                  <button
                    type="button"
                    aria-pressed={picked === location.id}
                    onClick={() => setPicked(picked === location.id ? null : location.id)}
                  >
                    {name(location.name)} <small>({location.id})</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.map} role="region" aria-label="Map">
          <MapContainer
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
            <ImageOverlay url={def.imageUrl} bounds={bounds} />
            {placed.map((location) => (
              <CircleMarker
                key={location.id}
                center={toLeaflet(location.positions[mapId], def)}
                radius={5}
                interactive={false}
                className="known-place"
                pathOptions={{ color: '#ffffff', weight: 1, fillColor: '#8f2d24', fillOpacity: 0.9 }}
              >
                <Tooltip permanent direction="top">{name(location.name)}</Tooltip>
              </CircleMarker>
            ))}
            {point && (
              <CircleMarker
                center={toLeaflet(roundPosition(point), def)}
                radius={8}
                interactive={false}
                className="clicked-point"
                pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#1e6ae0', fillOpacity: 0.9 }}
              />
            )}
            <FitToImage map={def} />
            <ClickToPosition map={def} onPick={setPoint} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
