import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import content from 'virtual:content';
import { activeLanguage } from './content/language';
import { resolveText, uiText } from './content/text';
import { EventList } from './EventList';
import { LanguageSwitch } from './LanguageSwitch';
import { activeMap } from './map/mapParam';
import { MapSwitcher } from './map/MapSwitcher';
import { markersFor } from './map/markers';
import { MapView } from './map/MapView';
import { usePreloadMaps } from './map/usePreloadMaps';
import styles from './App.module.css';

export function App() {
  const { campaign, maps, locations, events, ui } = content;
  const defaultLang = campaign.defaultLanguage;
  const [params, setParams] = useSearchParams();
  const lang = activeLanguage(campaign.languages, defaultLang, params.get('lang'));
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const current = activeMap(maps, params.get('map'));
  const [shown, setShown] = useState(false);
  usePreloadMaps(maps, shown);

  const nameOf = (map: (typeof maps)[number]) => resolveText(map.name, lang, defaultLang);
  const setParam = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(name, value);
    setParams(next);
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>{resolveText(campaign.title, lang, defaultLang)}</h1>
        <LanguageSwitch
          languages={campaign.languages}
          activeLanguage={lang}
          label={uiText(ui, 'language', lang, defaultLang)}
          onSelect={(language) => setParam('lang', language)}
        />
      </header>
      <MapView
        map={current}
        label={nameOf(current)}
        markers={markersFor(locations, current.id, lang, defaultLang)}
        onImageLoad={() => setShown(true)}
      >
        <MapSwitcher
          maps={maps}
          activeId={current.id}
          label={uiText(ui, 'maps', lang, defaultLang)}
          nameOf={nameOf}
          onSelect={(id) => setParam('map', id)}
        />
      </MapView>
      <EventList
        events={events}
        label={uiText(ui, 'events', lang, defaultLang)}
        lang={lang}
        defaultLang={defaultLang}
      />
    </div>
  );
}
