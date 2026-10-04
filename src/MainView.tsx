import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import content from 'virtual:content';
import { activeLanguage } from './content/language';
import { resolveText, uiText } from './content/text';
import { formatDate } from './content/dates';
import { eventLocationId, eventLocationName, eventPath, eventText, findEvent, neighbours } from './content/events';
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
import { JournalPanel, type EventItem, type ExcerptItem } from './journal/JournalPanel';
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
  /** A journal link in a text: it opens the entry over the same event, unless that entry is already open. */
  const entryLink = (id: string) => ({ pathname: location.pathname, search: withJournal(id).toString() });
  /** The events listed on the open entry, each linking to its event (a language choice is kept, the rest is dropped). */
  const eventItem = (id: string): (EventItem & { event: EventDef }) | null => {
    const listed = findEvent(content.events, id);
    if (!listed) return null;
    const search = new URLSearchParams();
    if (params.has('lang')) search.set('lang', params.get('lang')!);
    return {
      id,
      event: listed,
      title: resolveText(listed.title, lang, defaultLang),
      date: formatDate(campaign, lang, listed),
      to: { pathname: eventPath(id), search: search.toString() },
    };
  };
  const eventItems: EventItem[] = view?.kind === 'entry'
    ? (view.entry.events[lang] ?? []).flatMap((id) => eventItem(id) ?? [])
    : [];
  /** The excerpts of the open character: the paragraphs of each event, in the language of the event's text (the default one, with a note, when it has none). */
  const excerptItems: ExcerptItem[] = view?.kind === 'entry'
    ? (view.entry.excerpts[lang] ?? []).flatMap((excerpt) => {
        const item = eventItem(excerpt.event);
        return item ? [{ ...item, html: excerpt.html.join(''), fallback: lang !== defaultLang && item.event.text[lang] === undefined }] : [];
      })
    : [];
  const locationId = event ? eventLocationId(event) : null;
  const hasLocationEntry = locationId !== null && content.journal.some((e) => e.type === 'location' && e.id === locationId);
  const openEntry = (id: string) => {
    if (params.get('journal') !== id) setParams(withJournal(id));
  };
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
            onClick={() => (view ? closeJournal() : setParams(withJournal(INDEX_PARAM)))}
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
            locationTo={hasLocationEntry ? entryLink(locationId) : null}
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
            linkTo={entryLink}
            onOpenEntry={openEntry}
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
            indexTo={{ pathname: location.pathname, search: withJournal(INDEX_PARAM).toString() }}
            notTranslated={uiText(ui, 'notTranslated', lang, defaultLang)}
            linkTo={entryLink}
            onOpenEntry={openEntry}
            eventItems={eventItems}
            eventsLabel={uiText(ui, 'journalEvents', lang, defaultLang)}
            excerptItems={excerptItems}
            campaignLabel={uiText(ui, 'journalCampaign', lang, defaultLang)}
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
