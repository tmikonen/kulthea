import { useState } from 'react';
import { useSearchParams } from 'react-router';
import content from 'virtual:content';
import { resolveText, uiText } from './content/text';
import { activeMap } from './map/mapParam';
import { MapSwitcher } from './map/MapSwitcher';
import { MapView } from './map/MapView';
import { usePreloadMaps } from './map/usePreloadMaps';
import styles from './App.module.css';

export function App() {
  const { campaign, maps, ui } = content;
  const lang = campaign.defaultLanguage;
  const [params, setParams] = useSearchParams();
  const current = activeMap(maps, params.get('map'));
  const [shown, setShown] = useState(false);
  usePreloadMaps(maps, shown);

  const nameOf = (map: (typeof maps)[number]) => resolveText(map.name, lang, lang);
  const selectMap = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('map', id);
    setParams(next);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>{resolveText(campaign.title, lang, lang)}</h1>
      </header>
      <MapView map={current} label={nameOf(current)} onImageLoad={() => setShown(true)}>
        <MapSwitcher
          maps={maps}
          activeId={current.id}
          label={uiText(ui, 'maps', lang, lang)}
          nameOf={nameOf}
          onSelect={selectMap}
        />
      </MapView>
    </div>
  );
}
