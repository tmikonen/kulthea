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

function renderApp(entry = '/') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <App />
      <Location />
    </MemoryRouter>,
  );
}

describe('App', () => {
  it('shows the campaign title from the content bundle', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: 'Testikampanja' })).toBeInTheDocument();
  });

  it('FR-1 shows the main map as a Leaflet map with its image', () => {
    const { container } = renderApp();
    const region = screen.getByRole('region', { name: 'Pääkartta' });
    expect(region.querySelector('.leaflet-container')).not.toBeNull();
    const image = container.querySelector<HTMLImageElement>('img.leaflet-image-layer');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('src')).toMatch(/main-map/);
  });

  it('FR-1 offers zoom buttons', () => {
    const { container } = renderApp();
    expect(container.querySelector('.leaflet-control-zoom-in')).not.toBeNull();
    expect(container.querySelector('.leaflet-control-zoom-out')).not.toBeNull();
  });
});

describe('map switcher (B-5)', () => {
  it('FR-1 lists all maps under the label from ui.json and marks the main map', () => {
    renderApp();
    const group = screen.getByRole('group', { name: 'Kartta' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pääkartta' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Second Map' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('FR-1 choosing a map shows it and puts it in the map parameter', () => {
    const { container } = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?map=second-map');
    expect(screen.getByRole('region', { name: 'Second Map' })).toBeInTheDocument();
    expect(container.querySelector('img.leaflet-image-layer')!.getAttribute('src')).toMatch(/second-map/);
    expect(screen.getByRole('button', { name: 'Second Map' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('FR-1 the map parameter selects the map, and an unknown one means the main map', () => {
    const { unmount } = renderApp('/?map=second-map');
    expect(screen.getByRole('region', { name: 'Second Map' })).toBeInTheDocument();
    unmount();
    renderApp('/?map=nowhere');
    expect(screen.getByRole('region', { name: 'Pääkartta' })).toBeInTheDocument();
  });

  it('FR-1 keeps other URL parameters when switching maps', () => {
    renderApp('/?lang=en');
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?lang=en&map=second-map');
  });
});

describe('language switch (B-6)', () => {
  it('FR-9 opens in the default language, with FI marked', () => {
    renderApp();
    expect(screen.getByRole('group', { name: 'Kieli' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'FI' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.lang).toBe('fi');
  });

  it('FR-9 the switch changes texts, names and the lang attribute, and keeps the map', () => {
    renderApp('/?map=second-map');
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?map=second-map&lang=en');
    expect(screen.getByRole('heading', { level: 1, name: 'Test Campaign' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Main Map' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Second Map' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('FR-9 the lang parameter opens the page in English, and an unknown one in Finnish', () => {
    const { unmount } = renderApp('/?lang=en');
    expect(screen.getByRole('heading', { level: 1, name: 'Test Campaign' })).toBeInTheDocument();
    unmount();
    renderApp('/?lang=xx');
    expect(screen.getByRole('heading', { level: 1, name: 'Testikampanja' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fi');
  });

  it('FR-9 choosing a map keeps the language', () => {
    renderApp('/?lang=en');
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(screen.getByTestId('search')).toHaveTextContent('?lang=en&map=second-map');
    expect(screen.getByRole('heading', { level: 1, name: 'Test Campaign' })).toBeInTheDocument();
  });
});

describe('visited places (B-14)', () => {
  const dots = (container: HTMLElement) => container.querySelectorAll('path.visited-dot');

  it('FR-1 the first event has only the current marker, and no place the story has not reached is shown', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    expect(dots(container)).toHaveLength(0);
    expect(container.querySelectorAll('path.current-marker')).toHaveLength(1);
    expect(container.querySelectorAll('path.leaflet-interactive')).toHaveLength(1);
  });

  it('FR-1 each step adds the places of the earlier events as dots, and stepping back takes them away', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    const counts = [];
    for (let i = 0; i < 6; i++) {
      counts.push(dots(container).length);
      fireEvent.click(screen.getByRole('button', { name: 'Seuraava' }));
    }
    counts.push(dots(container).length);
    // first, second, ninth (the first place again), on-second-map, split, standalone, jump. On the second map the
    // second event's location, both-places, also has a position there, so it is a dot too (B-34).
    expect(counts).toEqual([0, 1, 1, 1, 2, 1, 2]);
    fireEvent.click(screen.getByRole('button', { name: 'Edellinen' }));
    expect(dots(container)).toHaveLength(1);
  });

  it('FR-1 the dots are the same however the event was reached', () => {
    const direct = renderApp('/event/6050-1-10-01-on-second-map');
    const directCount = dots(direct.container).length;
    direct.unmount();
    const stepped = renderApp('/event/6050-1-001-01-first');
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Seuraava' }));
    expect(dots(stepped.container)).toHaveLength(directCount);
  });

  it('FR-1 a manual map switch shows the dots of the earlier events that were on that map', () => {
    const { container } = renderApp('/event/6050-2-003-01-split'); // on the second map, after on-second-map
    // The earlier places on the second map: both-places (the second event, by its location) and second-only.
    expect(dots(container)).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Pääkartta' }));
    // The earlier events on the main map were at two places, (80, 20) and (25, 75). The split event is also
    // placed at (80, 20) on the main map, which is its current marker, so only (25, 75) is a dot.
    expect(dots(container)).toHaveLength(1);
    expect(container.querySelectorAll('path.current-marker')).toHaveLength(1);
  });

  it('FR-1 the markers of all locations are gone', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    expect(container.querySelectorAll('path.location-marker')).toHaveLength(0);
  });
});

const FIRST = '/event/6050-1-001-01-first';

describe('event view and routing (B-11)', () => {
  const path = () => screen.getByTestId('pathname').textContent;

  it('FR-2 an address with no event goes to the first event, keeping map and language', () => {
    renderApp('/?map=second-map&lang=en');
    expect(path()).toBe(FIRST);
    expect(screen.getByTestId('search')).toHaveTextContent('?map=second-map&lang=en');
  });

  it('FR-2 any other unknown path also goes to the first event', () => {
    renderApp('/journal/nowhere');
    expect(path()).toBe(FIRST);
  });

  it('FR-3 the panel shows the title and the location name of the event in the address', () => {
    renderApp('/event/6050-1-001-02-second');
    expect(path()).toBe('/event/6050-1-001-02-second');
    const panel = screen.getByRole('region', { name: 'Tapahtuma' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Toinen' })).toBeInTheDocument();
    expect(within(panel).getByText('Molemmat paikat')).toBeInTheDocument();
  });

  it('FR-9 the panel follows the language, with the default language where there is no translation', () => {
    renderApp(`${FIRST}?lang=en`);
    const panel = screen.getByRole('region', { name: 'Event' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'First' })).toBeInTheDocument();
    expect(within(panel).getByText('Main Only')).toBeInTheDocument();
  });

  it('FR-3 an event that is n/a on the main map shows the location it has on the other map', () => {
    renderApp('/event/6050-1-10-01-on-second-map');
    const panel = screen.getByRole('region', { name: 'Tapahtuma' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Toisella kartalla' })).toBeInTheDocument();
    expect(within(panel).getByText('Vain toinen')).toBeInTheDocument();
  });

  it('FR-3 an event at a one-off position shows no location line', () => {
    renderApp('/event/6050-3-001-01-jump');
    const panel = screen.getByRole('region', { name: 'Tapahtuma' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Hyppy' })).toBeInTheDocument();
    expect(within(panel).getByText('K.A. 6050, Kesän 1. päivä')).toBeInTheDocument();
    expect(panel.querySelector('.location')).toBeNull();
  });

  it('FR-2 an unknown event shows the first event with a notice, and the address names the first event', () => {
    renderApp('/event/nowhere?lang=en&map=second-map');
    expect(path()).toBe(FIRST);
    expect(screen.getByTestId('search')).toHaveTextContent('?lang=en&map=second-map');
    expect(screen.getByRole('heading', { level: 2, name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('That event was not found, so the first event is shown.');
  });

  it('FR-2 the notice can be dismissed, and the event stays', () => {
    renderApp('/event/nowhere');
    expect(screen.getByRole('status')).toHaveTextContent('Tapahtumaa ei löytynyt');
    fireEvent.click(screen.getByRole('button', { name: 'Sulje' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(path()).toBe(FIRST);
    expect(screen.getByRole('heading', { level: 2, name: 'Ensimmäinen' })).toBeInTheDocument();
  });

  it('FR-2 a known event, or a redirect from no event, shows no notice', () => {
    const { unmount } = renderApp('/event/6050-1-001-02-second');
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    renderApp('/');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('FR-1 switching the map or the language keeps the event', () => {
    renderApp('/event/6050-1-001-02-second');
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(path()).toBe('/event/6050-1-001-02-second');
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(path()).toBe('/event/6050-1-001-02-second');
    expect(screen.getByRole('heading', { level: 2, name: 'Toinen' })).toBeInTheDocument();
    expect(screen.getByTestId('search')).toHaveTextContent('?map=second-map&lang=en');
  });

  it('FR-2 the temporary event list is gone', () => {
    renderApp();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('stepping (B-12)', () => {
  const path = () => screen.getByTestId('pathname').textContent;
  const IDS = [
    '6050-1-001-01-first', '6050-1-001-02-second', '6050-1-9-01-ninth', '6050-1-10-01-on-second-map',
    '6050-2-003-01-split', '6050-2-070-01-standalone', '6050-3-001-01-jump',
  ];

  it('FR-2 Next and Previous step through all the events in date order', () => {
    renderApp();
    const visited = [path()];
    for (let i = 1; i < IDS.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Seuraava' }));
      visited.push(path());
    }
    expect(visited).toEqual(IDS.map((id) => `/event/${id}`));
    for (let i = IDS.length - 2; i >= 0; i--) {
      fireEvent.click(screen.getByRole('button', { name: 'Edellinen' }));
      expect(path()).toBe(`/event/${IDS[i]}`);
    }
  });

  it('FR-2 Previous is disabled at the first event, and Next at the last', () => {
    const { unmount } = renderApp();
    expect(screen.getByRole('button', { name: 'Edellinen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Seuraava' })).toBeEnabled();
    unmount();
    renderApp(`/event/${IDS[IDS.length - 1]}`);
    expect(screen.getByRole('button', { name: 'Edellinen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Seuraava' })).toBeDisabled();
  });

  it('FR-2 the panel changes with the step', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Toinen' })).toBeInTheDocument();
  });

  it('FR-1 stepping drops a manual map choice and keeps the language', () => {
    renderApp(`/event/${IDS[0]}?map=second-map&lang=en`);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(path()).toBe(`/event/${IDS[1]}`);
    expect(screen.getByTestId('search')).toHaveTextContent(/^\?lang=en$/);
    expect(screen.getByRole('button', { name: 'Main Map' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('FR-2 stepping with no other parameter leaves an address with no query', () => {
    renderApp(`/event/${IDS[0]}?map=second-map`);
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' }));
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
  });

  it('FR-2 the button texts follow the language', () => {
    renderApp(`/event/${IDS[1]}?lang=en`);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });

  it('FR-2 the right and left arrow keys step while focus is in the panel', () => {
    renderApp(`/event/${IDS[1]}`);
    const next = screen.getByRole('button', { name: 'Seuraava' });
    fireEvent.keyDown(next, { key: 'ArrowRight' });
    expect(path()).toBe(`/event/${IDS[2]}`);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Edellinen' }), { key: 'ArrowLeft' });
    expect(path()).toBe(`/event/${IDS[1]}`);
  });

  it('FR-2 an arrow key at an end does nothing', () => {
    renderApp();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Seuraava' }), { key: 'ArrowLeft' });
    expect(path()).toBe(`/event/${IDS[0]}`);
  });

  it('FR-2 other keys and modified arrows do not step', () => {
    renderApp(`/event/${IDS[1]}`);
    const next = screen.getByRole('button', { name: 'Seuraava' });
    fireEvent.keyDown(next, { key: 'ArrowUp' });
    fireEvent.keyDown(next, { key: 'ArrowLeft', altKey: true });
    fireEvent.keyDown(next, { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(next, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(next, { key: 'ArrowRight', metaKey: true });
    expect(path()).toBe(`/event/${IDS[1]}`);
  });

  it('FR-1 the arrow keys on the map do not step, so they can pan the map', () => {
    const { container } = renderApp(`/event/${IDS[1]}`);
    fireEvent.keyDown(container.querySelector('.leaflet-container')!, { key: 'ArrowRight' });
    expect(path()).toBe(`/event/${IDS[1]}`);
  });
});

describe('dates in the panel (B-9)', () => {
  const panel = (name: string) => screen.getByRole('region', { name });

  it('FR-7 shows the date in full, in the default language', () => {
    renderApp();
    expect(within(panel('Tapahtuma')).getByText('K.A. 6050, Talven 1. päivä')).toBeInTheDocument();
  });

  it('FR-7 shows the date in English with the right ending', () => {
    renderApp('/event/6050-2-003-01-split?lang=en');
    expect(within(panel('Event')).getByText('TE 6050, 3rd of Spring')).toBeInTheDocument();
  });

  it('FR-7 the date changes with the language switch, and with stepping', () => {
    renderApp('/event/6050-2-070-01-standalone');
    expect(within(panel('Tapahtuma')).getByText('K.A. 6050, Kevään 70. päivä')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(within(panel('Event')).getByText('TE 6050, 70th of Spring')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(within(panel('Event')).getByText('TE 6050, 1st of Summer')).toBeInTheDocument();
  });
});

describe('event text (B-10)', () => {
  const panel = (name: string) => screen.getByRole('region', { name });

  it('FR-3 shows the text of the event, with its Markdown rendered', () => {
    renderApp('/event/6050-1-001-02-second');
    const text = panel('Tapahtuma');
    expect(within(text).getByText('korostettu').tagName).toBe('EM');
    expect(within(text).getByText('Toinen kappale.')).toBeInTheDocument();
    expect(within(text).queryByText('Ei saatavilla tällä kielellä')).toBeNull();
  });

  it('FR-9 shows the text in the chosen language, and switches with the language', () => {
    renderApp('/event/6050-1-001-01-first');
    expect(within(panel('Tapahtuma')).getByText('Ensimmäisen tapahtuman teksti.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(within(panel('Event')).getByText('The text of the first event.')).toBeInTheDocument();
    expect(within(panel('Event')).queryByText('Ensimmäisen tapahtuman teksti.')).toBeNull();
    expect(within(panel('Event')).queryByText('Not available in this language')).toBeNull();
  });

  it('FR-9 an event with no English text shows the Finnish text and a note when English is chosen', () => {
    renderApp('/event/6050-1-001-02-second?lang=en');
    const text = panel('Event');
    expect(within(text).getByText('Not available in this language')).toBeInTheDocument();
    expect(within(text).getByText('Toinen kappale.')).toBeInTheDocument();
  });

  it('FR-9 the note goes away when stepping to an event that has an English text', () => {
    renderApp('/event/6050-1-001-02-second?lang=en');
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(within(panel('Event')).queryByText('Not available in this language')).toBeNull();
    expect(within(panel('Event')).getByText('The text of the first event.')).toBeInTheDocument();
  });

  it('FR-9 in the default language the note is never shown', () => {
    renderApp('/event/6050-1-9-01-ninth');
    expect(within(panel('Tapahtuma')).getByText('Yhdeksännen tapahtuman teksti.')).toBeInTheDocument();
    expect(within(panel('Tapahtuma')).queryByText('Ei saatavilla tällä kielellä')).toBeNull();
  });
});

describe('the displayed map follows the event (B-15)', () => {
  const path = () => screen.getByTestId('pathname').textContent;
  const shown = (container: HTMLElement) => container.querySelector('img.leaflet-image-layer')!.getAttribute('src');
  const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

  it('FR-1 stepping to an event shown on the second map switches to it, and stepping on switches back', () => {
    const { container } = renderApp('/event/6050-1-9-01-ninth');
    expect(shown(container)).toMatch(/main-map/);
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' })); // on-second-map
    expect(shown(container)).toMatch(/second-map/);
    expect(pressed('Second Map')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' })); // split, shown on the second map
    expect(shown(container)).toMatch(/second-map/);
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' })); // standalone, main map
    expect(shown(container)).toMatch(/main-map/);
    expect(pressed('Pääkartta')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Edellinen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edellinen' }));
    expect(path()).toBe('/event/6050-1-10-01-on-second-map');
    expect(shown(container)).toMatch(/second-map/);
  });

  it('FR-1 a link to an event shown on the second map opens that map', () => {
    const { container } = renderApp('/event/6050-1-10-01-on-second-map');
    expect(shown(container)).toMatch(/second-map/);
    expect(screen.getByRole('region', { name: 'Second Map' })).toBeInTheDocument();
  });

  it('FR-1 a map in the address wins over the event\'s own map, and an unknown one is ignored', () => {
    const { container, unmount } = renderApp('/event/6050-1-10-01-on-second-map?map=main-map');
    expect(shown(container)).toMatch(/main-map/);
    unmount();
    const unknown = renderApp('/event/6050-1-10-01-on-second-map?map=nowhere');
    expect(shown(unknown.container)).toMatch(/second-map/);
  });

  it('FR-1 a manual choice keeps the event, and the next step shows the next event on its own map', () => {
    const { container } = renderApp('/event/6050-1-001-02-second');
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(shown(container)).toMatch(/second-map/);
    expect(path()).toBe('/event/6050-1-001-02-second');
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' })); // ninth: main map
    expect(shown(container)).toMatch(/main-map/);
    // A manual choice of the main map on a second-map event lasts until the next step as well.
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' })); // on-second-map
    fireEvent.click(screen.getByRole('button', { name: 'Pääkartta' }));
    expect(shown(container)).toMatch(/main-map/);
    expect(path()).toBe('/event/6050-1-10-01-on-second-map');
    fireEvent.click(screen.getByRole('button', { name: 'Seuraava' })); // split: second map again
    expect(shown(container)).toMatch(/second-map/);
  });

  it('FR-1 the switcher marks the displayed map even when it is the event\'s own and not chosen', () => {
    renderApp('/event/6050-2-003-01-split');
    expect(pressed('Second Map')).toBe('true');
    expect(pressed('Pääkartta')).toBe('false');
  });
});

describe('the current event marker (B-13)', () => {
  const current = (container: HTMLElement) => container.querySelectorAll('path.current-marker');

  it('FR-1 shows one current marker for an event that has a place on the displayed map', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    expect(current(container)).toHaveLength(1);
  });

  it('FR-8 a standalone event has a marker too', () => {
    const { container } = renderApp('/event/6050-2-070-01-standalone');
    expect(current(container)).toHaveLength(1);
  });

  it('FR-3 an event shown on the second map has its marker there', () => {
    const { container } = renderApp('/event/6050-1-10-01-on-second-map');
    expect(current(container)).toHaveLength(1);
  });

  it('FR-1 stepping keeps exactly one current marker', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Seuraava' }));
      expect(current(container)).toHaveLength(1);
    }
  });

  it('FR-1 a map where the event\'s location has no position has no current marker', () => {
    // The location of the first event, main-only, has a position only on the main map.
    const { container } = renderApp('/event/6050-1-001-01-first');
    expect(current(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(current(container)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Pääkartta' }));
    expect(current(container)).toHaveLength(1);
  });

  it('FR-1 a map where the event\'s location has a position has a current marker there, though the event is not shown on it (B-34)', () => {
    // both-places has a position on the second map, so the second event has a marker there when it is viewed.
    const { container } = renderApp('/event/6050-1-001-02-second');
    expect(current(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(current(container)).toHaveLength(1);
    expect(screen.getByRole('region', { name: 'Tapahtuma' }).querySelector('h2')).toHaveTextContent('Toinen');
  });

  it('FR-1 an event that is n/a on the main map has no marker there, whatever its showOn location', () => {
    const { container } = renderApp('/event/6050-1-10-01-on-second-map?map=main-map');
    expect(current(container)).toHaveLength(0);
  });

  it('FR-1 a one-off position has a marker only on its own map', () => {
    const { container } = renderApp('/event/6050-3-001-01-jump');
    expect(current(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Second Map' }));
    expect(current(container)).toHaveLength(0);
  });

  it('FR-3 an event with no place on the main map has no marker there', () => {
    const { container } = renderApp('/event/6050-1-10-01-on-second-map?map=main-map');
    expect(current(container)).toHaveLength(0);
  });

  it('FR-9 changing the language keeps the marker', () => {
    const { container } = renderApp('/event/6050-1-001-01-first');
    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(current(container)).toHaveLength(1);
  });
});
