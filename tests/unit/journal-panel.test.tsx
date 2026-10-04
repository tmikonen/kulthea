import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from '../../src/App';

function Location() {
  const { pathname, search } = useLocation();
  return (
    <>
      <span data-testid="search">{search}</span>
      <span data-testid="pathname">{pathname}</span>
    </>
  );
}

function renderApp(entry = '/event/6050-1-001-01-first') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

const panel = () => screen.queryByRole('complementary', { name: /Päiväkirja|Journal/ });
const search = () => screen.getByTestId('search').textContent;
const pathname = () => screen.getByTestId('pathname').textContent;

describe('journal button and panel (B-21)', () => {
  it('FR-6 the panel is closed to start with, and the button has its text from ui.json', () => {
    renderApp();
    expect(panel()).toBeNull();
    expect(screen.getByRole('button', { name: 'Päiväkirja' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('FR-6 the button opens the index and puts journal=index in the address', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Päiväkirja' }));
    expect(search()).toBe('?journal=index');
    expect(pathname()).toBe('/event/6050-1-001-01-first');
    expect(panel()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Päiväkirja' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('FR-6 the index groups the entries under the type headings, in the order of the types', () => {
    renderApp('/event/6050-1-001-01-first?journal=index');
    const headings = within(panel()!).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Pelaajahahmot', 'Henkilöt', 'Esineet', 'Paikat', 'Muistiinpanot']);
    const links = within(panel()!).getAllByRole('link').map((a) => a.textContent);
    expect(links).toEqual(['Sankari', 'Tiedustelija', 'Sormus', 'Molemmat paikat', 'Taustatarina']);
  });

  it('FR-9 the index follows the language, and the language switch keeps the panel open', () => {
    renderApp('/event/6050-1-001-01-first?journal=index');
    fireEvent.click(screen.getByRole('button', { name: 'EN', pressed: false }));
    expect(search()).toBe('?journal=index&lang=en');
    const headings = within(panel()!).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toBe('Player characters');
    // An entry with no English name falls back to the Finnish one.
    expect(within(panel()!).getAllByRole('link').map((a) => a.textContent)).toContain('Tiedustelija');
    expect(within(panel()!).getAllByRole('link').map((a) => a.textContent)).toContain('Ring');
  });

  it('FR-6 an entry in the index opens that entry, keeping the event', () => {
    renderApp('/event/6050-1-001-01-first?journal=index');
    fireEvent.click(within(panel()!).getByRole('link', { name: 'Sankari' }));
    expect(search()).toBe('?journal=hero');
    expect(pathname()).toBe('/event/6050-1-001-01-first');
    expect(within(panel()!).getByRole('heading', { level: 3, name: 'Sankari' })).toBeInTheDocument();
  });

  it('FR-6 an entry named in the address opens directly, and an unknown one is ignored with the address left alone', () => {
    const { unmount } = renderApp('/event/6050-1-001-01-first?journal=hero');
    expect(panel()).not.toBeNull();
    unmount();
    renderApp('/event/6050-1-001-01-first?journal=nowhere');
    expect(panel()).toBeNull();
    expect(search()).toBe('?journal=nowhere');
    expect(screen.getByRole('heading', { level: 2, name: 'Ensimmäinen' })).toBeInTheDocument();
  });

  it('FR-6 the close button and Escape close the panel with an address that has no journal, and keep the event', () => {
    renderApp('/event/6050-1-001-01-first?journal=index&lang=en');
    fireEvent.click(screen.getByRole('button', { name: 'Close the journal' }));
    expect(panel()).toBeNull();
    expect(search()).toBe('?lang=en');
    expect(pathname()).toBe('/event/6050-1-001-01-first');

    fireEvent.click(screen.getByRole('button', { name: 'Journal' }));
    expect(panel()).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(panel()).toBeNull();
    expect(search()).toBe('?lang=en');
  });

  it('FR-6 Escape does nothing when the panel is closed', () => {
    renderApp();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(search()).toBe('');
  });

  it('FR-6 stepping closes the panel and drops the map choice, and keeps the language', () => {
    renderApp('/event/6050-1-001-01-first?journal=index&lang=en&map=second-map');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(panel()).toBeNull();
    expect(pathname()).toBe('/event/6050-1-001-02-second');
    expect(search()).toBe('?lang=en');
  });

  it('FR-6 the arrow keys do not step while focus is in the panel', () => {
    renderApp('/event/6050-1-001-01-first?journal=index');
    fireEvent.keyDown(panel()!, { key: 'ArrowRight' });
    expect(pathname()).toBe('/event/6050-1-001-01-first');
    expect(panel()).not.toBeNull();
  });

  it('FR-6 opening and closing the panel leave the map as it is: the same Leaflet map stays', () => {
    const { container } = renderApp();
    const map = container.querySelector('.leaflet-container');
    const image = container.querySelector('img.leaflet-image-layer');
    fireEvent.click(screen.getByRole('button', { name: 'Päiväkirja' }));
    expect(container.querySelector('.leaflet-container')).toBe(map);
    fireEvent.click(screen.getByRole('button', { name: 'Sulje päiväkirja' }));
    expect(container.querySelector('.leaflet-container')).toBe(map);
    expect(container.querySelector('img.leaflet-image-layer')).toBe(image);
  });

  it('FR-6 focus moves into the panel when it opens, and back to the button when it closes', () => {
    renderApp();
    const button = screen.getByRole('button', { name: 'Päiväkirja' });
    button.focus();
    fireEvent.click(button);
    expect(panel()).toHaveFocus();
    // Closing with Escape leaves focus on the page, so it goes back to the button.
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(button).toHaveFocus();
  });

  it('FR-6 focus is not taken from what the user chose when the panel closes by stepping', () => {
    renderApp();
    const open = screen.getByRole('button', { name: 'Päiväkirja' });
    open.focus();
    fireEvent.click(open);
    const next = screen.getByRole('button', { name: 'Seuraava' });
    next.focus();
    fireEvent.click(next);
    expect(next).toHaveFocus();
  });

  it('FR-6 an unknown event with a journal parameter goes to the first event, keeps the panel, and shows the notice once', () => {
    renderApp('/event/nowhere?journal=index');
    expect(pathname()).toBe('/event/6050-1-001-01-first');
    expect(search()).toBe('?journal=index');
    expect(panel()).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Tapahtumaa ei löytynyt');
    fireEvent.click(screen.getByRole('button', { name: 'Sulje' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(search()).toBe('?journal=index');
    expect(panel()).not.toBeNull();
  });
});
