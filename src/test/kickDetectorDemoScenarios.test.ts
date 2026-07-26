/**
 * The one test in this feature that actually protects the demo. It runs
 * the real seeded data for both ActivityVariants through the real
 * baseline/detector pipeline exactly as DemoPanel.tsx's "Run RFM check"
 * button does, and locks in which one fires. A future "helpful" reseed of
 * src/data/seedKicks.ts or a threshold tweak in
 * src/lib/movement/constants.ts that silently breaks the demo script fails
 * here, not on stage.
 */
import { describe, expect, it } from 'vitest';
import { computeKickBaseline } from '../lib/movement/kickBaseline';
import { detectKickReduction } from '../lib/movement/kickDetector';
import { getMovementStream } from '../sensors/MovementStream';
import type { ActivityVariant } from '../types';

describe('kick detector demo scenarios', () => {
  it.each<[ActivityVariant, boolean]>([
    ['quiet', true],
    ['active', false],
  ])('%s variant firing matches the demo script (shouldFire=%s)', (variant, shouldFire) => {
    const now = new Date();
    const window = getMovementStream(variant).getTrendKickWindow();
    const baseline = computeKickBaseline(window, now);
    expect(baseline.sufficient).toBe(true);

    const firing = detectKickReduction(window, baseline, now, {
      lastAlertAt: null,
      sessionOpen: false,
    });
    expect(firing !== null).toBe(shouldFire);
  });
});
