/**
 * Deterministic seed generator for 14 days of binary movement samples, at
 * 5-minute resolution, with a plausible circadian pattern (a quiet overnight
 * period, busier daytime/evening). Two variants:
 *
 *  - 'active': a normal pattern throughout.
 *  - 'quiet': the same pattern, except the most recent ~24h has noticeably
 *    reduced movement — used to demo the concerning path.
 *
 * Uses a seeded PRNG (mulberry32), never Math.random, so the *shape* of the
 * data is identical on every run of the demo. Samples are anchored to real
 * wall-clock time (the `now` passed in, defaulting to `new Date()`) so
 * "the last 24h" always means the 24h up to whenever the demo is running.
 */

import type { ActivitySample, ActivityVariant } from '../types';

export const SAMPLE_INTERVAL_MINUTES = 5;
export const TOTAL_DAYS = 14;
export const SAMPLES_PER_HOUR = 60 / SAMPLE_INTERVAL_MINUTES;
export const TOTAL_SAMPLES = TOTAL_DAYS * 24 * SAMPLES_PER_HOUR;

const SEED = 0x4b494e44; // 'KIND'
const QUIET_WINDOW_HOURS = 24;
const QUIET_REDUCTION_FACTOR = 0.3;

// Baseline probability of a "moved" sample by hour of day (0-23). Lower
// overnight (roughly 01:00-05:00), rising through the morning, staying
// fairly high through the day and evening. Not clinically derived — see
// file header.
const HOURLY_MOVEMENT_PROBABILITY: readonly number[] = [
  0.14, 0.08, 0.05, 0.05, 0.06, 0.09, // 00-05
  0.16, 0.24, 0.32, 0.38, 0.42, 0.44, // 06-11
  0.46, 0.44, 0.42, 0.4, 0.42, 0.46, // 12-17
  0.5, 0.48, 0.4, 0.32, 0.24, 0.18, // 18-23
];

/** Mulberry32 seeded PRNG — deterministic, no Math.random. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates TOTAL_SAMPLES worth of activity samples ending at `now`
 * (inclusive), oldest first.
 */
export function generateSeedActivity(
  variant: ActivityVariant,
  now: Date = new Date()
): ActivitySample[] {
  const random = mulberry32(SEED);
  const endMs = now.getTime();
  const intervalMs = SAMPLE_INTERVAL_MINUTES * 60 * 1000;
  const startMs = endMs - (TOTAL_SAMPLES - 1) * intervalMs;
  const quietCutoffMs = endMs - QUIET_WINDOW_HOURS * 60 * 60 * 1000;

  const samples: ActivitySample[] = [];
  for (let i = 0; i < TOTAL_SAMPLES; i += 1) {
    const timestampMs = startMs + i * intervalMs;
    const timestamp = new Date(timestampMs);
    const hour = timestamp.getHours();

    let probability = HOURLY_MOVEMENT_PROBABILITY[hour] ?? 0.3;
    if (variant === 'quiet' && timestampMs >= quietCutoffMs) {
      probability *= QUIET_REDUCTION_FACTOR;
    }

    samples.push({ timestamp, moved: random() < probability });
  }

  return samples;
}
