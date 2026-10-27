/**
 * THE FIRED BANNER IS DELAYED, AND A PENDING ONE IS CANCELLABLE.
 *
 * "Fire push notification" (src/components/DemoPanel.tsx) schedules the banner
 * rather than showing it, so the person demoing can dismiss the panel and let
 * go of the phone before it lands. Two things about that are worth pinning:
 *
 *  1. The wait actually happens. An instant banner is the old behaviour and
 *     would pass any test that only asserted "the banner appears".
 *  2. "Reset state" cancels a banner that has been fired but not landed.
 *     Without that, the reset clears the alert state and the timer then walks
 *     it straight back in a few seconds later — on camera, mid-demo, with no
 *     control on screen having been touched.
 *
 * `cleanup()` is explicit because this project does not enable Vitest globals
 * (vite.config.ts sets only `environment`), so Testing Library's automatic
 * afterEach cleanup never registers and the first render's DOM would otherwise
 * still be mounted for the second test.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoPanel } from '../components/DemoPanel';
import { AppStateProvider } from '../context/AppStateContext';
import { PUSH_BANNER_BODY } from '../data/clinicalContent';

/** Mounts the panel and opens it the way the demo does — Ctrl+. */
function mountPanel(): void {
  render(
    <MemoryRouter initialEntries={['/home']}>
      <AppStateProvider>
        <DemoPanel />
      </AppStateProvider>
    </MemoryRouter>,
  );
  fireEvent.keyDown(window, { key: '.', ctrlKey: true });
}

describe('the fired push notification is delayed, not immediate', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows no banner until the wait has elapsed', async () => {
    mountPanel();
    fireEvent.click(await screen.findByText('Fire push notification'));

    expect(screen.queryByText(PUSH_BANNER_BODY), 'banner before the wait').toBeNull();
    act(() => void vi.advanceTimersByTime(4900));
    expect(screen.queryByText(PUSH_BANNER_BODY), 'banner at 4.9s').toBeNull();
    act(() => void vi.advanceTimersByTime(200));
    expect(screen.queryByText(PUSH_BANNER_BODY), 'banner at 5.1s').not.toBeNull();
  });

  it('cancels a banner that was fired but has not landed when state is reset', async () => {
    mountPanel();
    fireEvent.click(await screen.findByText('Fire push notification'));
    act(() => void vi.advanceTimersByTime(2000));

    fireEvent.keyDown(window, { key: '.', ctrlKey: true });
    fireEvent.click(await screen.findByText('Reset state'));

    act(() => void vi.advanceTimersByTime(10000));
    expect(screen.queryByText(PUSH_BANNER_BODY), 'banner after reset').toBeNull();
  });
});
