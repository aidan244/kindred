import { describe, expect, it } from 'vitest';
import { computeKickBaseline } from '../lib/movement/kickBaseline';
import { KICK_BASELINE_MIN_DAYS, KICK_RECENT_DAYS } from '../lib/movement/constants';
import type { KickSample, KickWindow } from '../types';

const NOW = new Date('2026-01-15T12:00:00');
const DAY_MS = 24 * 60 * 60 * 1000;

/** Oldest-first daily samples, `settledIndex` on the standard "last bucket
 * is today, always partial" contract every real KickWindow follows
 * (src/sensors/MovementStream.ts's kickWindow() helper). */
function dailyWindow(counts: number[]): KickWindow {
  const samples: KickSample[] = counts.map((kicks, index) => ({
    timestamp: new Date(NOW.getTime() - (counts.length - 1 - index) * DAY_MS),
    kicks,
  }));
  return { samples, settledIndex: Math.max(0, samples.length - 2) };
}

describe('computeKickBaseline', () => {
  it('is insufficient with fewer than KICK_BASELINE_MIN_DAYS baseline days', () => {
    // KICK_RECENT_DAYS (3) recent + 13 baseline days = fewer than the 14 required.
    const window = dailyWindow(Array.from({ length: 13 + KICK_RECENT_DAYS + 1 }, () => 200));
    expect(computeKickBaseline(window, NOW).sufficient).toBe(false);
  });

  it('is sufficient once exactly KICK_BASELINE_MIN_DAYS baseline days exist', () => {
    const window = dailyWindow(Array.from({ length: KICK_BASELINE_MIN_DAYS + KICK_RECENT_DAYS + 1 }, () => 200));
    const baseline = computeKickBaseline(window, NOW);
    expect(baseline.sufficient).toBe(true);
    expect(baseline.daysUsed).toBe(KICK_BASELINE_MIN_DAYS);
  });

  it('excludes the recent window and the partial "today" bucket from the mean', () => {
    // 14 baseline days at 200, then 3 "recent" days at 20 (wildly different),
    // then today (partial, excluded either way) at 5. The mean must reflect
    // only the 14 baseline days.
    const window = dailyWindow([...Array(14).fill(200), 20, 20, 20, 5]);
    const baseline = computeKickBaseline(window, NOW);
    expect(baseline.daysUsed).toBe(14);
    expect(baseline.meanKicksPerDay).toBe(200);
  });

  it('is insufficient and zeroed on an empty (no-signal) window', () => {
    const window: KickWindow = { samples: [], settledIndex: -1 };
    expect(computeKickBaseline(window, NOW)).toEqual({
      computedAt: NOW,
      daysUsed: 0,
      sufficient: false,
      meanKicksPerDay: 0,
    });
  });
});
