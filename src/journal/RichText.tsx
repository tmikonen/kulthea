import { useContext, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { UNSAFE_NavigationContext, type To } from 'react-router';

interface Props {
  className?: string;
  /** The text as HTML from the build, in which a journal link is an anchor with a `data-journal` attribute. */
  html: string;
  /** The address that opens the entry with the given id. */
  hrefFor: (id: string) => To;
  /** Opens the entry. It is not called for a click that the browser should handle, such as one with Ctrl. */
  onOpen: (id: string) => void;
}

/**
 * Text from the build. Its journal links get real addresses, so that they work with the keyboard and
 * can be opened in a new tab, and a plain click opens the entry in the panel without leaving the page.
 */
export function RichText({ className, html, hrefFor, onOpen }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const { navigator } = useContext(UNSAFE_NavigationContext);
  // The addresses depend on the current address, so they are set again after every render.
  useLayoutEffect(() => {
    for (const anchor of container.current?.querySelectorAll<HTMLAnchorElement>('a[data-journal]') ?? []) {
      anchor.setAttribute('href', navigator.createHref(hrefFor(anchor.dataset.journal!)));
    }
  });

  const onClick = (click: MouseEvent<HTMLDivElement>) => {
    if (click.button !== 0 || click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) return;
    const anchor = (click.target as Element).closest<HTMLAnchorElement>('a[data-journal]');
    if (!anchor || !container.current?.contains(anchor)) return;
    click.preventDefault();
    onOpen(anchor.dataset.journal!);
  };

  return <div ref={container} className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
