import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../../src/App';

vi.mock('virtual:content', async (importOriginal) => {
  const original = await importOriginal<{ default: object }>();
  return { default: { ...original.default, events: [] } };
});

describe('a campaign with no events (B-11)', () => {
  it('FR-2 shows the header and the map, and no event panel, and does not redirect', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Testikampanja' })).toBeInTheDocument();
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(screen.queryByRole('region', { name: 'Tapahtuma' })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('FR-2 an unknown event address also shows the map and no panel', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/event/nowhere']}>
        <App />
      </MemoryRouter>,
    );
    expect(container.querySelector('.leaflet-container')).not.toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
