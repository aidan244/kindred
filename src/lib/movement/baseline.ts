/**
 * Rolling 7-day, per-hour-of-day baseline, covered bins only.
 *
 * Deliberately does NOT fit a gestational trajectory. The belief that
 * babies move less near term is a myth and a documented contributor to
 * late presentation — a rolling window adapts to real change without
 * encoding that expectation.
 */

import { WINDOWS_PER_BIN } from './aggregate.ts';
import { activeFractionByHour } from './features.ts';
import { BASELINE_MIN_DAY_COVERAGE, BASELINE_MIN_DAYS, BASELINE_ROLLING_DAYS } from './constants.ts';
import type { Baseline, MovementBin } from './types.ts';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BINS_PER_DAY = (24 * 60) / 5; // 5-minute resolution
export const WINDOWS_PER_DAY = BINS_PER_DAY * WINDOWS_PER_BIN;

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * `sufficient` stays false until at least BASELINE_MIN_DAYS days each carry
 * at least BASELINE_MIN_DAY_COVERAGE coverage — while insufficient, the
 * detector cannot fire and the app should say it's still learning.
 */
export function computeBaseline(bins: MovementBin[], now: Date): Baseline {
  const windowStartMs = now.getTime() - BASELINE_ROLLING_DAYS * MS_PER_DAY;
  const trailing = bins.filter(
    (bin) => bin.t.getTime() >= windowStartMs && bin.t.getTime() < now.getTime()
  );

  const coveredWindowsByDay = new Map<string, number>();
  for (const bin of trailing) {
    const key = dayKeyOf(bin.t);
    coveredWindowsByDay.set(key, (coveredWindowsByDay.get(key) ?? 0) + bin.coveredWindows);
  }

  let sufficientDayCount = 0;
  for (const coveredWindows of coveredWindowsByDay.values()) {
    if (coveredWindows / WINDOWS_PER_DAY >= BASELINE_MIN_DAY_COVERAGE) {
      sufficientDayCount += 1;
    }
  }

  const byHour = activeFractionByHour(trailing).map((entry) => ({
    hour: entry.hour,
    expectedActiveFraction: entry.activeFraction,
    coverageFraction: entry.coverageFraction,
  }));

  return {
    computedAt: now,
    daysUsed: coveredWindowsByDay.size,
    sufficient: sufficientDayCount >= BASELINE_MIN_DAYS,
    byHour,
  };
}
