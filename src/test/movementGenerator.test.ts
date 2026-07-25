import { describe, expect, it } from 'vitest';
import { generateMovement } from '../lib/movement/generator';
import { FALSE_POSITIVE_RATE, SENSITIVITY } from '../lib/movement/constants';

// Statistical tests over a simulated run — not exact-value assertions, but
// tight enough that a broken error model (e.g. sensitivity accidentally
// swapped with specificity, or not applied at all) fails loudly.
const TOLERANCE = 0.03;

describe('generateMovement — sensitivity round-trip', () => {
  it('observed positive rate for true-event windows sits within tolerance of the sensitivity constant', () => {
    const { sensorWindows, groundTruthWindows } = generateMovement({
      seed: 42,
      from: new Date('2024-01-01T00:00:00'),
      to: new Date('2024-01-04T00:00:00'),
      activeRatePerMinute: 4, // dialed up so 3 simulated days give a stable sample
    });

    const coveredTrueEventWindows = sensorWindows.filter(
      (window, i) => groundTruthWindows[i] && window.covered
    );
    expect(coveredTrueEventWindows.length).toBeGreaterThan(1000); // sanity: enough samples

    const observedPositiveRate =
      coveredTrueEventWindows.filter((window) => window.positive).length /
      coveredTrueEventWindows.length;

    expect(observedPositiveRate).toBeGreaterThan(SENSITIVITY - TOLERANCE);
    expect(observedPositiveRate).toBeLessThan(SENSITIVITY + TOLERANCE);
  });

  it('observed false-positive rate for non-event windows sits within tolerance of (1 - specificity)', () => {
    const { sensorWindows, groundTruthWindows } = generateMovement({
      seed: 42,
      from: new Date('2024-01-01T00:00:00'),
      to: new Date('2024-01-04T00:00:00'),
      activeRatePerMinute: 4,
    });

    const coveredNonEventWindows = sensorWindows.filter(
      (window, i) => !groundTruthWindows[i] && window.covered
    );
    expect(coveredNonEventWindows.length).toBeGreaterThan(1000);

    const observedFalsePositiveRate =
      coveredNonEventWindows.filter((window) => window.positive).length /
      coveredNonEventWindows.length;

    expect(observedFalsePositiveRate).toBeGreaterThan(FALSE_POSITIVE_RATE - TOLERANCE);
    expect(observedFalsePositiveRate).toBeLessThan(FALSE_POSITIVE_RATE + TOLERANCE);
  });

  it('never reports a positive classification on an uncovered window', () => {
    const { sensorWindows } = generateMovement({
      seed: 7,
      from: new Date('2024-01-01T00:00:00'),
      to: new Date('2024-01-08T00:00:00'),
    });
    expect(sensorWindows.some((window) => !window.covered && window.positive)).toBe(false);
  });

  it('produces realistic (88-92%-ish) overall coverage, not 100%', () => {
    const { sensorWindows } = generateMovement({
      seed: 7,
      from: new Date('2024-01-01T00:00:00'),
      to: new Date('2024-01-08T00:00:00'),
    });
    const coverageFraction =
      sensorWindows.filter((window) => window.covered).length / sensorWindows.length;
    expect(coverageFraction).toBeGreaterThan(0.8);
    expect(coverageFraction).toBeLessThan(0.98);
  });

  it('is fully deterministic for a given seed', () => {
    const options = {
      seed: 123,
      from: new Date('2024-01-01T00:00:00'),
      to: new Date('2024-01-02T00:00:00'),
    };
    const first = generateMovement(options);
    const second = generateMovement(options);
    expect(first.sensorWindows.map((w) => w.positive)).toEqual(
      second.sensorWindows.map((w) => w.positive)
    );
    expect(first.sensorWindows.map((w) => w.covered)).toEqual(
      second.sensorWindows.map((w) => w.covered)
    );
  });
});
