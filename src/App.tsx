import content from 'virtual:content';
import { resolveText } from './content/text';
import { MapView } from './map/MapView';
import styles from './App.module.css';

export function App() {
  const { campaign, maps } = content;
  const lang = campaign.defaultLanguage;
  const main = maps.find((map) => map.main)!;
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>{resolveText(campaign.title, lang, lang)}</h1>
      </header>
      <MapView map={main} label={resolveText(main.name, lang, lang)} />
    </div>
  );
}
