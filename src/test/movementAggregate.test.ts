import { describe, expect, it } from 'vitest';
import { aggregateToBins } from '../lib/movement/aggregate';
import type { SensorWindow } from '../lib/movement/types';

const BIN_START = new Date('2024-01-01T00:00:00.000');

function windowAt(offsetSeconds: number, positive: boolean, covered: boolean): SensorWindow {
  return { timestamp: new Date(BIN_START.getTime() + offsetSeconds * 1000), positive, covered };
}

describe('aggregateToBins', () => {
  it('folds 75 four-second windows into one 5-minute bin', () => {
    const windows: SensorWindow[] = Array.from({ length: 75 }, (_, i) =>
      windowAt(i * 4, i % 5 === 0, true)
    );

    const bins = aggregateToBins(windows);

    expect(bins).toHaveLength(1);
    expect(bins[0].coveredWindows).toBe(75);
    expect(bins[0].activeWindows).toBe(15); // every 5th of 75
    expect(bins[0].t.getTime()).toBe(BIN_START.getTime());
  });

  it('preserves coverage through a partial bin rather than assuming all 75 windows exist', () => {
    const windows: SensorWindow[] = [
      ...Array.from({ length: 40 }, (_, i) => windowAt(i * 4, i === 0, true)),
      ...Array.from({ length: 20 }, (_, i) => windowAt((40 + i) * 4, false, false)),
    ];

    const bins = aggregateToBins(windows);

    expect(bins).toHaveLength(1);
    expect(bins[0].coveredWindows).toBe(40);
    expect(bins[0].activeWindows).toBe(1);
  });

  it('never counts an uncovered window as active, even if positive is somehow set on it', () => {
    const bins = aggregateToBins([windowAt(0, true, false)]);
    expect(bins[0].coveredWindows).toBe(0);
    expect(bins[0].activeWindows).toBe(0);
  });

  it('splits windows spanning a bin boundary into two bins', () => {
    const windows: SensorWindow[] = [
      windowAt(0, true, true),
      windowAt(296, true, true), // still inside [0, 300)
      windowAt(300, true, true), // exactly the next 5-minute bin
    ];

    const bins = aggregateToBins(windows);

    expect(bins).toHaveLength(2);
    expect(bins[0].coveredWindows).toBe(2);
    expect(bins[1].coveredWindows).toBe(1);
  });
});
