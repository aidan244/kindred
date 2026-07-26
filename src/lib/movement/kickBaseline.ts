/**
 * Personal baseline for kick counts. A sibling of baseline.ts, not an
 * extension of it — kicks are pre-aggregated daily tallies (KickWindow),
 * not raw 4-second sensor windows, so there's no shared aggregation step to
 * reuse.
 *
 * Imports KickSample/KickWindow straight from src/types.ts, breaking this
 * directory's usual decoupling from the frontend's types on purpose.
 * MovementBin (types.ts, above) stays decoupled because it's a richer
 * internal shape with no frontend equivalent; kicks have no such gap to
 * bridge — KickWindow already is the only sensible shape at every layer, so
 * a parallel type here would just be duplication.
 */

import type { KickSample, KickWindow } from '../../types.ts';
import { KICK_BASELINE_MIN_DAYS, KICK_RECENT_DAYS } from './constants.ts';
import type { KickBaseline } from './types.ts';

function mean(samples: KickSample[]): number {
  return samples.reduce((sum, sample) => sum + sample.kicks, 0) / samples.length;
}

/**
 * Everything strictly before the most recent KICK_RECENT_DAYS complete
 * days folds into the baseline; those recent days themselves are what the
 * detector compares against it, never included in their own baseline.
 */
export function computeKickBaseline(window: KickWindow, now: Date): KickBaseline {
  const { samples, settledIndex } = window;
  if (settledIndex < 0) {
    return { computedAt: now, daysUsed: 0, sufficient: false, meanKicksPerDay: 0 };
  }

  const recentStart = Math.max(0, settledIndex - KICK_RECENT_DAYS + 1);
  const baselineDays = samples.slice(0, recentStart);

  return {
    computedAt: now,
    daysUsed: baselineDays.length,
    sufficient: baselineDays.length >= KICK_BASELINE_MIN_DAYS,
    meanKicksPerDay: baselineDays.length > 0 ? mean(baselineDays) : 0,
  };
}
