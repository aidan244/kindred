/**
 * Seeded fetal heart-rate data — the stand-in for a real band feed, behind
 * the sensor boundary (src/sensors/MovementStream.ts). Nothing outside that
 * module may import this.
 *
 * PLACEHOLDER CLINICAL SHAPE, WRITTEN BY AN ENGINEER. The baseline and the
 * variability below are chosen to look plausible on screen, not to be
 * clinically representative of anything. Replacing the band mock with real
 * hardware replaces this file entirely.
 *
 * Written as a CONTINUOUS FUNCTION OF ABSOLUTE TIME rather than as an array
 * of samples, for one load-bearing reason: Home samples a 24-hour window at
 * ten-minute resolution and the live view samples two minutes at one-second
 * resolution, and both must be looking at the same underlying signal. A
 * pre-generated array would have to pick one resolution and resample, which
 * shows up as the two screens visibly disagreeing about the same moment.
 *
 * Deterministic: no Math.random, no hidden state, `bpmAt(t)` is a pure
 * function of `t` and the variant. The same instant always reads the same
 * value, so a screenshot taken twice is identical and nothing drifts between
 * renders.
 */

import type { ActivityVariant, HeartRateSample } from '../types';

/** Plausible resting baseline for the fixture. Placeholder — see header. */
const BASELINE_BPM = 141;

/** Three slow, mutually prime periods, so the composite never visibly
 * repeats inside a 24-hour window. Same law as the aura's drift periods. */
const PERIOD_A_MS = 7 * 60 * 1000;
const PERIOD_B_MS = 139 * 1000;
const PERIOD_C_MS = 41 * 1000;

/** How much each variant moves. 'quiet' is a calmer trace with shallower
 * accelerations; it is NOT a lower or a "worse" baseline — this file must
 * never encode a verdict. */
const VARIANT_AMPLITUDE: Record<ActivityVariant, number> = {
  quiet: 0.55,
  active: 1,
};

/** Deterministic fine texture, so the line has grain rather than reading as
 * a pure sine sum. Quantised to two-second buckets so it stays continuous
 * enough not to look like noise when sampled at one second. */
function texture(timeMs: number): number {
  const bucket = Math.floor(timeMs / 2000);
  const raw = Math.sin(bucket * 12.9898) * 43758.5453;
  return (raw - Math.floor(raw)) * 2 - 1; // -1..1
}

/** Beats per minute at an absolute instant. Pure. */
export function bpmAt(timeMs: number, variant: ActivityVariant): number {
  const amplitude = VARIANT_AMPLITUDE[variant];
  const slow = 6.5 * Math.sin((2 * Math.PI * timeMs) / PERIOD_A_MS);
  const mid = 4 * Math.sin((2 * Math.PI * timeMs) / PERIOD_B_MS);
  const fast = 2.5 * Math.sin((2 * Math.PI * timeMs) / PERIOD_C_MS);
  const grain = 1.4 * texture(timeMs);
  return Math.round(BASELINE_BPM + amplitude * (slow + mid + fast + grain));
}

/**
 * Samples the signal across `[endMs - spanMs, endMs]` at `stepMs`, oldest
 * first. Sample instants are snapped to the step grid so a window taken a
 * fraction of a second later returns the same points shifted by whole
 * samples, rather than the whole line shimmering.
 */
export function generateHeartRateWindow(
  variant: ActivityVariant,
  endMs: number,
  spanMs: number,
  stepMs: number
): HeartRateSample[] {
  const lastTick = Math.floor(endMs / stepMs) * stepMs;
  const count = Math.floor(spanMs / stepMs);
  const samples: HeartRateSample[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = lastTick - i * stepMs;
    samples.push({ timestamp: new Date(t), bpm: bpmAt(t, variant) });
  }
  return samples;
}
