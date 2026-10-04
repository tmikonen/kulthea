import { useEffect, useRef } from 'react';
import { Link, type To } from 'react-router';
import { resolveText } from '../content/text';
import type { JournalEntryDef, JournalType } from '../content/types';
import { RichText } from './RichText';
import { entryName, entryText, type JournalGroup, type JournalView } from './journal';
import styles from './JournalPanel.module.css';

interface Props {
  view: JournalView;
  groups: JournalGroup[];
  lang: string;
  defaultLang: string;
  /** The address that opens an entry over the current event. */
  entryTo: (entry: JournalEntryDef) => To;
  onClose: () => void;
  label: string;
  closeLabel: string;
  typeLabels: Record<JournalType, string>;
  /** The address of the index, for the link back from an entry. */
  indexTo: To;
  /** The note shown when an entry's text is in the default language because it has no translation. */
  notTranslated: string;
  /** The address and the action of a journal link in an entry's text. */
  linkTo: (id: string) => To;
  onOpenEntry: (id: string) => void;
  /** The events listed on the open entry, with the address of each, and the heading of the list. */
  eventItems: EventItem[];
  eventsLabel: string;
  /** The excerpts of the open entry (player characters and NPCs), and the heading of the section. */
  excerptItems: ExcerptItem[];
  campaignLabel: string;
}

/** An event's pieces in the "In the campaign" section of a character: the event, and the paragraphs. */
export interface ExcerptItem extends EventItem {
  /** The paragraphs as HTML. */
  html: string;
  /** The event has no text in the chosen language, so the paragraphs are in the default language. */
  fallback: boolean;
}

/** An event in the list on an entry. */
export interface EventItem {
  id: string;
  title: string;
  date: string;
  to: To;
}

/**
 * The journal panel: it slides in from the right over the main view and shows the index or one entry.
 * When it opens, focus moves into it, and when it closes, focus goes back to where it was, unless the
 * user has already moved it to something else.
 */
export function JournalPanel({ view, groups, lang, defaultLang, entryTo, onClose, label, closeLabel, typeLabels, indexTo, notTranslated, linkTo, onOpenEntry, eventItems, eventsLabel, excerptItems, campaignLabel }: Props) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    // Without preventScroll the browser scrolls the page to bring the panel into view while it is still sliding in.
    panel.current?.focus({ preventScroll: true });
    return () => {
      if (document.activeElement === document.body && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // A different entry starts at the top.
  const body = useRef<HTMLDivElement>(null);
  const viewKey = view.kind === 'index' ? 'index' : view.entry.id;
  useEffect(() => {
    body.current?.scrollTo?.(0, 0);
  }, [viewKey]);

  return (
    <aside ref={panel} className={styles.panel} aria-label={label} tabIndex={-1}>
      <div className={styles.bar}>
        <h2 className={styles.heading}>{label}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
          ×
        </button>
      </div>
      <div ref={body} className={styles.body}>
        {view.kind === 'index' ? (
          groups.map((group) => (
            <section key={group.type} className={styles.group}>
              <h3>{typeLabels[group.type]}</h3>
              <ul>
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <Link to={entryTo(entry)}>{entryName(entry, lang, defaultLang)}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <EntryView
            entry={view.entry}
            lang={lang}
            defaultLang={defaultLang}
            indexTo={indexTo}
            backLabel={label}
            notTranslated={notTranslated}
            linkTo={linkTo}
            onOpenEntry={onOpenEntry}
            eventItems={eventItems}
            eventsLabel={eventsLabel}
            excerptItems={excerptItems}
            campaignLabel={campaignLabel}
          />
        )}
      </div>
    </aside>
  );
}

interface EntryProps {
  entry: JournalEntryDef;
  lang: string;
  defaultLang: string;
  indexTo: To;
  backLabel: string;
  notTranslated: string;
  linkTo: (id: string) => To;
  onOpenEntry: (id: string) => void;
  eventItems: EventItem[];
  eventsLabel: string;
  excerptItems: ExcerptItem[];
  campaignLabel: string;
}

/** One entry: a link back to the index, the lead image, the name, the motto and the text. */
function EntryView({ entry, lang, defaultLang, indexTo, backLabel, notTranslated, linkTo, onOpenEntry, eventItems, eventsLabel, excerptItems, campaignLabel }: EntryProps) {
  const name = entryName(entry, lang, defaultLang);
  const text = entryText(entry, lang, defaultLang);
  const motto = entry.motto === null ? null : resolveText(entry.motto, lang, defaultLang);
  return (
    <article className={styles.entry}>
      <Link to={indexTo} className={styles.back}>
        ‹ {backLabel}
      </Link>
      {entry.image && (
        <img className={styles.image} src={entry.image.src} width={entry.image.width} height={entry.image.height} alt={name} />
      )}
      <h3 className={styles.name}>{name}</h3>
      {motto && <p className={styles.motto}>{motto}</p>}
      {text.fallback && <p className={styles.note}>{notTranslated}</p>}
      <RichText className={styles.text} html={text.html} hrefFor={linkTo} onOpen={onOpenEntry} />
      {excerptItems.length > 0 && (
        <section className={styles.campaign}>
          <h4>{campaignLabel}</h4>
          {excerptItems.map((item) => (
            <div key={item.id} className={styles.excerpt}>
              <h5>
                <Link to={item.to}>{item.title}</Link> <span className={styles.eventDate}>{item.date}</span>
              </h5>
              {item.fallback && <p className={styles.note}>{notTranslated}</p>}
              <RichText className={styles.text} html={item.html} hrefFor={linkTo} onOpen={onOpenEntry} />
            </div>
          ))}
        </section>
      )}
      {eventItems.length > 0 && (
        <section className={styles.events}>
          <h4>{eventsLabel}</h4>
          <ul>
            {eventItems.map((item) => (
              <li key={item.id}>
                <Link to={item.to}>{item.title}</Link> <span className={styles.eventDate}>{item.date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
