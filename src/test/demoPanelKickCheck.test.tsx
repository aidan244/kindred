/**
 * Render-level check of DemoPanel's "Run RFM check" wiring — the strongest
 * available substitute for a browser click-through in this environment.
 * Confirms the button is actually connected to the real detector (via the
 * real getMovementStream() seed data), not just present in the markup.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { AppStateProvider } from '../context/AppStateContext';
import { DemoPanel } from '../components/DemoPanel';

afterEach(() => {
  cleanup();
});

function renderPanel(): void {
  render(
    <AppStateProvider>
      <MemoryRouter initialEntries={['/home']}>
        <DemoPanel />
      </MemoryRouter>
    </AppStateProvider>
  );
}

function openPanel(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Open demo control panel' }));
}

describe('DemoPanel — Run RFM check', () => {
  it('fires the push banner for the quiet variant', () => {
    renderPanel();
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Quiet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run RFM check' }));

    expect(screen.getByText("Worth checking on your baby's movements. Open when you're ready.")).toBeInTheDocument();
  });

  it('does not fire the push banner for the active variant', () => {
    renderPanel();
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Active' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run RFM check' }));

    expect(
      screen.queryByText("Worth checking on your baby's movements. Open when you're ready.")
    ).not.toBeInTheDocument();
  });

  it('the existing manual "Fire push notification" button is unaffected', () => {
    renderPanel();
    openPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Active' })); // the variant that never fires the detector
    fireEvent.click(screen.getByRole('button', { name: 'Fire push notification' }));

    expect(screen.getByText("Worth checking on your baby's movements. Open when you're ready.")).toBeInTheDocument();
  });
});
