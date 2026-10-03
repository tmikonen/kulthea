import content from 'virtual:content';
import { resolveText } from './content/text';
import styles from './App.module.css';

export function App() {
  const { campaign, maps } = content;
  const lang = campaign.defaultLanguage;
  return (
    <main className={styles.app}>
      <h1>{resolveText(campaign.title, lang, lang)}</h1>
      {/* Temporary list, replaced by the map switcher in B-5. */}
      <ul aria-label="Maps">
        {maps.map((map) => (
          <li key={map.id}>
            {resolveText(map.name, lang, lang)} ({map.width} x {map.height})
          </li>
        ))}
      </ul>
    </main>
  );
}
