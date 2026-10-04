import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import content from 'virtual:content';
import { activeLanguage } from './content/language';
import { resolveText, uiText } from './content/text';
import { formatDate } from './content/dates';
import { eventLocationName, eventPath, neighbours } from './content/events';
import type { EventDef } from './content/types';
import { EventPanel } from './EventPanel';
import { LanguageSwitch } from './LanguageSwitch';
import { activeMap } from './map/mapParam';
import { MapSwitcher } from './map/MapSwitcher';
import { markersFor } from './map/markers';
import { MapView } from './map/MapView';
import { Notice } from './Notice';
import { usePreloadMaps } from './map/usePreloadMaps';
import styles from './MainView.module.css';

/** The state that a redirect from an unknown event id leaves in the history entry. */
interface NoticeState {
  unknownEvent?: boolean;
}

/** The header, the map and the panel of the current event. */
export function MainView({ event }: { event?: EventDef }) {
  const { campaign, maps, locations, ui } = content;
  const defaultLang = campaign.defaultLanguage;
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const showNotice = event !== undefined && (location.state as NoticeState | null)?.unknownEvent === true;
  const lang = activeLanguage(campaign.languages, defaultLang, params.get('lang'));
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const current = activeMap(maps, params.get('map'));
  const [shown, setShown] = useState(false);
  usePreloadMaps(maps, shown);

  const { previous, next } = neighbours(content.events, event?.id);
  /** Steps to another event. A manual map choice lasts only until the next step, so `map` is dropped. */
  const step = (target: EventDef) => {
    const kept = new URLSearchParams(params);
    kept.delete('map');
    navigate({ pathname: eventPath(target.id), search: kept.toString() });
  };

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
      {showNotice && (
        <Notice
          message={uiText(ui, 'unknownEvent', lang, defaultLang)}
          dismissLabel={uiText(ui, 'dismiss', lang, defaultLang)}
          onDismiss={() => navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })}
        />
      )}
      {event && (
        <EventPanel
          event={event}
          locationName={eventLocationName(event, locations, lang, defaultLang)}
          date={formatDate(campaign, lang, event)}
          label={uiText(ui, 'event', lang, defaultLang)}
          lang={lang}
          defaultLang={defaultLang}
          previous={previous}
          next={next}
          previousLabel={uiText(ui, 'previous', lang, defaultLang)}
          nextLabel={uiText(ui, 'next', lang, defaultLang)}
          onStep={step}
        />
      )}
    </div>
  );
}
