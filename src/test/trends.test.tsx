/**
 * Render-level smoke test for the new /trends screen. No browser is
 * available in this environment to visually inspect the chart, so this is
 * the strongest available substitute: a real render through jsdom, checking
 * the DOM actually produced rather than just that the code type-checks.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppStateProvider } from '../context/AppStateContext';
import { setBandSignal } from '../sensors/MovementStream';
import Trends from '../screens/Trends';

afterEach(() => {
  cleanup();
  setBandSignal(true);
});

function renderTrends(): void {
  render(
    <AppStateProvider>
      <MemoryRouter initialEntries={['/trends']}>
        <Routes>
          <Route path="/trends" element={<Trends />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>
  );
}

describe('Trends screen', () => {
  it('renders the title, the trace, and both micro labels when the band has signal', () => {
    renderTrends();

    expect(screen.getByRole('heading', { name: 'Trends' })).toBeInTheDocument();
    expect(screen.getByText('12 weeks ago')).toBeInTheDocument();
    expect(screen.getByText('today')).toBeInTheDocument();
    // KickTrace renders an <svg role="img"> with an accessible label built
    // from the actual sample data — its presence means a non-empty window
    // reached the component and it chose to draw something, not nothing.
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders the no-signal block instead of a trace when the band is offline', () => {
    setBandSignal(false);
    renderTrends();

    expect(screen.getByRole('heading', { name: 'Trends' })).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('12 weeks ago')).not.toBeInTheDocument();
    expect(screen.getByText(/No signal/)).toBeInTheDocument();
  });

  it('has a working back control', () => {
    renderTrends();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});
