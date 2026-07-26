import { describe, expect, it } from 'vitest';
import { detectKickReduction } from '../lib/movement/kickDetector';
import type { KickBaseline } from '../lib/movement/types';
import type { KickSample, KickWindow } from '../types';

const NOW = new Date('2026-01-15T12:00:00');
const DAY_MS = 24 * 60 * 60 * 1000;

function dailyWindow(counts: number[]): KickWindow {
  const samples: KickSample[] = counts.map((kicks, index) => ({
    timestamp: new Date(NOW.getTime() - (counts.length - 1 - index) * DAY_MS),
    kicks,
  }));
  return { samples, settledIndex: Math.max(0, samples.length - 2) };
}

const sufficientBaseline: KickBaseline = {
  computedAt: NOW,
  daysUsed: 20,
  sufficient: true,
  meanKicksPerDay: 200,
};

// Recent 3 days average 40 (three complete days at 40,40,40, plus a
// partial "today" that's excluded either way) — well below 200 * 0.5 = 100.
const reducedWindow = dailyWindow([...Array(20).fill(200), 40, 40, 40, 15]);
// Recent 3 days average 190 — close to baseline, not below the 100 threshold.
const normalWindow = dailyWindow([...Array(20).fill(200), 190, 190, 190, 60]);

describe('detectKickReduction', () => {
  it('fires when the recent 3-day mean is below half of her baseline, with a sufficient baseline', () => {
    const firing = detectKickReduction(reducedWindow, sufficientBaseline, NOW, {
      lastAlertAt: null,
      sessionOpen: false,
    });
    expect(firing?.rule).toBe('reduced_kick_rate');
  });

  it('reports the exact observed/expected/threshold arithmetic on a known fixture', () => {
    const firing = detectKickReduction(reducedWindow, sufficientBaseline, NOW, {
      lastAlertAt: null,
      sessionOpen: false,
    });
    expect(firing).toMatchObject({
      detectorVersion: 'kick-detector-v1',
      rule: 'reduced_kick_rate',
      observed: 40,
      expected: 200,
      threshold: 100,
      coverageFraction: 1,
    });
    expect(firing?.windowTo).toEqual(NOW);
  });

  it('is silent when baseline.sufficient is false, even though the rate would otherwise trigger', () => {
    const insufficientBaseline: KickBaseline = { ...sufficientBaseline, sufficient: false };
    expect(
      detectKickReduction(reducedWindow, insufficientBaseline, NOW, {
        lastAlertAt: null,
        sessionOpen: false,
      })
    ).toBeNull();
  });

  it('is silent when the recent mean is not actually below the threshold', () => {
    expect(
      detectKickReduction(normalWindow, sufficientBaseline, NOW, {
        lastAlertAt: null,
        sessionOpen: false,
      })
    ).toBeNull();
  });

  it('is silent when a session is currently open, even if every other condition is met', () => {
    expect(
      detectKickReduction(reducedWindow, sufficientBaseline, NOW, {
        lastAlertAt: null,
        sessionOpen: true,
      })
    ).toBeNull();
  });

  it('is silent inside the refractory period', () => {
    const lastAlertAt = new Date(NOW.getTime() - 5 * 60 * 60 * 1000); // 5h ago, refractory is 20h
    expect(
      detectKickReduction(reducedWindow, sufficientBaseline, NOW, { lastAlertAt, sessionOpen: false })
    ).toBeNull();
  });

  it('fires again once the refractory period has fully elapsed', () => {
    const lastAlertAt = new Date(NOW.getTime() - 21 * 60 * 60 * 1000); // 21h ago
    expect(
      detectKickReduction(reducedWindow, sufficientBaseline, NOW, { lastAlertAt, sessionOpen: false })
    ).not.toBeNull();
  });

  it('is silent on an empty (no-signal) window', () => {
    const emptyWindow: KickWindow = { samples: [], settledIndex: -1 };
    expect(
      detectKickReduction(emptyWindow, sufficientBaseline, NOW, { lastAlertAt: null, sessionOpen: false })
    ).toBeNull();
  });

  it('never fires when recent days exactly match the baseline', () => {
    const flatWindow = dailyWindow([...Array(20).fill(200), 200, 200, 200, 80]);
    expect(
      detectKickReduction(flatWindow, sufficientBaseline, NOW, { lastAlertAt: null, sessionOpen: false })
    ).toBeNull();
  });
});
