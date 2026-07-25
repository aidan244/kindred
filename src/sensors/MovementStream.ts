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
// ^ UNCHANGED (design-plan.md §16.1). Do not add injection here.

/**
 * Demo-only capability, implemented by the mock stream so the demo panel can
 * put samples on the wire on cue (design-plan.md §16.1). A real hardware
 * stream will not implement it. Nothing outside src/components/DemoPanel.tsx
 * may call these.
 */
export interface InjectableMovementStream {
  /** Emits one `moved: true` sample to every subscriber, right now. */
  injectSample(): void;
  /**
   * Emits a scripted, deterministic burst. Returns a cancel function.
   * Calling it again cancels any burst already in flight, so a double-press
   * on stage does not stack two bursts.
   */
  injectBurst(options?: { count?: number; seed?: number }): () => void;
}

/** Narrows a stream to its injectable capability, or null if it has none.
 * Duck-types on the two method names, so the demo panel degrades to hiding
 * its buttons rather than crashing when a real stream is swapped in. */
export function asInjectable(stream: MovementStream): InjectableMovementStream | null {
  const candidate = stream as Partial<InjectableMovementStream>;
  if (typeof candidate.injectSample === 'function' && typeof candidate.injectBurst === 'function') {
    return candidate as InjectableMovementStream;
  }
  return null;
}

const LIVE_EMIT_INTERVAL_MS = 4000;
const BASELINE_LOOKBACK_HOURS = 24;

// injectBurst() defaults — design-plan.md §16.4, "the active spell". Do not
// "improve" these: raising count past ~9 saturates the live view's 6-ring
// cap and starts to look like weather; tightening the spacing below ~600ms
// makes it look mechanical.
const BURST_DEFAULT_COUNT = 7;
const BURST_DEFAULT_SEED = 0x4b494e44; // 'KIND' — same seed as seedActivity.ts
const BURST_BASE_SPACING_MS = 1100;
const BURST_JITTER_FLOOR = 0.55;
const BURST_JITTER_RANGE = 1.05;

/** Mulberry32 seeded PRNG — deterministic, no Math.random. Mirrors
 * src/data/seedActivity.ts's generator (not imported from there: that
 * module doesn't export it, and this is the only other place a seeded
 * sequence is needed). */
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

class MockMovementStream implements MovementStream, InjectableMovementStream {
  private subscribers = new Set<(sample: ActivitySample) => void>();
  private intervalId: number | null = null;
  private activeBurstCancel: (() => void) | null = null;

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

  /** Fans out one sample to every current subscriber. The single place any
   * sample — real or injected — reaches the outside world. */
  private emit(sample: ActivitySample): void {
    this.subscribers.forEach((cb) => cb(sample));
  }

  private emitLatest = (): void => {
    const window = this.getWindow(1);
    const latest = window[window.length - 1];
    this.emit(latest ?? { timestamp: new Date(), moved: false });
  };

  subscribe(cb: (sample: ActivitySample) => void): () => void {
    this.subscribers.add(cb);
    if (this.subscribers.size === 1 && this.intervalId === null) {
      this.intervalId = window.setInterval(this.emitLatest, LIVE_EMIT_INTERVAL_MS);
    }
    return () => {
      this.subscribers.delete(cb);
      if (this.subscribers.size === 0 && this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
    };
  }

  // -- InjectableMovementStream (design-plan.md §16.3/§16.4) --------------
  // Injected samples never touch the seed and are never read back through
  // getWindow()/getBaseline() — both of those always recompute straight
  // from generateSeedActivity. This is deliberate (§16.6): the ember band
  // and PDF must stay "a still record, not a live thing".

  injectSample(): void {
    this.emit({ timestamp: new Date(), moved: true });
  }

  injectBurst(options?: { count?: number; seed?: number }): () => void {
    // A double-press on stage must not stack two bursts.
    this.activeBurstCancel?.();

    const count = options?.count ?? BURST_DEFAULT_COUNT;
    const random = mulberry32(options?.seed ?? BURST_DEFAULT_SEED);

    let cancelled = false;
    let timeoutId: number | null = null;

    const cancel = (): void => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (this.activeBurstCancel === cancel) {
        this.activeBurstCancel = null;
      }
    };

    const scheduleNext = (remaining: number): void => {
      if (remaining <= 0 || cancelled) {
        return;
      }
      const jitter = BURST_JITTER_FLOOR + BURST_JITTER_RANGE * random();
      const delayMs = BURST_BASE_SPACING_MS * jitter; // 605-1760ms
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        this.emit({ timestamp: new Date(), moved: true });
        scheduleNext(remaining - 1);
      }, delayMs);
    };

    scheduleNext(count);
    this.activeBurstCancel = cancel;
    return cancel;
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
