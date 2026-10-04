import { useEffect, useRef } from 'react';
import { Link, type To } from 'react-router';
import type { JournalEntryDef, JournalType } from '../content/types';
import { entryName, type JournalGroup, type JournalView } from './journal';
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
}

/**
 * The journal panel: it slides in from the right over the main view and shows the index or one entry.
 * When it opens, focus moves into it, and when it closes, focus goes back to where it was, unless the
 * user has already moved it to something else.
 */
export function JournalPanel({ view, groups, lang, defaultLang, entryTo, onClose, label, closeLabel, typeLabels }: Props) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    panel.current?.focus();
    return () => {
      if (document.activeElement === document.body && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  return (
    <aside ref={panel} className={styles.panel} aria-label={label} tabIndex={-1}>
      <div className={styles.bar}>
        <h2 className={styles.heading}>{label}</h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label={closeLabel}>
          ×
        </button>
      </div>
      <div className={styles.body}>
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
          <h3>{entryName(view.entry, lang, defaultLang)}</h3>
        )}
      </div>
    </aside>
  );
}
