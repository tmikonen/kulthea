import type { EventDef } from './content/types';
import { resolveText } from './content/text';
import styles from './EventPanel.module.css';

interface Props {
  event: EventDef;
  /** The location's name, or null when the event has no named place. */
  locationName: string | null;
  label: string;
  lang: string;
  defaultLang: string;
}

/** The current event's details, below the map. The date, text and stepping come in later items. */
export function EventPanel({ event, locationName, label, lang, defaultLang }: Props) {
  return (
    <section className={styles.panel} aria-label={label}>
      <h2 className={styles.title}>{resolveText(event.title, lang, defaultLang)}</h2>
      {locationName && <p className={styles.location}>{locationName}</p>}
    </section>
  );
}
