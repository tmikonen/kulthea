import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from '../../src/App';

function Location() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
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
