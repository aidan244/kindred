/**
 * Sensor boundary.
 *
 * This is the ONLY place the app talks to "the wearable". Everything else
 * (screens, logic) should go through the MovementStream interface below, so
 * that a real hardware/API integration can be swapped in later by writing a
 * new implementation of this same interface — no other file should need to
 * change.
 *
 * The mock implementation here reads from the seeded data generator for
 * whichever activity variant the demo panel currently has selected.
 */

import type { ActivitySample, ActivityVariant } from '../types';
import { generateSeedActivity } from '../data/seedActivity';

export interface MovementStream {
  /** Subscribes to a live sample stream. Returns an unsubscribe function. */
  subscribe(cb: (sample: ActivitySample) => void): () => void;
  /** Returns all samples within the last `hours`, oldest first. */
  getWindow(hours: number): ActivitySample[];
  /** Her personal typical (baseline) movement level, as a 0-1 fraction. */
  getBaseline(): number;
}

const LIVE_EMIT_INTERVAL_MS = 4000;
const BASELINE_LOOKBACK_HOURS = 24;

class MockMovementStream implements MovementStream {
  constructor(private variant: ActivityVariant) {}

  getWindow(hours: number): ActivitySample[] {
    const now = new Date();
    const cutoffMs = now.getTime() - hours * 60 * 60 * 1000;
    return generateSeedActivity(this.variant, now).filter(
      (sample) => sample.timestamp.getTime() >= cutoffMs
    );
  }

  getBaseline(): number {
    // Her personal typical movement level, taken from the normal ('active')
    // pattern outside of the most recent day, so a quiet spell can be
    // compared against what's normal for her rather than against itself.
    const now = new Date();
    const cutoffMs = now.getTime() - BASELINE_LOOKBACK_HOURS * 60 * 60 * 1000;
    const priorSamples = generateSeedActivity('active', now).filter(
      (sample) => sample.timestamp.getTime() < cutoffMs
    );
    if (priorSamples.length === 0) {
      return 0;
    }
    const movedCount = priorSamples.filter((sample) => sample.moved).length;
    return movedCount / priorSamples.length;
  }

  subscribe(cb: (sample: ActivitySample) => void): () => void {
    const emitLatest = (): void => {
      const window = this.getWindow(1);
      const latest = window[window.length - 1];
      cb(latest ?? { timestamp: new Date(), moved: false });
    };
    const intervalId = window.setInterval(emitLatest, LIVE_EMIT_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }
}

const instances = new Map<ActivityVariant, MockMovementStream>();

/**
 * Returns the MovementStream for the given seeded activity variant. Backed
 * by mock data now; a real integration would provide the same interface
 * from actual hardware/an API and this factory would return that instead.
 */
export function getMovementStream(variant: ActivityVariant): MovementStream {
  let instance = instances.get(variant);
  if (!instance) {
    instance = new MockMovementStream(variant);
    instances.set(variant, instance);
  }
  return instance;
}
