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

  it('FR-6 the journal button closes the panel when it is open, on the index and on an entry, keeping the event and language', () => {
    renderApp('/event/6050-1-001-01-first?journal=index&lang=en');
    fireEvent.click(screen.getByRole('button', { name: 'Journal' }));
    expect(panel()).toBeNull();
    expect(search()).toBe('?lang=en');
    fireEvent.click(screen.getByRole('button', { name: 'Journal' }));
    expect(search()).toBe('?lang=en&journal=index');
    fireEvent.click(within(panel()!).getByRole('link', { name: 'Hero' }));
    expect(search()).toBe('?lang=en&journal=hero');
    fireEvent.click(screen.getByRole('button', { name: 'Journal', expanded: true }));
    expect(panel()).toBeNull();
    expect(search()).toBe('?lang=en');
    expect(pathname()).toBe('/event/6050-1-001-01-first');
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

describe('journal entry view (B-22)', () => {
  const entryPanel = (container: HTMLElement) => container.querySelector('article')!;

  it('FR-6 a player character shows a link back, the picture, the name, the motto and the text, in this order', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?journal=hero');
    const article = entryPanel(container);
    const order = [...article.children].map((el) => el.tagName.toLowerCase() + (el.className ? '.' + el.className : ''));
    expect(order).toEqual(['a.back', 'img.image', 'h3.name', 'p.motto', 'div.text', 'section.events']);
    expect(article.querySelector('a.back')).toHaveTextContent('‹ Päiväkirja');
    const img = within(article).getByRole('img', { name: 'Sankari' });
    expect(img.getAttribute('src')).toMatch(/hero/);
    expect(img).toHaveAttribute('width', '60');
    expect(img).toHaveAttribute('height', '40');
    expect(within(article).getByRole('heading', { level: 3 })).toHaveTextContent('Sankari');
    expect(article.querySelector('.motto')).toHaveTextContent('Eteenpäin.');
    expect(article.querySelector('.text')).toHaveTextContent('Sankarin tausta.');
    expect(article.querySelectorAll('.text p')).toHaveLength(3);
  });

  it('FR-9 the entry follows the language: name, motto and text', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?journal=hero&lang=en');
    const article = entryPanel(container);
    expect(within(article).getByRole('heading', { level: 3 })).toHaveTextContent('Hero');
    expect(article.querySelector('.motto')).toHaveTextContent('Onward.');
    expect(article.querySelector('.text')).toHaveTextContent("The hero's background.");
    expect(article.querySelector('.note')).toBeNull();
    expect(within(article).getByRole('img', { name: 'Hero' })).toBeInTheDocument();
  });

  it('FR-9 an NPC has no motto and no picture when it has none, and in English falls back with the note', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?journal=scout&lang=en');
    const article = entryPanel(container);
    expect(article.querySelector('.motto')).toBeNull();
    expect(article.querySelector('img')).toBeNull();
    expect(within(article).getByRole('heading', { level: 3 })).toHaveTextContent('Tiedustelija');
    expect(article.querySelector('.text')).toHaveTextContent('Vain suomeksi kirjoitettu tausta.');
    expect(article.querySelector('.note')).toHaveTextContent('Not available in this language');
  });

  it('FR-9 in the default language there is never a note', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?journal=scout');
    expect(entryPanel(container).querySelector('.note')).toBeNull();
  });

  it('FR-6 an item and a note have a name and text but no motto, and an item may have no picture', () => {
    const item = renderApp('/event/6050-1-001-01-first?journal=ring');
    expect(entryPanel(item.container).querySelector('.motto')).toBeNull();
    expect(entryPanel(item.container).querySelector('img')).toBeNull();
    expect(within(entryPanel(item.container)).getByRole('heading', { level: 3 })).toHaveTextContent('Sormus');
    item.unmount();
    const note = renderApp('/event/6050-1-001-01-first?journal=lore');
    expect(within(entryPanel(note.container)).getByRole('heading', { level: 3 })).toHaveTextContent('Taustatarina');
    expect(entryPanel(note.container).querySelector('.text')).toHaveTextContent('Muistiinpanon teksti.');
  });

  it('FR-6 a location entry shows the location\'s name and its picture', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?journal=both-places&lang=en');
    const article = entryPanel(container);
    expect(within(article).getByRole('heading', { level: 3 })).toHaveTextContent('Both Places');
    expect(within(article).getByRole('img')).toBeInTheDocument();
    expect(article.querySelector('.text')).toHaveTextContent("The place's description.");
  });

  it('FR-6 the link back goes to the index, keeping the event and language', () => {
    renderApp('/event/6050-1-001-01-first?journal=hero&lang=en');
    fireEvent.click(screen.getByRole('link', { name: '‹ Journal' }));
    expect(search()).toBe('?journal=index&lang=en');
    expect(pathname()).toBe('/event/6050-1-001-01-first');
    expect(document.querySelector('article')).toBeNull();
  });

  it('FR-6 changing the language while an entry is open keeps the entry', () => {
    renderApp('/event/6050-1-001-01-first?journal=hero');
    fireEvent.click(screen.getByRole('button', { name: 'EN', pressed: false }));
    expect(search()).toBe('?journal=hero&lang=en');
    expect(screen.getByRole('heading', { level: 3, name: 'Hero' })).toBeInTheDocument();
  });
});

describe('journal links in text (B-23)', () => {
  const eventLinks = (container: HTMLElement) => [...container.querySelectorAll<HTMLAnchorElement>('section a.journal-link')];

  it('FR-6 the names in an event text are links with real addresses, with the text of the language', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    const links = eventLinks(container);
    expect(links.map((a) => a.textContent)).toEqual(['Sankari', 'sormus']);
    expect(links[0].getAttribute('href')).toBe('/event/6050-1-001-01-first?journal=hero');
    expect(links[1].getAttribute('href')).toBe('/event/6050-1-001-01-first?journal=ring');
  });

  it('FR-9 the link text follows the language, and the address keeps the language and the map', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?lang=en&map=second-map');
    const links = eventLinks(container);
    expect(links.map((a) => a.textContent)).toEqual(['Hero', 'a ring']);
    expect(links[0].getAttribute('href')).toBe('/event/6050-1-001-01-first?lang=en&map=second-map&journal=hero');
  });

  it('FR-6 following a link in an event opens the entry in the panel, over the same event', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?lang=en');
    fireEvent.click(eventLinks(container)[0]);
    expect(search()).toBe('?lang=en&journal=hero');
    expect(pathname()).toBe('/event/6050-1-001-01-first');
    expect(within(panel()!).getByRole('heading', { level: 3 })).toHaveTextContent('Hero');
  });

  it('FR-6 a link in an entry replaces the panel content, and the address names the new entry', () => {
    renderApp('/event/6050-1-001-01-first?journal=hero');
    const link = within(panel()!).getByRole('link', { name: 'Tiedustelija' });
    expect(link.getAttribute('href')).toBe('/event/6050-1-001-01-first?journal=scout');
    fireEvent.click(link);
    expect(search()).toBe('?journal=scout');
    expect(within(panel()!).getByRole('heading', { level: 3 })).toHaveTextContent('Tiedustelija');
    expect(within(panel()!).getAllByRole('article')).toHaveLength(1);
  });

  it('FR-6 a link to the entry that is open does nothing', () => {
    renderApp('/event/6050-1-001-01-first?journal=lore');
    fireEvent.click(within(panel()!).getByRole('link', { name: 'Tämä muistiinpano' }));
    expect(search()).toBe('?journal=lore');
    expect(within(panel()!).getByRole('heading', { level: 3 })).toHaveTextContent('Taustatarina');
  });

  it('FR-6 a click with Ctrl, Shift, Alt, Meta or another button is left to the browser', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    const link = eventLinks(container)[0];
    for (const modifier of [{ ctrlKey: true }, { shiftKey: true }, { altKey: true }, { metaKey: true }, { button: 1 }]) {
      fireEvent.click(link, modifier);
      expect(search()).toBe('');
      expect(panel()).toBeNull();
    }
  });

  it('FR-6 the addresses of the links follow the address: after stepping, they point at the new event', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' }));
    expect(eventLinks(container)[0].getAttribute('href')).toBe('/event/6050-1-001-02-second?journal=hero');
  });

  it('FR-6 a click on text that is not a link does nothing', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    fireEvent.click(container.querySelector('section p')!);
    expect(search()).toBe('');
  });
});

describe('events listed on entries (B-24)', () => {
  const list = (container: HTMLElement) => container.querySelector('article section.events')!;
  const items = (container: HTMLElement) => [...list(container).querySelectorAll('li')].map((li) => li.textContent);

  it('FR-6 an entry lists the events that link to it, in date order, each with its date', () => {
    const { container } = renderApp('/event/6050-1-001-01-first?journal=hero');
    expect(list(container).querySelector('h4')).toHaveTextContent('Tapahtumat');
    expect(items(container)).toEqual(['Ensimmäinen K.A. 6050, Talven 1. päivä', 'Toinen K.A. 6050, Talven 1. päivä']);
  });

  it('FR-9 the list follows the language: titles and dates, and the link keeps the language', () => {
    const { container } = renderApp('/event/6050-1-001-02-second?journal=hero&lang=en');
    expect(list(container).querySelector('h4')).toHaveTextContent('Events');
    expect(items(container)).toEqual(['First TE 6050, 1st of Winter', 'Toinen TE 6050, 1st of Winter']);
    expect(within(list(container) as HTMLElement).getByRole('link', { name: 'First' }).getAttribute('href'))
      .toBe('/event/6050-1-001-01-first?lang=en');
  });

  it('FR-6 selecting an event goes to it and closes the panel, keeping the language and dropping the map', () => {
    const { container } = renderApp('/event/6050-1-001-02-second?journal=hero&lang=en&map=second-map');
    fireEvent.click(within(list(container) as HTMLElement).getByRole('link', { name: 'First' }));
    expect(pathname()).toBe('/event/6050-1-001-01-first');
    expect(search()).toBe('?lang=en');
    expect(panel()).toBeNull();
  });

  it('FR-6 selecting an event in the default language leaves no parameters', () => {
    const { container } = renderApp('/event/6050-1-001-02-second?journal=scout');
    fireEvent.click(within(list(container) as HTMLElement).getByRole('link', { name: 'Toinen' }));
    expect(pathname()).toBe('/event/6050-1-001-02-second');
    expect(search()).toBe('');
  });

  it('FR-6 a location entry lists the events held at the place, and an entry no event links to has no list', () => {
    const place = renderApp('/event/6050-1-001-01-first?journal=both-places');
    expect(items(place.container)).toEqual(['Toinen K.A. 6050, Talven 1. päivä', 'Yksin K.A. 6050, Kevään 70. päivä']);
    place.unmount();
    const lore = renderApp('/event/6050-1-001-01-first?journal=lore');
    expect(lore.container.querySelector('section.events')).toBeNull();
  });

  it('FR-6 an NPC, an item and a note list their events too', () => {
    const npc = renderApp('/event/6050-1-001-01-first?journal=scout');
    expect(items(npc.container)).toEqual(['Toinen K.A. 6050, Talven 1. päivä']);
    npc.unmount();
    const item = renderApp('/event/6050-1-001-01-first?journal=ring&lang=en');
    expect(items(item.container)).toEqual(['First TE 6050, 1st of Winter']);
  });
});

describe('the location in an event as a link (B-24)', () => {
  const locationLine = (container: HTMLElement) => container.querySelector('section .location')!;

  it('FR-6 a location that has an entry is a link to it, and opens the panel without changing anything else', () => {
    const { container } = renderApp('/event/6050-1-001-02-second?lang=en');
    const link = within(locationLine(container) as HTMLElement).getByRole('link', { name: 'Both Places' });
    expect(link.getAttribute('href')).toBe('/event/6050-1-001-02-second?lang=en&journal=both-places');
    fireEvent.click(link);
    expect(pathname()).toBe('/event/6050-1-001-02-second');
    expect(search()).toBe('?lang=en&journal=both-places');
    expect(within(panel()!).getByRole('heading', { level: 3 })).toHaveTextContent('Both Places');
  });

  it('FR-6 a location with no entry is plain text, also when it is the showOn location', () => {
    const main = renderApp('/event/6050-1-001-01-first');
    expect(locationLine(main.container)).toHaveTextContent('Main Only');
    expect(locationLine(main.container).querySelector('a')).toBeNull();
    main.unmount();
    const other = renderApp('/event/6050-1-10-01-on-second-map');
    expect(locationLine(other.container)).toHaveTextContent('Vain toinen');
    expect(locationLine(other.container).querySelector('a')).toBeNull();
  });
});
