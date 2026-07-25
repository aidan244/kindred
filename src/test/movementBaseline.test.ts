import { describe, expect, it } from 'vitest';
import { computeBaseline, WINDOWS_PER_DAY } from '../lib/movement/baseline';
import type { MovementBin } from '../lib/movement/types';

const NOW = new Date('2024-01-15T12:00:00');
const BINS_PER_DAY = WINDOWS_PER_DAY / 75;
const FIVE_MIN_MS = 5 * 60 * 1000;

/** Midnight of (NOW's day - daysAgo days) — always strictly before NOW
 * (which is noon), so a full day's worth of bins never gets truncated by
 * computeBaseline's `t < now` filter. */
function dayStart(daysAgo: number): Date {
  const date = new Date(NOW);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/** `coverageFraction` of a day covered by fully-covered 5-minute bins,
 * starting at midnight — the rest of the day simply has no bin rows,
 * which is realistically equivalent to zero coverage for that slice. */
function dayOfBins(daysAgo: number, coverageFraction: number): MovementBin[] {
  const start = dayStart(daysAgo);
  const binCount = Math.round(coverageFraction * BINS_PER_DAY);
  return Array.from({ length: binCount }, (_, i) => ({
    t: new Date(start.getTime() + i * FIVE_MIN_MS),
    activeWindows: 10,
    coveredWindows: 75,
  }));
}

describe('computeBaseline', () => {
  it('is insufficient with fewer than 5 well-covered days', () => {
    const bins = [1, 2, 3, 4].flatMap((daysAgo) => dayOfBins(daysAgo, 0.7));
    expect(computeBaseline(bins, NOW).sufficient).toBe(false);
  });

  it('is sufficient once 5 days each carry at least 60% coverage', () => {
    const bins = [1, 2, 3, 4, 5].flatMap((daysAgo) => dayOfBins(daysAgo, 0.7));
    expect(computeBaseline(bins, NOW).sufficient).toBe(true);
  });

  it('does not count a day below the 60% coverage threshold towards sufficiency', () => {
    const wellCovered = [1, 2, 3, 4].flatMap((daysAgo) => dayOfBins(daysAgo, 0.7));
    const underCovered = dayOfBins(5, 0.3);
    expect(computeBaseline([...wellCovered, ...underCovered], NOW).sufficient).toBe(false);
  });

  it('excludes bins outside the trailing 7-day window from daysUsed', () => {
    const withinWindow = [1, 2].flatMap((daysAgo) => dayOfBins(daysAgo, 0.7));
    const longAgo = dayOfBins(30, 0.7);
    const baseline = computeBaseline([...withinWindow, ...longAgo], NOW);
    expect(baseline.daysUsed).toBe(2);
  });

  it('returns 24 hourly entries derived only from covered data', () => {
    const bins = [1, 2, 3, 4, 5].flatMap((daysAgo) => dayOfBins(daysAgo, 0.7));
    const baseline = computeBaseline(bins, NOW);
    expect(baseline.byHour).toHaveLength(24);
  });
});
