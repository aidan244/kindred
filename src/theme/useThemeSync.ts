/**
 * Derives the day/night theme from the app clock (src/context/AppStateContext.tsx
 * `now()`) and reflects it as data-theme="day" | "night" on <html>. This is
 * the same clock that (later) drives clinic open/closed logic, so the demo
 * panel's clock override visibly drives both at once.
 *
 * Day is roughly 07:00-20:00; night is everything else (and the default).
 */

import { useEffect } from 'react';
import { useAppState } from '../context/AppStateContext';

const CHECK_INTERVAL_MS = 15_000;
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;

export type Theme = 'day' | 'night';

export function isDaytime(date: Date): boolean {
  const hour = date.getHours();
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

export function themeFor(date: Date): Theme {
  return isDaytime(date) ? 'day' : 'night';
}

export function useThemeSync(): void {
  const { now, clockOverride } = useAppState();

  useEffect(() => {
    const apply = (): void => {
      document.documentElement.setAttribute('data-theme', themeFor(now()));
    };

    apply();

    // With a frozen demo clock there's nothing new to pick up on an
    // interval; only poll when tracking real time.
    if (clockOverride) {
      return;
    }
    const intervalId = window.setInterval(apply, CHECK_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [now, clockOverride]);
}
