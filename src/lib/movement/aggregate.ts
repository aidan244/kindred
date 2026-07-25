/**
 * Folds 4-second sensor windows into 5-minute bins. Both `activeWindows`
 * and `coveredWindows` are retained per bin — never collapsed to a single
 * boolean — so a bin at the edge of the input range, or one that overlaps
 * a coverage gap, reports exactly what it saw rather than assuming all 75
 * windows were present.
 */

import type { MovementBin, SensorWindow } from './types';

export const BIN_MINUTES = 5;
export const WINDOWS_PER_BIN = 75; // 5 minutes / 4-second windows
const BIN_MS = BIN_MINUTES * 60 * 1000;

export function aggregateToBins(windows: SensorWindow[]): MovementBin[] {
  const byBinStart = new Map<number, { activeWindows: number; coveredWindows: number }>();

  for (const window of windows) {
    const binStartMs = Math.floor(window.timestamp.getTime() / BIN_MS) * BIN_MS;
    const entry = byBinStart.get(binStartMs) ?? { activeWindows: 0, coveredWindows: 0 };

    // An uncovered window contributes to neither count — it is genuinely
    // absent data, not a negative observation (clinical safety rule 4).
    if (window.covered) {
      entry.coveredWindows += 1;
      if (window.positive) {
        entry.activeWindows += 1;
      }
    }

    byBinStart.set(binStartMs, entry);
  }

  return Array.from(byBinStart.entries())
    .sort(([a], [b]) => a - b)
    .map(([binStartMs, counts]) => ({
      t: new Date(binStartMs),
      activeWindows: counts.activeWindows,
      coveredWindows: counts.coveredWindows,
    }));
}
