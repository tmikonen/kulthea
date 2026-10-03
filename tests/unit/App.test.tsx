import { render, screen, within } from '@testing-library/react';
import { App } from '../../src/App';

describe('App', () => {
  it('shows the campaign title from the content bundle', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Testikampanja' })).toBeInTheDocument();
  });

  it('FR-1 lists the maps with their pixel sizes from the content bundle', () => {
    render(<App />);
    const items = within(screen.getByRole('list', { name: 'Maps' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Pääkartta (200 x 100)',
      'Second Map (120 x 80)',
    ]);
  });
});
