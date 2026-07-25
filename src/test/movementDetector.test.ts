import { describe, expect, it } from 'vitest';
import { detect } from '../lib/movement/detector';
import type { Baseline, MovementBin } from '../lib/movement/types';

const DAY = new Date('2024-01-01T00:00:00');
const NOW = new Date('2024-01-01T06:00:00');
const FIVE_MIN_MS = 5 * 60 * 1000;

function hourlyBins(startHour: number, endHourExclusive: number, activeWindows: number): MovementBin[] {
  const bins: MovementBin[] = [];
  for (let hour = startHour; hour < endHourExclusive; hour += 1) {
    for (let minute = 0; minute < 60; minute += 5) {
      const t = new Date(DAY);
      t.setHours(hour, minute, 0, 0);
      bins.push({ t, activeWindows, coveredWindows: 75 });
    }
  }
  return bins;
}

// Hours 3, 4 and 5 are exactly the three trailing 1-hour windows ending at
// NOW (06:00) — [03:00,04:00), [04:00,05:00), [05:00,06:00) — and also
// fully cover the 4-hour trailing-coverage check ([02:00,06:00) at 75%.
const sufficientBaseline: Baseline = {
  computedAt: NOW,
  daysUsed: 7,
  sufficient: true,
  byHour: [3, 4, 5].map((hour) => ({ hour, expectedActiveFraction: 0.5, coverageFraction: 1 })),
};

// 3/75 = 0.04, well below expected(0.5) * 0.5 = 0.25.
const lowActivityBins = hourlyBins(3, 6, 3);
// 40/75 ≈ 0.53, not below the 0.25 threshold.
const normalActivityBins = hourlyBins(3, 6, 40);

describe('detect — sustained_low_rate path', () => {
  it('fires when the active fraction is sustained below half of expected, with adequate coverage', () => {
    const firing = detect(lowActivityBins, sufficientBaseline, NOW, {
      lastAlertAt: null,
      sessionOpen: false,
    });
    expect(firing?.rule).toBe('sustained_low_rate');
  });

  it('is silent when baseline.sufficient is false, even though the rate would otherwise trigger', () => {
    const insufficientBaseline: Baseline = { ...sufficientBaseline, sufficient: false };
    expect(
      detect(lowActivityBins, insufficientBaseline, NOW, { lastAlertAt: null, sessionOpen: false })
    ).toBeNull();
  });

  it('is silent when trailing 4-hour coverage is below 0.7', () => {
    const sparseBins = hourlyBins(5, 6, 3); // only 1 of the trailing 4 hours has any data
    expect(
      detect(sparseBins, sufficientBaseline, NOW, { lastAlertAt: null, sessionOpen: false })
    ).toBeNull();
  });

  it('is silent inside the 6-hour refractory period', () => {
    const lastAlertAt = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
    expect(
      detect(lowActivityBins, sufficientBaseline, NOW, { lastAlertAt, sessionOpen: false })
    ).toBeNull();
  });

  it('fires again once the refractory period has fully elapsed', () => {
    const lastAlertAt = new Date(NOW.getTime() - 7 * 60 * 60 * 1000);
    expect(
      detect(lowActivityBins, sufficientBaseline, NOW, { lastAlertAt, sessionOpen: false })
    ).not.toBeNull();
  });

  it('is silent when a session is currently open, even if every other condition is met', () => {
    expect(
      detect(lowActivityBins, sufficientBaseline, NOW, { lastAlertAt: null, sessionOpen: true })
    ).toBeNull();
  });

  it('is silent when the observed rate is not actually below half of expected', () => {
    expect(
      detect(normalActivityBins, sufficientBaseline, NOW, { lastAlertAt: null, sessionOpen: false })
    ).toBeNull();
  });

  it('never fires on a genuinely healthy trace across every hour of the day', () => {
    // Sweep NOW across all 24 hours with matching baseline entries and
    // observed activity equal to expected — should never trigger.
    for (let hour = 3; hour < 24; hour += 1) {
      const now = new Date(DAY);
      now.setHours(hour, 0, 0, 0);
      const baseline: Baseline = {
        computedAt: now,
        daysUsed: 7,
        sufficient: true,
        byHour: [hour - 3, hour - 2, hour - 1].map((h) => ({
          hour: h,
          expectedActiveFraction: 0.5,
          coverageFraction: 1,
        })),
      };
      const bins = hourlyBins(hour - 3, hour, 40); // matches expected, not below threshold
      expect(detect(bins, baseline, now, { lastAlertAt: null, sessionOpen: false })).toBeNull();
    }
  });
});

describe('detect — extended_quiet path', () => {
  function seq(start: Date, count: number, activeWindows: number): MovementBin[] {
    return Array.from({ length: count }, (_, i) => ({
      t: new Date(start.getTime() + i * FIVE_MIN_MS),
      activeWindows,
      coveredWindows: 75,
    }));
  }

  const t = (iso: string): Date => new Date(iso);

  // Historical quiet spells of 10, 15 and 20 minutes (separated by short
  // active breaks), then a 240-minute ongoing quiet spell running right up
  // to NOW — well above the ~20-minute 95th percentile of the history.
  const extendedQuietBins: MovementBin[] = [
    ...seq(t('2024-01-01T04:00:00'), 2, 0),
    ...seq(t('2024-01-01T04:10:00'), 1, 5),
    ...seq(t('2024-01-01T04:15:00'), 3, 0),
    ...seq(t('2024-01-01T04:30:00'), 1, 5),
    ...seq(t('2024-01-01T04:35:00'), 4, 0),
    ...seq(t('2024-01-01T04:55:00'), 1, 5),
    ...seq(t('2024-01-01T05:00:00'), 48, 0),
  ];
  const NOW_EXTENDED = t('2024-01-01T09:00:00');
  // Empty byHour deliberately defaults expected-active-fraction to 0
  // everywhere, so the sustained_low_rate path can never trigger here —
  // isolating this test to the extended_quiet path on its own.
  const baselineWithNoHourlyExpectation: Baseline = {
    computedAt: NOW_EXTENDED,
    daysUsed: 7,
    sufficient: true,
    byHour: [],
  };

  it('fires when an ongoing quiet spell exceeds her personal 95th percentile, with adequate coverage', () => {
    const firing = detect(extendedQuietBins, baselineWithNoHourlyExpectation, NOW_EXTENDED, {
      lastAlertAt: null,
      sessionOpen: false,
    });
    expect(firing?.rule).toBe('extended_quiet');
  });

  it('is silent when there is no prior history to compare the ongoing spell against', () => {
    const onlyOngoing = seq(t('2024-01-01T05:00:00'), 48, 0);
    expect(
      detect(onlyOngoing, baselineWithNoHourlyExpectation, NOW_EXTENDED, {
        lastAlertAt: null,
        sessionOpen: false,
      })
    ).toBeNull();
  });
});
