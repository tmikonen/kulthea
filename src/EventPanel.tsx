import type { To } from 'react-router';
import type { EventDef } from './content/types';
import { RichText } from './journal/RichText';
import { resolveText } from './content/text';
import styles from './EventPanel.module.css';

interface Props {
  event: EventDef;
  /** The location's name, or null when the event has no named place. */
  locationName: string | null;
  /** The date, written out in the chosen language. */
  date: string;
  /** The text as HTML, from the build, which does not allow raw HTML in it. */
  textHtml: string;
  /** The text note shown when it is in the default language because there is no translation. */
  notTranslated: string | null;
  label: string;
  lang: string;
  defaultLang: string;
  /** The neighbouring events in date order, or null at the ends. */
  previous: EventDef | null;
  next: EventDef | null;
  previousLabel: string;
  nextLabel: string;
  onStep: (target: EventDef) => void;
  /** The address and the action of a journal link in the text. */
  linkTo: (id: string) => To;
  onOpenEntry: (id: string) => void;
}

/** The current event's details, below the map, with the buttons to step to the neighbouring events. */
export function EventPanel({
  event, locationName, date, textHtml, notTranslated, label, lang, defaultLang, previous, next, previousLabel, nextLabel, onStep, linkTo, onOpenEntry,
}: Props) {
  // The arrow keys step while focus is in the panel. They are not handled on the map, which pans
  // with them, and a modified arrow (such as Alt+Left, the browser's back) is left alone.
  const onKeyDown = (key: React.KeyboardEvent) => {
    if (key.altKey || key.ctrlKey || key.metaKey || key.shiftKey) return;
    const target = key.key === 'ArrowLeft' ? previous : key.key === 'ArrowRight' ? next : null;
    if (target) {
      key.preventDefault();
      onStep(target);
    }
  };

  return (
    <section className={styles.panel} aria-label={label} onKeyDown={onKeyDown}>
      {/* The buttons have a row of their own above the details, so that they stay in one place however many lines the details have. */}
      <div className={styles.stepper}>
        <button type="button" disabled={!previous} onClick={() => previous && onStep(previous)}>
          {previousLabel}
        </button>
        <button type="button" disabled={!next} onClick={() => next && onStep(next)}>
          {nextLabel}
        </button>
      </div>
      <div className={styles.content}>
        <h2 className={styles.title}>{resolveText(event.title, lang, defaultLang)}</h2>
        <p className={styles.date}>{date}</p>
        {locationName && <p className={styles.location}>{locationName}</p>}
        {notTranslated && <p className={styles.note}>{notTranslated}</p>}
        <RichText className={styles.text} html={textHtml} hrefFor={linkTo} onOpen={onOpenEntry} />
      </div>
    </section>
  );
}
