import styles from './LanguageSwitch.module.css';

interface Props {
  languages: string[];
  activeLanguage: string;
  label: string;
  onSelect: (language: string) => void;
}

export function LanguageSwitch({ languages, activeLanguage, label, onSelect }: Props) {
  return (
    <div className={styles.switch} role="group" aria-label={label}>
      {languages.map((language) => (
        <button
          key={language}
          type="button"
          lang={language}
          className={styles.button}
          aria-pressed={language === activeLanguage}
          onClick={() => onSelect(language)}
        >
          {language.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
