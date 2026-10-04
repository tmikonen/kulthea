import type { EventDef } from './content/types';
import { resolveText } from './content/text';
import styles from './EventPanel.module.css';

interface Props {
  event: EventDef;
  /** The location's name, or null when the event has no named place. */
  locationName: string | null;
  /** The date, written out in the chosen language. */
  date: string;
  label: string;
  lang: string;
  defaultLang: string;
  /** The neighbouring events in date order, or null at the ends. */
  previous: EventDef | null;
  next: EventDef | null;
  previousLabel: string;
  nextLabel: string;
  onStep: (target: EventDef) => void;
}

/** The current event's details, below the map, with the buttons to step to the neighbouring events. */
export function EventPanel({
  event, locationName, date, label, lang, defaultLang, previous, next, previousLabel, nextLabel, onStep,
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
      <h2 className={styles.title}>{resolveText(event.title, lang, defaultLang)}</h2>
      <p className={styles.date}>{date}</p>
      {locationName && <p className={styles.location}>{locationName}</p>}
      <div className={styles.stepper}>
        <button type="button" disabled={!previous} onClick={() => previous && onStep(previous)}>
          {previousLabel}
        </button>
        <button type="button" disabled={!next} onClick={() => next && onStep(next)}>
          {nextLabel}
        </button>
      </div>
    </section>
  );
}
