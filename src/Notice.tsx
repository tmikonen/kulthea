import styles from './Notice.module.css';

interface Props {
  message: string;
  dismissLabel: string;
  onDismiss: () => void;
}

/** A short message above the event panel that the user can dismiss. */
export function Notice({ message, dismissLabel, onDismiss }: Props) {
  return (
    <div className={styles.notice} role="status">
      <span>{message}</span>
      <button type="button" className={styles.dismiss} onClick={onDismiss}>
        {dismissLabel}
      </button>
    </div>
  );
}
