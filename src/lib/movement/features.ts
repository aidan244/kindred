/**
 * Features derived from aggregated MovementBins. Every function here is
 * restricted to covered data and returns coverage alongside the value it
 * computes — an uncovered bin is absent information, never a zero.
 */

import { BIN_MINUTES, WINDOWS_PER_BIN } from './aggregate';
import { SENSITIVITY } from './constants';
import type {
  ActiveFractionByHour,
  BurstStructure,
  CircadianFit,
  FeatureSet,
  MovementBin,
  QuietInterval,
} from './types';

const CLUSTER_WINDOW_BINS = 3; // 15 minutes at 5-minute bins — an engineering
// threshold for "close together", not a sourced clinical figure.

/** Active fraction (activeWindows/coveredWindows) per hour-of-day, with the
 * coverage fraction that estimate rests on. Primary feature, most robust
 * to sensor error since it's a ratio over a lot of covered data. */
export function activeFractionByHour(bins: MovementBin[]): ActiveFractionByHour[] {
  const byHour = new Map<number, { active: number; covered: number; binCount: number }>();

  for (const bin of bins) {
    const hour = bin.t.getHours();
    const entry = byHour.get(hour) ?? { active: 0, covered: 0, binCount: 0 };
    entry.active += bin.activeWindows;
    entry.covered += bin.coveredWindows;
    entry.binCount += 1;
    byHour.set(hour, entry);
  }

  const result: ActiveFractionByHour[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const entry = byHour.get(hour);
    if (!entry || entry.binCount === 0) {
      result.push({ hour, activeFraction: 0, coverageFraction: 0 });
      continue;
    }
    result.push({
      hour,
      activeFraction: entry.covered > 0 ? entry.active / entry.covered : 0,
      coverageFraction: entry.covered / (entry.binCount * WINDOWS_PER_BIN),
    });
  }
  return result;
}

/**
 * Every run of bins with activeWindows=0 and coveredWindows>0, in
 * chronological order. An uncovered bin (coveredWindows=0) never
 * contributes to, extends, or breaks a run — it's skipped transparently,
 * as absent information rather than either a quiet or an active
 * observation (clinical safety rule 4). A genuinely active covered bin
 * does break the run.
 */
export function allQuietIntervals(bins: MovementBin[]): QuietInterval[] {
  const intervals: QuietInterval[] = [];
  const missRate = 1 - SENSITIVITY;

  let runStart = -1;
  let runLength = 0;
  let lastQuietIndex = -1;

  const pushRun = (): void => {
    if (runLength === 0) {
      return;
    }
    const durationMinutes = runLength * BIN_MINUTES;
    // Each quiet-covered bin could be hiding a missed movement in any of
    // its (up to 75) windows, at the sensor's false-negative rate.
    // Expressed as how many fewer minutes the true interval could be, if
    // those misses had been caught — never render durationMinutes alone.
    const uncertaintyMinutes = Math.round(runLength * missRate * BIN_MINUTES * 10) / 10;
    intervals.push({
      startIndex: runStart,
      endIndex: lastQuietIndex,
      durationMinutes,
      uncertaintyMinutes,
    });
  };

  for (let i = 0; i < bins.length; i += 1) {
    const bin = bins[i];
    const isQuietCovered = bin.activeWindows === 0 && bin.coveredWindows > 0;
    const isUncovered = bin.coveredWindows === 0;

    if (isQuietCovered) {
      if (runStart === -1) {
        runStart = i;
      }
      runLength += 1;
      lastQuietIndex = i;
    } else if (isUncovered) {
      continue; // absent data: transparent, doesn't touch the run at all
    } else {
      pushRun();
      runStart = -1;
      runLength = 0;
      lastQuietIndex = -1;
    }
  }
  pushRun();

  return intervals;
}

/** The single longest quiet interval — see allQuietIntervals for the rules
 * on what can and can't be part of one. */
export function longestQuietInterval(bins: MovementBin[]): QuietInterval | null {
  const intervals = allQuietIntervals(bins);
  if (intervals.length === 0) {
    return null;
  }
  return intervals.reduce((best, current) =>
    current.durationMinutes > best.durationMinutes ? current : best
  );
}

/**
 * Inter-event spacing of active (covered) bins. Catches a change in shape
 * — clustering into bursts vs. spreading out evenly — when the raw count
 * hasn't moved. Both figures are heuristic proxies, not clinical measures:
 * coefficientOfVariation near 1 is Poisson-like (random) spacing; higher
 * means burstier, lower means more regular. clusteringIndex is the share
 * of gaps between active bins that are "close together"
 * (<= CLUSTER_WINDOW_BINS apart).
 */
export function burstStructure(bins: MovementBin[]): BurstStructure {
  const covered = bins.filter((bin) => bin.coveredWindows > 0);
  const activeIndices: number[] = [];
  covered.forEach((bin, index) => {
    if (bin.activeWindows > 0) {
      activeIndices.push(index);
    }
  });

  if (activeIndices.length < 2) {
    return { coefficientOfVariation: 0, clusteringIndex: 0 };
  }

  const intervals: number[] = [];
  for (let i = 1; i < activeIndices.length; i += 1) {
    intervals.push(activeIndices[i] - activeIndices[i - 1]);
  }

  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const variance =
    intervals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / intervals.length;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

  const clusteredCount = intervals.filter((gap) => gap <= CLUSTER_WINDOW_BINS).length;
  const clusteringIndex = clusteredCount / intervals.length;

  return { coefficientOfVariation, clusteringIndex };
}

/**
 * Single-harmonic (24h period) least-squares cosine fit over whichever
 * hours have any coverage. Standard discrete-Fourier-at-one-frequency
 * technique — not a clinical measure, just a compact description of "when
 * does she tend to move most".
 */
export function circadianFit(hourly: ActiveFractionByHour[]): CircadianFit {
  const usable = hourly.filter((entry) => entry.coverageFraction > 0);
  if (usable.length === 0) {
    return { amplitude: 0, acrophaseHour: 0 };
  }

  let sumCos = 0;
  let sumSin = 0;
  for (const { hour, activeFraction } of usable) {
    const theta = (2 * Math.PI * hour) / 24;
    sumCos += activeFraction * Math.cos(theta);
    sumSin += activeFraction * Math.sin(theta);
  }

  const a = (2 / usable.length) * sumCos;
  const b = (2 / usable.length) * sumSin;
  const amplitude = Math.sqrt(a * a + b * b);

  let acrophaseHour = (Math.atan2(b, a) * 24) / (2 * Math.PI);
  if (acrophaseHour < 0) {
    acrophaseHour += 24;
  }

  return { amplitude, acrophaseHour };
}

export function computeFeatures(bins: MovementBin[]): FeatureSet {
  const hourly = activeFractionByHour(bins);
  return {
    activeFractionByHour: hourly,
    longestQuietInterval: longestQuietInterval(bins),
    burstStructure: burstStructure(bins),
    circadianFit: circadianFit(hourly),
  };
}
