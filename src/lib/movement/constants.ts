/**
 * Every constant the movement pipeline uses, in one place, so nothing is
 * duplicated (and possibly drifts) across generator/features/baseline/
 * detector. Each is marked as either sourced from the paper the wearable is
 * modelled on, sourced from held-backend-brief.md's own clinical context,
 * or an engineering placeholder — so nobody mistakes a placeholder for a
 * measured value.
 *
 * Paper: Yap et al., "Band-aid-format wearable for continuous fetal
 * movement monitoring", Sci. Adv. 11, eady2661 (2025).
 */

// ---------------------------------------------------------------------------
// Sourced directly from the paper
// ---------------------------------------------------------------------------

/** Combined pressure + strain system sensitivity. */
export const SENSITIVITY = 0.7816;
/** Combined pressure + strain system specificity. */
export const SPECIFICITY = 0.9086;
/** 1 - specificity: probability a no-event window still classifies positive. */
export const FALSE_POSITIVE_RATE = 1 - SPECIFICITY;
/** Fixed segmentation window, 50 Hz resampled. */
export const WINDOW_SECONDS = 4;
/** ~25h continuous, 4.2V to 3.5V — the basis for the daily charge-gap model. */
export const BATTERY_HOURS = 25;
/** Trial inclusion criteria. Not enforced by any function here yet; carried
 * for documentation and a future eligibility check (the backend brief's
 * gestation-gating rule). */
export const VALIDATED_GESTATION_WEEKS: readonly [number, number] = [28, 37];

// ---------------------------------------------------------------------------
// From held-backend-brief.md's clinical context (healthy term fetal
// behavioural-state cycle literature), not the sensor paper itself
// ---------------------------------------------------------------------------

export const PHASE_DURATION_MIN_MINUTES = 30;
export const PHASE_DURATION_MAX_MINUTES = 40;

// ---------------------------------------------------------------------------
// Engineering placeholders — not sourced from either. The paper doesn't
// publish inter-movement timing or a maternal-state model, only classifier
// accuracy, so these exist to make the simulation plausible for a demo,
// not to make a clinical claim.
// ---------------------------------------------------------------------------

/** Mean true-movement rate per minute during an active phase, at peak
 * circadian/day factor. */
export const DEFAULT_ACTIVE_RATE_PER_MINUTE = 0.6;
/** Multiplier applied to the active-phase rate during a quiet phase — "near
 * zero", per the brief, not literally zero. */
export const QUIET_PHASE_RATE_FACTOR = 0.05;
/** Hour of day (24h clock) the circadian movement rate peaks at. */
export const CIRCADIAN_PEAK_HOUR = 22;
/** Daily charge gap: covered=false for this long, once a day. */
export const CHARGE_GAP_MIN_MINUTES = 45;
export const CHARGE_GAP_MAX_MINUTES = 90;

/** ~60% overall maternal perception rate (40% of fetal movement goes
 * unnoticed) is the paper's headline context figure — not something the
 * sensor itself measures. Modulated below by hour-of-day as a stand-in for
 * "asleep" vs "sitting and attending", since no richer maternal-state model
 * exists in this codebase or the paper. */
export const PERCEPTION_BASE_RATE = 0.6;
export const PERCEPTION_ASLEEP_RATE = 0.35;
export const PERCEPTION_ATTENTIVE_RATE = 0.72;
export const PERCEPTION_ASLEEP_HOURS: readonly [number, number] = [0, 6];
export const PERCEPTION_ATTENTIVE_HOURS: readonly [number, number] = [19, 22];

// ---------------------------------------------------------------------------
// Baseline / detector thresholds, per held-backend-brief.md
// ---------------------------------------------------------------------------

export const BASELINE_ROLLING_DAYS = 7;
export const BASELINE_MIN_DAYS = 5;
export const BASELINE_MIN_DAY_COVERAGE = 0.6;

export const DETECTOR_VERSION = 'movement-detector-v1';
export const DETECTOR_MIN_TRAILING_COVERAGE = 0.7;
export const DETECTOR_TRAILING_COVERAGE_HOURS = 4;
export const DETECTOR_RATE_THRESHOLD_FACTOR = 0.5;
export const DETECTOR_SUSTAINED_HOURS = 3;
export const DETECTOR_REFRACTORY_HOURS = 6;
export const DETECTOR_QUIET_INTERVAL_PERCENTILE = 0.95;
export const DETECTOR_QUIET_INTERVAL_MIN_COVERAGE = 0.9;
