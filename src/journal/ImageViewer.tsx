import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './ImageViewer.module.css';

/** The text of the viewer's close button, from `ui.json`. */
export const CloseImageLabel = createContext('Close');

export interface ViewedImage {
  src: string;
  alt: string;
  caption: string | null;
}

/** An image shown as large as the window allows, over the page. */
function ImageViewer({ image, onClose }: { image: ViewedImage; onClose: () => void }) {
  const label = useContext(CloseImageLabel);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    // Escape closes only the viewer: the capture listener runs before the one that closes the journal panel.
    const onKey = (key: KeyboardEvent) => {
      if (key.key !== 'Escape') return;
      key.stopImmediatePropagation();
      key.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={(click) => click.target === click.currentTarget && onClose()}
      // The viewer is a portal, but React events still bubble to the components around the picture. Keep the
      // arrow keys, which step through the events in the event panel, from doing that while the viewer is open.
      onKeyDown={(key) => key.stopPropagation()}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={image.alt || image.caption || label}>
        <button ref={close} type="button" className={styles.close} onClick={onClose} aria-label={label}>
          ×
        </button>
        <img className={styles.image} src={image.src} alt={image.alt} />
        {image.caption && <p className={styles.caption}>{image.caption}</p>}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The state of an image viewer. `open` shows an image, and `viewer` is the element to render. When the
 * viewer closes, focus goes back to the element that was focused when it opened.
 */
export function useImageViewer(): { open: (image: ViewedImage) => void; viewer: ReactNode } {
  const [image, setImage] = useState<ViewedImage | null>(null);
  const opener = useRef<Element | null>(null);
  const open = useCallback((next: ViewedImage) => {
    opener.current = document.activeElement;
    setImage(next);
  }, []);
  const close = useCallback(() => {
    setImage(null);
    if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus();
  }, []);
  return { open, viewer: image ? <ImageViewer image={image} onClose={close} /> : null };
}
