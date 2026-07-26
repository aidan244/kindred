import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMovementStream,
  resetMovementStreamForTests,
  setBandSignal,
} from '../sensors/MovementStream';
import { TREND_BUCKET_COUNT, generateTrendKicks } from '../data/seedKicks';

afterEach(() => {
  setBandSignal(true);
  resetMovementStreamForTests();
  vi.unstubAllEnvs();
});

describe('generateTrendKicks', () => {
  it('returns TREND_BUCKET_COUNT (84) samples, oldest first, one day apart', () => {
    const endMs = new Date('2026-03-01T12:00:00').getTime();
    const samples = generateTrendKicks('active', endMs);

    expect(samples).toHaveLength(TREND_BUCKET_COUNT);
    expect(samples).toHaveLength(84);
    for (let i = 1; i < samples.length; i += 1) {
      const gapMs = samples[i].timestamp.getTime() - samples[i - 1].timestamp.getTime();
      expect(gapMs).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('the last bucket is lower than its neighbour — today is still counting', () => {
    const endMs = Date.now();
    const active = generateTrendKicks('active', endMs);
    const quiet = generateTrendKicks('quiet', endMs);
    expect(active[active.length - 1].kicks).toBeLessThan(active[active.length - 2].kicks);
    expect(quiet[quiet.length - 1].kicks).toBeLessThan(quiet[quiet.length - 2].kicks);
  });

  it('snaps to the daily grid — two reads a moment apart return the same buckets', () => {
    const first = generateTrendKicks('active', Date.now());
    const second = generateTrendKicks('active', Date.now() + 5000);
    expect(second[second.length - 1].timestamp.getTime()).toBe(first[first.length - 1].timestamp.getTime());
  });
});

describe('MockMovementStream.getTrendKickWindow (mock backend)', () => {
  it('returns 84 samples with settledIndex on the last complete day', () => {
    const window = getMovementStream('active').getTrendKickWindow();
    expect(window.samples).toHaveLength(84);
    expect(window.settledIndex).toBe(82); // length - 2
  });

  it('is empty when the band has no signal — same contract as the other two kick windows', () => {
    setBandSignal(false);
    const window = getMovementStream('active').getTrendKickWindow();
    expect(window).toEqual({ samples: [], settledIndex: -1 });
  });

  it('quiet and active variants produce different kick counts from independent seed tables', () => {
    const active = getMovementStream('active').getTrendKickWindow();
    const quiet = getMovementStream('quiet').getTrendKickWindow();
    expect(active.samples[0].kicks).not.toBe(quiet.samples[0].kicks);
  });
});

describe('getMovementStream — VITE_BACKEND branching', () => {
  it('variant is a real switch in mock mode: same variant returns the same cached instance', () => {
    vi.stubEnv('VITE_BACKEND', 'mock');
    const first = getMovementStream('active');
    const second = getMovementStream('active');
    const third = getMovementStream('quiet');
    expect(first).toBe(second);
    expect(first).not.toBe(third);
  });

  it('in supabase mode, variant is ignored — every call returns the same singleton', () => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const first = getMovementStream('active');
    const second = getMovementStream('quiet');
    expect(first).toBe(second);
  });

  it('with missing Supabase config, getMovementStream() still returns synchronously and reports absence rather than throwing', () => {
    // The synchronous contract matters here: screens call this directly
    // from render, so it must never throw even when misconfigured — see
    // PendingSupabaseMovementStream's own doc comment on why this differs
    // from getHeldBackend()'s throw-on-missing-config behaviour.
    vi.stubEnv('VITE_BACKEND', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const stream = getMovementStream('active');
    expect(stream.hasSignal()).toBe(false);
    expect(stream.getWindow(24)).toEqual([]);
    expect(stream.getBaseline()).toBe(0);
    expect(stream.getDailyKickWindow()).toEqual({ samples: [], settledIndex: -1 });
    expect(stream.getHourlyKickWindow()).toEqual({ samples: [], settledIndex: -1 });
    expect(stream.getTrendKickWindow()).toEqual({ samples: [], settledIndex: -1 });
  });
});
