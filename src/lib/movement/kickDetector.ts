/**
 * Movement data never determines disposition (clinical safety rule 5) —
 * this decides only whether an alert fires, via the same entryPath='alert'
 * mechanism the demo panel's manual button already uses; disposition still
 * comes solely from src/logic/disposition.ts, entry path and red-flag
 * answers.
 *
 * A sibling of detector.ts, not an extension of it — one ratio check, not
 * two rules. Kicks don't have an "extended quiet interval" analogue worth
 * building: that concept lives in the raw 4-second sensor stream, which
 * this boundary never sees — kicks arrive as pre-aggregated daily/hourly
 * tallies (see kickBaseline.ts's header for why that also means importing
 * KickWindow straight from src/types.ts rather than a movement-local type).
 *
 * Where this sits architecturally: the real anomaly detector must run
 * server-side, not on-device (backend-connections.md §2) — this function
 * is a demo/preview capability standing in for that, called directly from
 * DemoPanel.tsx, not an automatic background job. It stays honest about
 * that rather than pretending to be the production design.
 */

import type { KickWindow } from '../../types.ts';
import {
  KICK_DETECTOR_REFRACTORY_HOURS,
  KICK_DETECTOR_VERSION,
  KICK_RATE_THRESHOLD_FACTOR,
  KICK_RECENT_DAYS,
} from './constants.ts';
import type { DetectorContext, DetectorFiring, KickBaseline } from './types.ts';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Deterministic, versioned. Fires when the mean of the most recent
 * KICK_RECENT_DAYS complete days falls below KICK_RATE_THRESHOLD_FACTOR of
 * her own baseline mean — the same "below half of expected" shape
 * DETECTOR_RATE_THRESHOLD_FACTOR already uses for the boolean channel.
 */
export function detectKickReduction(
  window: KickWindow,
  baseline: KickBaseline,
  now: Date,
  context: DetectorContext
): DetectorFiring | null {
  if (!baseline.sufficient) {
    return null;
  }
  if (context.sessionOpen) {
    return null;
  }
  if (context.lastAlertAt) {
    const hoursSinceLastAlert = (now.getTime() - context.lastAlertAt.getTime()) / HOUR_MS;
    if (hoursSinceLastAlert < KICK_DETECTOR_REFRACTORY_HOURS) {
      return null;
    }
  }

  const { samples, settledIndex } = window;
  if (settledIndex < 0) {
    return null; // no settled data: band offline, or the window is empty
  }

  const recentStart = Math.max(0, settledIndex - KICK_RECENT_DAYS + 1);
  const recentDays = samples.slice(recentStart, settledIndex + 1);
  if (recentDays.length === 0) {
    return null;
  }

  const observed = recentDays.reduce((sum, sample) => sum + sample.kicks, 0) / recentDays.length;
  const threshold = baseline.meanKicksPerDay * KICK_RATE_THRESHOLD_FACTOR;
  if (!(observed < threshold)) {
    return null;
  }

  return {
    detectorVersion: KICK_DETECTOR_VERSION,
    rule: 'reduced_kick_rate',
    windowFrom: recentDays[0].timestamp,
    windowTo: now,
    coverageFraction: recentDays.length / KICK_RECENT_DAYS,
    observed,
    expected: baseline.meanKicksPerDay,
    threshold,
  };
}
