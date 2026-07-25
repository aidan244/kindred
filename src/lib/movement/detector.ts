/**
 * Deterministic, versioned, logged. Never a model. Movement data never
 * determines disposition (clinical safety rule 5) — this decides only
 * whether an alert fires; disposition still comes solely from
 * src/logic/disposition.ts, entry path and red-flag answers.
 *
 * Because the underlying event is rare and the sensor's sensitivity is
 * ~78%, most firings from this function will be false — which is exactly
 * why an alert escalates to a phone call rather than an attendance.
 */

import { WINDOWS_PER_BIN } from './aggregate';
import { allQuietIntervals } from './features';
import {
  DETECTOR_MIN_TRAILING_COVERAGE,
  DETECTOR_QUIET_INTERVAL_MIN_COVERAGE,
  DETECTOR_QUIET_INTERVAL_PERCENTILE,
  DETECTOR_RATE_THRESHOLD_FACTOR,
  DETECTOR_REFRACTORY_HOURS,
  DETECTOR_SUSTAINED_HOURS,
  DETECTOR_TRAILING_COVERAGE_HOURS,
  DETECTOR_VERSION,
} from './constants';
import type { Baseline, DetectorContext, DetectorFiring, MovementBin } from './types';

const HOUR_MS = 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sumWindows(bins: MovementBin[]): { active: number; covered: number } {
  let active = 0;
  let covered = 0;
  for (const bin of bins) {
    active += bin.activeWindows;
    covered += bin.coveredWindows;
  }
  return { active, covered };
}

function binsBetween(bins: MovementBin[], startMs: number, endMs: number): MovementBin[] {
  return bins.filter((bin) => bin.t.getTime() >= startMs && bin.t.getTime() < endMs);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.ceil(p * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[index];
}

/** Path 1: a sustained drop below her own expected rate, hour by hour. */
function detectSustainedLowRate(
  bins: MovementBin[],
  baseline: Baseline,
  now: Date
): DetectorFiring | null {
  const byHour = new Map(baseline.byHour.map((entry) => [entry.hour, entry]));
  const nowMs = now.getTime();

  let worstObserved = Infinity;
  let matchedExpected = 0;
  let earliestWindowStart = now;

  for (let i = 0; i < DETECTOR_SUSTAINED_HOURS; i += 1) {
    const windowEndMs = nowMs - i * HOUR_MS;
    const windowStartMs = windowEndMs - HOUR_MS;
    const { active, covered } = sumWindows(binsBetween(bins, windowStartMs, windowEndMs));

    // No data for this clock-hour at all: can't assess it, so we can't
    // honestly claim a *sustained* reduction across it either.
    if (covered === 0) {
      return null;
    }

    const observedFraction = active / covered;
    const hourOfDay = new Date(windowStartMs).getHours();
    const expected = byHour.get(hourOfDay)?.expectedActiveFraction ?? 0;
    const threshold = expected * DETECTOR_RATE_THRESHOLD_FACTOR;

    if (!(observedFraction < threshold)) {
      return null;
    }

    worstObserved = Math.min(worstObserved, observedFraction);
    matchedExpected = expected;
    earliestWindowStart = new Date(windowStartMs);
  }

  return {
    detectorVersion: DETECTOR_VERSION,
    rule: 'sustained_low_rate',
    windowFrom: earliestWindowStart,
    windowTo: now,
    coverageFraction: 1, // trailing coverage already gated by the caller
    observed: worstObserved,
    expected: matchedExpected,
    threshold: matchedExpected * DETECTOR_RATE_THRESHOLD_FACTOR,
  };
}

/** Path 2: today's quiet spell is longer than her personal 95th
 * percentile of past quiet spells — gated harder because it's noisier. */
function detectExtendedQuiet(bins: MovementBin[], now: Date): DetectorFiring | null {
  const intervals = allQuietIntervals(bins);
  const ongoing = intervals.find((interval) => interval.endIndex === bins.length - 1) ?? null;
  if (!ongoing) {
    return null;
  }

  const historical = intervals.filter((interval) => interval !== ongoing);
  if (historical.length === 0) {
    // No history to compare against — can't establish "her personal 95th
    // percentile" yet, so this path can't fire.
    return null;
  }

  const ongoingBins = bins.slice(ongoing.startIndex, ongoing.endIndex + 1);
  const { covered } = sumWindows(ongoingBins);
  const possibleWindows = ongoingBins.length * WINDOWS_PER_BIN;
  const coverageFraction = possibleWindows > 0 ? covered / possibleWindows : 0;

  const thresholdMinutes = percentile(
    historical.map((interval) => interval.durationMinutes),
    DETECTOR_QUIET_INTERVAL_PERCENTILE
  );

  if (
    coverageFraction >= DETECTOR_QUIET_INTERVAL_MIN_COVERAGE &&
    ongoing.durationMinutes > thresholdMinutes
  ) {
    return {
      detectorVersion: DETECTOR_VERSION,
      rule: 'extended_quiet',
      windowFrom: bins[ongoing.startIndex].t,
      windowTo: now,
      coverageFraction,
      observed: ongoing.durationMinutes,
      expected: thresholdMinutes,
      threshold: thresholdMinutes,
    };
  }

  return null;
}

export function detect(
  bins: MovementBin[],
  baseline: Baseline,
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
    if (hoursSinceLastAlert < DETECTOR_REFRACTORY_HOURS) {
      return null;
    }
  }

  const trailingWindowMs = DETECTOR_TRAILING_COVERAGE_HOURS * HOUR_MS;
  const trailingBins = binsBetween(bins, now.getTime() - trailingWindowMs, now.getTime());
  const trailingPossibleWindows =
    ((DETECTOR_TRAILING_COVERAGE_HOURS * 60) / 5) * WINDOWS_PER_BIN;
  const { covered: trailingCovered } = sumWindows(trailingBins);
  const trailingCoverageFraction = trailingCovered / trailingPossibleWindows;

  if (trailingCoverageFraction < DETECTOR_MIN_TRAILING_COVERAGE) {
    return null;
  }

  return detectSustainedLowRate(bins, baseline, now) ?? detectExtendedQuiet(bins, now);
}
