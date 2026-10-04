import type { EventDef } from './content/types';
import { resolveText } from './content/text';
import styles from './EventList.module.css';

interface Props {
  events: EventDef[];
  label: string;
  lang: string;
  defaultLang: string;
}

/** A temporary list of the events in date order. The event panel (B-11 onward) replaces it. */
export function EventList({ events, label, lang, defaultLang }: Props) {
  return (
    <nav className={styles.list} aria-label={label}>
      <ol>
        {events.map((event) => (
          <li key={event.id}>{resolveText(event.title, lang, defaultLang)}</li>
        ))}
      </ol>
    </nav>
  );
}
