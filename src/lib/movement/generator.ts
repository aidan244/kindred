/**
 * Simulates the wearable's measurement process at 4-second window
 * resolution: one ground truth, two independent observation channels. This
 * is not "fake sensor output" — it's a simulation of a measurement process
 * with published error characteristics (see constants.ts), which is the
 * honest thing to build without real hardware.
 *
 * Deterministic: driven entirely by a seeded PRNG (rng.ts), never
 * Math.random, so a given seed always produces the same trace.
 */

import { mulberry32 } from './rng';
import type { PerceptionEvent, SensorWindow } from './types';
import {
  CHARGE_GAP_MAX_MINUTES,
  CHARGE_GAP_MIN_MINUTES,
  CIRCADIAN_PEAK_HOUR,
  DEFAULT_ACTIVE_RATE_PER_MINUTE,
  FALSE_POSITIVE_RATE,
  PERCEPTION_ASLEEP_HOURS,
  PERCEPTION_ASLEEP_RATE,
  PERCEPTION_ATTENTIVE_HOURS,
  PERCEPTION_ATTENTIVE_RATE,
  PERCEPTION_BASE_RATE,
  PHASE_DURATION_MAX_MINUTES,
  PHASE_DURATION_MIN_MINUTES,
  QUIET_PHASE_RATE_FACTOR,
  SENSITIVITY,
  WINDOW_SECONDS,
} from './constants';

const MINUTE_MS = 60 * 1000;
const WINDOW_MS = WINDOW_SECONDS * 1000;
const DAY_FACTOR_MIN = 0.7;
const DAY_FACTOR_MAX = 1.3;
const DAY_FACTOR_STEP = 0.1;
const EXTRA_DROPOUT_PROBABILITY = 0.5;
const EXTRA_DROPOUT_MIN_MINUTES = 5;
const EXTRA_DROPOUT_MAX_MINUTES = 30;

export interface GeneratorOptions {
  seed: number;
  /** Inclusive start of the simulated span. */
  from: Date;
  /** Exclusive end of the simulated span. */
  to: Date;
  /** Overrides constants.ts's DEFAULT_ACTIVE_RATE_PER_MINUTE — exposed so
   * tests can dial the ground-truth event rate up for statistical checks
   * without waiting out a long simulated run. */
  activeRatePerMinute?: number;
}

export interface GeneratedMovement {
  /** Every 4-second window across [from, to), oldest first. */
  sensorWindows: SensorWindow[];
  /** One entry per true ground-truth event, oldest first — independent of
   * the sensor channel. */
  perceptionEvents: PerceptionEvent[];
  /** How many windows contained a true event — the denominator the
   * sensitivity round-trip test checks the sensor channel against. */
  trueEventWindowCount: number;
  /**
   * Ground truth, parallel to `sensorWindows` (same length and order):
   * whether each window actually contained a movement, before any sensor
   * error was applied. This is exposed for validating the error model
   * (see the sensitivity round-trip test) — the detector and every other
   * consumer must only ever see `sensorWindows`, never this array, or the
   * simulation stops being an honest stand-in for real hardware.
   */
  groundTruthWindows: boolean[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function hourFractionOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** 0.4-1.0, peaking at CIRCADIAN_PEAK_HOUR. */
function circadianFactor(hourFraction: number): number {
  const radians = ((hourFraction - CIRCADIAN_PEAK_HOUR) / 24) * 2 * Math.PI;
  return 0.4 + 0.6 * ((1 + Math.cos(radians)) / 2);
}

function perceptionProbability(hourFraction: number): number {
  const [asleepStart, asleepEnd] = PERCEPTION_ASLEEP_HOURS;
  const [attentiveStart, attentiveEnd] = PERCEPTION_ATTENTIVE_HOURS;
  if (hourFraction >= asleepStart && hourFraction < asleepEnd) {
    return PERCEPTION_ASLEEP_RATE;
  }
  if (hourFraction >= attentiveStart && hourFraction < attentiveEnd) {
    return PERCEPTION_ATTENTIVE_RATE;
  }
  return PERCEPTION_BASE_RATE;
}

/** Start-of-day (local midnight) timestamp, in ms, for whichever day `ms` falls in. */
function startOfDayMs(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

interface DayCoverageGaps {
  gaps: Array<[number, number]>;
}

function generateDayGaps(rng: () => number, dayStartMs: number): DayCoverageGaps {
  const gaps: Array<[number, number]> = [];

  const chargeGapStartMs = dayStartMs + randRange(rng, 0, 24 * 60) * MINUTE_MS;
  const chargeGapDurationMs =
    randRange(rng, CHARGE_GAP_MIN_MINUTES, CHARGE_GAP_MAX_MINUTES) * MINUTE_MS;
  gaps.push([chargeGapStartMs, chargeGapStartMs + chargeGapDurationMs]);

  // Occasional showering / adhesive failure, modelled as an extra dropout
  // on top of the daily charge gap, tuned (with the charge gap) to land
  // realistic coverage in the 88-92% range the brief describes.
  if (rng() < EXTRA_DROPOUT_PROBABILITY) {
    const extraStartMs = dayStartMs + randRange(rng, 0, 24 * 60) * MINUTE_MS;
    const extraDurationMs =
      randRange(rng, EXTRA_DROPOUT_MIN_MINUTES, EXTRA_DROPOUT_MAX_MINUTES) * MINUTE_MS;
    gaps.push([extraStartMs, extraStartMs + extraDurationMs]);
  }

  return { gaps };
}

function isWithinGaps(ms: number, gaps: Array<[number, number]>): boolean {
  return gaps.some(([start, end]) => ms >= start && ms < end);
}

/**
 * Generates the sensor and perception channels across [from, to) at
 * 4-second resolution, from one shared ground truth.
 */
export function generateMovement(options: GeneratorOptions): GeneratedMovement {
  const rng = mulberry32(options.seed);
  const activeRatePerMinute = options.activeRatePerMinute ?? DEFAULT_ACTIVE_RATE_PER_MINUTE;

  const fromMs = options.from.getTime();
  const toMs = options.to.getTime();

  const sensorWindows: SensorWindow[] = [];
  const perceptionEvents: PerceptionEvent[] = [];
  const groundTruthWindows: boolean[] = [];
  let trueEventWindowCount = 0;

  // Phase (active/quiet) state.
  let phaseIsActive = rng() < 0.5;
  let phaseEndMs =
    fromMs + randRange(rng, PHASE_DURATION_MIN_MINUTES, PHASE_DURATION_MAX_MINUTES) * MINUTE_MS;

  // Per-day random-walk rate multiplier and coverage-gap state, recomputed
  // whenever the calendar day changes.
  let currentDayKey = dayKeyOf(options.from);
  let dayFactor = 1;
  let dayGaps = generateDayGaps(rng, startOfDayMs(fromMs)).gaps;

  for (let ms = fromMs; ms < toMs; ms += WINDOW_MS) {
    const timestamp = new Date(ms);

    const dayKey = dayKeyOf(timestamp);
    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      dayFactor = clamp(
        dayFactor + (rng() - 0.5) * DAY_FACTOR_STEP,
        DAY_FACTOR_MIN,
        DAY_FACTOR_MAX
      );
      dayGaps = generateDayGaps(rng, startOfDayMs(ms)).gaps;
    }

    while (ms >= phaseEndMs) {
      phaseIsActive = !phaseIsActive;
      phaseEndMs +=
        randRange(rng, PHASE_DURATION_MIN_MINUTES, PHASE_DURATION_MAX_MINUTES) * MINUTE_MS;
    }

    const hourFraction = hourFractionOf(timestamp);
    const lambdaPerMinute =
      activeRatePerMinute *
      circadianFactor(hourFraction) *
      dayFactor *
      (phaseIsActive ? 1 : QUIET_PHASE_RATE_FACTOR);
    const windowMinutes = WINDOW_SECONDS / 60;
    const pTrueEvent = 1 - Math.exp(-lambdaPerMinute * windowMinutes);

    const hasTrueEvent = rng() < pTrueEvent;
    const classifiedPositive = hasTrueEvent ? rng() < SENSITIVITY : rng() < FALSE_POSITIVE_RATE;
    const covered = !isWithinGaps(ms, dayGaps);

    sensorWindows.push({
      timestamp,
      // Never true when uncovered — an unpowered/off-body sensor has no
      // classification to report, not a negative one (clinical safety
      // rule 4, applied here as well as in aggregate.ts).
      positive: covered && classifiedPositive,
      covered,
    });
    groundTruthWindows.push(hasTrueEvent);

    if (hasTrueEvent) {
      trueEventWindowCount += 1;
      perceptionEvents.push({
        timestamp,
        perceived: rng() < perceptionProbability(hourFraction),
      });
    }
  }

  return { sensorWindows, perceptionEvents, trueEventWindowCount, groundTruthWindows };
}
