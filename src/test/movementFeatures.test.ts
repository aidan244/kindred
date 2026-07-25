import { describe, expect, it } from 'vitest';
import {
  activeFractionByHour,
  allQuietIntervals,
  longestQuietInterval,
} from '../lib/movement/features';
import type { MovementBin } from '../lib/movement/types';

const T0 = new Date('2024-01-01T10:00:00');
const FIVE_MIN_MS = 5 * 60 * 1000;

function bin(index: number, activeWindows: number, coveredWindows: number): MovementBin {
  return { t: new Date(T0.getTime() + index * FIVE_MIN_MS), activeWindows, coveredWindows };
}

describe('allQuietIntervals / longestQuietInterval', () => {
  it('a covered:0 bin does not extend a quiet run’s duration', () => {
    // 3 quiet-covered bins with one uncovered bin in the middle: the run
    // still spans indices 0-3, but only counts 15 minutes (3 bins), not 20
    // (4 bins) — the uncovered slot contributes nothing.
    const bins = [
      bin(0, 0, 75), // quiet
      bin(1, 0, 75), // quiet
      bin(2, 0, 0), // uncovered
      bin(3, 0, 75), // quiet
    ];

    const intervals = allQuietIntervals(bins);

    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({ startIndex: 0, endIndex: 3, durationMinutes: 15 });
  });

  it('a covered:0 bin does not break a quiet run, unlike a genuinely active bin', () => {
    const withUncoveredGap = [bin(0, 0, 75), bin(1, 0, 75), bin(2, 0, 0), bin(3, 0, 75)];
    const withActiveBreak = [bin(0, 0, 75), bin(1, 0, 75), bin(2, 5, 75), bin(3, 0, 75)];

    expect(allQuietIntervals(withUncoveredGap)).toHaveLength(1);

    const brokenIntervals = allQuietIntervals(withActiveBreak);
    expect(brokenIntervals).toHaveLength(2);
    expect(brokenIntervals[0].durationMinutes).toBe(10); // bins 0-1 only
    expect(brokenIntervals[1].durationMinutes).toBe(5); // bin 3 only
  });

  it('never treats an uncovered bin as contributing to the run either', () => {
    const bins = [bin(0, 0, 0), bin(1, 0, 0), bin(2, 0, 0)]; // entirely uncovered
    expect(allQuietIntervals(bins)).toHaveLength(0);
    expect(longestQuietInterval(bins)).toBeNull();
  });

  it('picks the longest of several runs, bridging uncovered gaps within each', () => {
    const bins = [
      bin(0, 0, 75), // quiet run A: 2 bins = 10 min
      bin(1, 0, 75),
      bin(2, 5, 75), // active break
      bin(3, 0, 75), // quiet run B: bins 3,4(uncovered-skip),5,6 = 3 covered bins = 15 min
      bin(4, 0, 0),
      bin(5, 0, 75),
      bin(6, 0, 75),
    ];

    const longest = longestQuietInterval(bins);
    expect(longest).toMatchObject({ startIndex: 3, endIndex: 6, durationMinutes: 15 });
  });

  it('returns null when there is no quiet-covered run at all', () => {
    const bins = [bin(0, 10, 75), bin(1, 5, 75)];
    expect(longestQuietInterval(bins)).toBeNull();
  });
});

describe('activeFractionByHour', () => {
  it('returns 24 hours, computing active/covered only from covered windows', () => {
    const bins = [bin(0, 10, 75), bin(1, 20, 75)]; // both in hour 10 (T0 = 10:00)
    const result = activeFractionByHour(bins);

    expect(result).toHaveLength(24);
    const hour10 = result.find((entry) => entry.hour === 10);
    expect(hour10?.activeFraction).toBeCloseTo(30 / 150, 5);
    expect(hour10?.coverageFraction).toBeCloseTo(150 / (2 * 75), 5);
  });

  it('reports zero for an hour with no bins at all, rather than throwing', () => {
    const result = activeFractionByHour([]);
    expect(result).toHaveLength(24);
    expect(result.every((entry) => entry.activeFraction === 0 && entry.coverageFraction === 0)).toBe(
      true
    );
  });
});
