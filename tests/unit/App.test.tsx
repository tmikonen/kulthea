import { render, screen } from '@testing-library/react';
import { App } from '../../src/App';

describe('App', () => {
  it('shows the campaign title from the content bundle', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Testikampanja' })).toBeInTheDocument();
  });

  it('FR-1 shows the main map as a Leaflet map with its image', () => {
    const { container } = render(<App />);
    const region = screen.getByRole('region', { name: 'Pääkartta' });
    expect(region.querySelector('.leaflet-container')).not.toBeNull();
    const image = container.querySelector<HTMLImageElement>('img.leaflet-image-layer');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('src')).toMatch(/main-map/);
  });

  it('FR-1 offers zoom buttons', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.leaflet-control-zoom-in')).not.toBeNull();
    expect(container.querySelector('.leaflet-control-zoom-out')).not.toBeNull();
  });
});
