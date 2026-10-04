import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import content from 'virtual:content';
import { activeLanguage } from './content/language';
import { resolveText, uiText } from './content/text';
import { formatDate } from './content/dates';
import { eventLocationName, eventPath, eventText, neighbours } from './content/events';
import type { EventDef } from './content/types';
import { EventPanel } from './EventPanel';
import { LanguageSwitch } from './LanguageSwitch';
import { displayedMap } from './map/mapParam';
import { MapSwitcher } from './map/MapSwitcher';
import { dotsFor } from './map/markers';
import { buildRoutes, visibleRoutes } from './map/routes';
import { eventPlaceOn, placeName, visitedPlaces } from './map/places';
import { MapView } from './map/MapView';
import { groupEntries, journalView, INDEX_PARAM } from './journal/journal';
import { JournalPanel } from './journal/JournalPanel';
import { Notice } from './Notice';
import { usePreloadMaps } from './map/usePreloadMaps';
import styles from './MainView.module.css';

/** The names of the split groups in the order they first appear, which decides their colours. */
const groupNames = [
  ...new Set(content.events.map((event) => event.track).filter((track): track is string => !!track && track !== 'none')),
];

/** The route segments of every map, worked out once when the app loads. */
const routeSegments = buildRoutes(
  content.events,
  content.maps.map((map) => ({ id: map.id, routes: map.routes })),
  content.maps.find((map) => map.main)!.id,
  content.locations,
);

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
  const current = displayedMap(maps, params.get('map'), event);
  const [shown, setShown] = useState(false);
  usePreloadMaps(maps, shown);

  const { previous, next } = neighbours(content.events, event?.id);
  const text = event ? eventText(event, lang, defaultLang) : { html: '', fallback: false };
  /** Steps to another event. A manual map choice lasts only until the next step, so `map` is dropped. */
  const step = (target: EventDef) => {
    const kept = new URLSearchParams(params);
    kept.delete('map');
    kept.delete('journal');
    navigate({ pathname: eventPath(target.id), search: kept.toString() });
  };

  const mainMapId = maps.find((map) => map.main)!.id;
  const place = event ? eventPlaceOn(event, current.id, mainMapId, locations) : null;
  const lines = event
    ? visibleRoutes(routeSegments, content.events, content.events.indexOf(event), current.id, current.routes)
        .map((segment) => ({
          group: segment.track === null ? null : groupNames.indexOf(segment.track),
          points: segment.points.map((point) => point.position),
        }))
    : [];
  const visited = event ? visitedPlaces(content.events, content.events.indexOf(event), current.id, mainMapId, locations) : [];

  const view = journalView(params.get('journal'), content.journal);
  const withJournal = (value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete('journal');
    else next.set('journal', value);
    return next;
  };
  const closeJournal = () => setParams(withJournal(null));
  useEffect(() => {
    if (!view) return;
    const onKey = (key: KeyboardEvent) => {
      if (key.key === 'Escape') closeJournal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.journalButton}
            aria-expanded={view !== null}
            onClick={() => setParams(withJournal(INDEX_PARAM))}
          >
            {uiText(ui, 'journal', lang, defaultLang)}
          </button>
          <LanguageSwitch
            languages={campaign.languages}
            activeLanguage={lang}
            label={uiText(ui, 'language', lang, defaultLang)}
            onSelect={(language) => setParam('lang', language)}
          />
        </div>
      </header>
      <div className={styles.main}>
        <MapView
          map={current}
          label={nameOf(current)}
          routes={lines}
          markers={dotsFor(visited, locations, lang, defaultLang)}
          eventId={event?.id}
          current={place ? { position: place.position, label: placeName(place, locations, lang, defaultLang) } : undefined}
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
            textHtml={text.html}
            notTranslated={text.fallback ? uiText(ui, 'notTranslated', lang, defaultLang) : null}
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
        {view && (
          <JournalPanel
            view={view}
            groups={groupEntries(content.journal, lang, defaultLang)}
            lang={lang}
            defaultLang={defaultLang}
            entryTo={(entry) => ({ pathname: location.pathname, search: withJournal(entry.id).toString() })}
            onClose={closeJournal}
            label={uiText(ui, 'journal', lang, defaultLang)}
            closeLabel={uiText(ui, 'closeJournal', lang, defaultLang)}
            typeLabels={{
              pc: uiText(ui, 'typePc', lang, defaultLang),
              npc: uiText(ui, 'typeNpc', lang, defaultLang),
              item: uiText(ui, 'typeItem', lang, defaultLang),
              location: uiText(ui, 'typeLocation', lang, defaultLang),
              note: uiText(ui, 'typeNote', lang, defaultLang),
            }}
          />
        )}
      </div>
    </div>
  );
}
