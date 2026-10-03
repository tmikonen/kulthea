import { render, screen } from '@testing-library/react';
import { App } from '../../src/App';

describe('App', () => {
  it('shows the campaign heading', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Kulthea Campaign Chronicles' }),
    ).toBeInTheDocument();
  });
});
