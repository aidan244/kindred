/**
 * Baby kick counts — the stand-in for the real feed, behind the sensor
 * boundary (src/sensors/MovementStream.ts). Nothing outside that module may
 * import this.
 *
 * HARDCODED ON PURPOSE. The previous heart-rate stand-in was a continuous
 * function of absolute time, so that windows sampled at different
 * resolutions agreed about the same instant. Kick counts do not work that
 * way and should not pretend to: a kick count is a TALLY OVER AN INTERVAL,
 * not a value at an instant, so a day and an hour are genuinely different
 * measurements rather than two samplings of one signal. They are three fixed
 * tables here (daily, hourly, and a longer 12-week daily trend table), and
 * the backend will supply real ones for each.
 *
 * PLACEHOLDER CLINICAL SHAPE, WRITTEN BY AN ENGINEER. The numbers are chosen
 * to look plausible on screen and to give the trace something to say — a
 * quieter stretch mid-week, a fuller weekend, a night lull and an evening
 * peak. They are not representative of anything and carry no threshold: this
 * file must never encode a verdict about what a normal count is.
 *
 * The last bucket of each table is the CURRENT one, and is deliberately
 * lower than its neighbours — today and this hour are both still in
 * progress. That is a real property of tallies and the UI must not read it
 * as a decline; see the note on the trace's screen-reader copy.
 */

import type { ActivityVariant, KickSample } from '../types';

/** Kicks per day, oldest first. The last entry is today, still counting. */
const DAILY: Record<ActivityVariant, readonly number[]> = {
  active: [284, 301, 262, 318, 295, 333, 176],
  quiet: [212, 198, 174, 221, 168, 205, 96],
};

/** Kicks per hour, oldest first. The last entry is the current hour. */
const HOURLY: Record<ActivityVariant, readonly number[]> = {
  active: [9, 6, 4, 3, 7, 12, 16, 11, 14, 19, 22, 8],
  quiet: [5, 3, 2, 1, 4, 6, 9, 5, 7, 8, 11, 3],
};

/**
 * Kicks per day, oldest first, across 12 weeks (84 days) — the longer
 * look-back for the weeks/days trend view. Same placeholder-shape rules as
 * `DAILY` above (a weekly rhythm plus a slower drift across weeks, no
 * threshold implied), just a longer table. The last entry is today.
 */
const TREND: Record<ActivityVariant, readonly number[]> = {
  active: [
    330, 326, 305, 286, 283, 299, 323, 337, 329, 305, 281, 275, 288, 309, 320, 310, 285, 260, 254,
    267, 290, 303, 295, 273, 252, 248, 266, 292, 309, 305, 285, 267, 266, 286, 313, 330, 326, 305,
    286, 283, 299, 323, 337, 329, 305, 281, 275, 288, 309, 320, 310, 285, 260, 254, 267, 290, 303,
    295, 273, 252, 248, 266, 292, 309, 305, 285, 267, 266, 286, 313, 330, 326, 305, 286, 283, 299,
    323, 337, 329, 305, 281, 275, 288, 170,
  ],
  quiet: [
    212, 209, 194, 180, 178, 190, 208, 217, 211, 194, 177, 172, 182, 197, 204, 197, 178, 161, 156,
    166, 181, 191, 185, 169, 154, 152, 164, 183, 195, 193, 179, 166, 166, 180, 199, 212, 209, 194,
    180, 178, 190, 208, 217, 211, 194, 177, 172, 182, 197, 204, 197, 178, 161, 156, 166, 181, 191,
    185, 169, 154, 152, 164, 183, 195, 193, 179, 166, 166, 180, 199, 212, 209, 194, 180, 178, 190,
    208, 217, 211, 194, 177, 172, 182, 99,
  ],
};

/**
 * Builds a window of interval tallies ending at `endMs`.
 *
 * Each sample's `timestamp` is the START of its interval, which is what the
 * trace's labels and the screen-reader summary both assume — a bucket
 * labelled "today" begins today, it does not end today.
 */
function build(counts: readonly number[], endMs: number, intervalMs: number): KickSample[] {
  // Snap to the interval grid so a window taken a moment later returns the
  // same buckets rather than every point shifting slightly.
  const currentStart = Math.floor(endMs / intervalMs) * intervalMs;
  return counts.map((kicks, index) => ({
    timestamp: new Date(currentStart - (counts.length - 1 - index) * intervalMs),
    kicks,
  }));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** How many buckets each table holds — the windows are fixed, not requested. */
export const DAILY_BUCKET_COUNT = DAILY.active.length;
export const HOURLY_BUCKET_COUNT = HOURLY.active.length;
export const TREND_BUCKET_COUNT = TREND.active.length;

export function generateDailyKicks(variant: ActivityVariant, endMs: number): KickSample[] {
  return build(DAILY[variant], endMs, DAY_MS);
}

export function generateHourlyKicks(variant: ActivityVariant, endMs: number): KickSample[] {
  return build(HOURLY[variant], endMs, HOUR_MS);
}

export function generateTrendKicks(variant: ActivityVariant, endMs: number): KickSample[] {
  return build(TREND[variant], endMs, DAY_MS);
}
