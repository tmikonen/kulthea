import type { ContentMap } from '../content/types';
import styles from './MapSwitcher.module.css';

interface Props {
  maps: ContentMap[];
  activeId: string;
  label: string;
  nameOf: (map: ContentMap) => string;
  onSelect: (id: string) => void;
}

export function MapSwitcher({ maps, activeId, label, nameOf, onSelect }: Props) {
  return (
    <div className={styles.switcher} role="group" aria-label={label}>
      {maps.map((map) => (
        <button
          key={map.id}
          type="button"
          className={styles.button}
          aria-pressed={map.id === activeId}
          onClick={() => onSelect(map.id)}
        >
          {nameOf(map)}
        </button>
      ))}
    </div>
  );
}
