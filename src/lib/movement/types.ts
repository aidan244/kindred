/**
 * Types for the movement pipeline. Deliberately decoupled from
 * src/types.ts and src/lib/backend/types.ts: this module's coverage-aware,
 * sub-bin representation is internal, and never presented to the frontend
 * directly (see the Phase 2 plan's scope boundary). Phase 3 is where a
 * SupabaseBackend maps between this and the simpler persisted/frontend
 * shapes.
 */

/** One true movement event on the ground-truth timeline, before any sensor
 * or perception error is applied. */
export interface GroundTruthEvent {
  timestamp: Date;
}

/** One 4-second sensor classification window — the finest grain the
 * (simulated) hardware reports at. */
export interface SensorWindow {
  timestamp: Date;
  /** Whether the classifier called this window positive (a movement).
   * Meaningless when `covered` is false. */
  positive: boolean;
  /** Whether the sensor had power and skin contact for this window. An
   * uncovered window must never be read as "no movement" (clinical safety
   * rule 4) — covered=false is the only honest encoding of "no data". */
  covered: boolean;
}

/** Independently, whether she consciously noticed each true event. Kept for
 * completeness even though nothing downstream consumes it yet — the point
 * (per held-backend-brief.md) is that her true perception rate is only
 * computable at all because this channel exists alongside the sensor one. */
export interface PerceptionEvent {
  timestamp: Date;
  perceived: boolean;
}

/** One aggregated 5-minute bin: 75 four-second windows folded together.
 * Both counts are retained — never collapsed to a single boolean — so
 * partial coverage is never silently discarded. */
export interface MovementBin {
  /** 5-minute-aligned bin start. */
  t: Date;
  /** Positive windows among covered windows, 0-75. */
  activeWindows: number;
  /** Covered windows, 0-75. 0 means "no data for this bin", not "no
   * movement" — clinical safety rule 4. */
  coveredWindows: number;
}

export interface HourlyBaseline {
  /** Hour of day, 0-23. */
  hour: number;
  /** Mean active fraction (activeWindows/coveredWindows) for this
   * hour-of-day, across the rolling baseline window. */
  expectedActiveFraction: number;
  /** How much of the rolling window's data for this hour was covered,
   * 0-1 — carried alongside the value per the brief's "always return
   * coverage alongside the value" rule. */
  coverageFraction: number;
}

export interface Baseline {
  computedAt: Date;
  daysUsed: number;
  /** False until >=5 days each carrying >=60% coverage exist. While
   * false, the detector cannot fire. */
  sufficient: boolean;
  /** Exactly 24 entries, one per hour of day. */
  byHour: HourlyBaseline[];
}

export interface ActiveFractionByHour {
  hour: number;
  activeFraction: number;
  coverageFraction: number;
}

export interface QuietInterval {
  /** Index into the bins array the interval starts at (inclusive). */
  startIndex: number;
  /** Index into the bins array the interval ends at (inclusive). */
  endIndex: number;
  durationMinutes: number;
  /** How much longer this interval could plausibly run due to missed
   * (false-negative) windows, derived from the sensor's miss rate. Render
   * alongside the duration; never render the duration bare. */
  uncertaintyMinutes: number;
}

export interface BurstStructure {
  coefficientOfVariation: number;
  clusteringIndex: number;
}

export interface CircadianFit {
  amplitude: number;
  /** Hour of day (0-24, may be fractional) the fitted cosine peaks at. */
  acrophaseHour: number;
}

export interface FeatureSet {
  activeFractionByHour: ActiveFractionByHour[];
  /** Null when there is no run of covered-but-inactive bins at all. */
  longestQuietInterval: QuietInterval | null;
  burstStructure: BurstStructure;
  circadianFit: CircadianFit;
}

export type DetectorRule = 'sustained_low_rate' | 'extended_quiet';

/** Everything the backend brief's `alerts` table wants to persist,
 * produced in one place so Phase 3 can write it straight through. */
export interface DetectorFiring {
  detectorVersion: string;
  rule: DetectorRule;
  windowFrom: Date;
  windowTo: Date;
  coverageFraction: number;
  observed: number;
  expected: number;
  threshold: number;
}

export interface DetectorContext {
  /** Null if no alert has ever fired for this patient. */
  lastAlertAt: Date | null;
  /** True if a triage session is currently open — an alert during an open
   * session attaches as context rather than firing. */
  sessionOpen: boolean;
}
