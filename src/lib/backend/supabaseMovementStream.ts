/**
 * Supabase-backed MovementStream. Satisfies the exact same interface as
 * src/sensors/MovementStream.ts's mock implementation — subscribe /
 * getWindow / getBaseline, all synchronous — by priming an in-memory cache
 * with one async fetch at construction, then keeping it warm via a
 * Supabase Realtime subscription on `movement_bins` inserts. Nothing about
 * the public interface is async; the network only happens at construction
 * and in the background thereafter.
 *
 * Not wired into src/sensors/MovementStream.ts's getMovementStream()
 * factory — that file is frontend-owned and untouched, per the standing
 * "no frontend files touched" constraint carried through every phase of
 * this backend work. This class is delivered standalone, ready to be
 * dropped in behind that factory by whoever owns it.
 *
 * Coverage reconciliation (same as supabaseBackend.ts): an uncovered bin
 * (`covered_windows = 0`) is dropped entirely, never reported as
 * `moved: false` — clinical safety rule 4.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ActivitySample } from '../../types';
import type { MovementStream } from '../../sensors/MovementStream';

interface MovementBinRow {
  t: string;
  active_windows: number;
  covered_windows: number;
}

// Wide enough to answer getBaseline() (which needs data older than the most
// recent 24h, per the same semantics as the frontend's own
// MockMovementStream.getBaseline()) entirely from the in-memory cache, with
// no second async fetch — getBaseline() must stay synchronous to satisfy
// the MovementStream interface.
const CACHE_WINDOW_HOURS = 8 * 24;
const BASELINE_CUTOFF_HOURS = 24;

function rowToSample(row: MovementBinRow): ActivitySample | null {
  if (row.covered_windows === 0) {
    return null;
  }
  return { timestamp: new Date(row.t), moved: row.active_windows > 0 };
}

export class SupabaseMovementStream implements MovementStream {
  private cache: ActivitySample[] = [];
  private readonly subscribers = new Set<(sample: ActivitySample) => void>();
  private channel: RealtimeChannel | null = null;
  private readonly ready: Promise<void>;

  constructor(
    private readonly client: SupabaseClient,
    private readonly patientId: string
  ) {
    this.ready = this.prime();
    this.subscribeRealtime();
  }

  /** Resolves once the initial cache fetch completes. The MovementStream
   * interface itself stays fully synchronous — this is an escape hatch for
   * a caller that wants to guarantee data is present before first render,
   * not part of the contract other code should depend on. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  private async prime(): Promise<void> {
    const since = new Date(Date.now() - CACHE_WINDOW_HOURS * 60 * 60 * 1000);
    const { data, error } = await this.client
      .from('movement_bins')
      .select('t, active_windows, covered_windows')
      .eq('patient_id', this.patientId)
      .gte('t', since.toISOString())
      .order('t', { ascending: true });
    if (error) {
      console.error('SupabaseMovementStream: initial fetch failed', error);
      return;
    }
    this.cache = ((data as MovementBinRow[] | null) ?? [])
      .map(rowToSample)
      .filter((sample): sample is ActivitySample => sample !== null);
  }

  private subscribeRealtime(): void {
    this.channel = this.client
      .channel(`movement-bins-${this.patientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'movement_bins',
          filter: `patient_id=eq.${this.patientId}`,
        },
        (payload: { new: MovementBinRow }) => {
          const sample = rowToSample(payload.new);
          if (!sample) {
            return; // uncovered bin: absent data, not a "no movement" sample
          }
          const cutoffMs = Date.now() - CACHE_WINDOW_HOURS * 60 * 60 * 1000;
          this.cache = [...this.cache.filter((s) => s.timestamp.getTime() >= cutoffMs), sample];
          for (const subscriber of this.subscribers) {
            subscriber(sample);
          }
        }
      )
      .subscribe();
  }

  subscribe(cb: (sample: ActivitySample) => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  getWindow(hours: number): ActivitySample[] {
    const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
    return this.cache.filter((sample) => sample.timestamp.getTime() >= cutoffMs);
  }

  /** Mirrors MockMovementStream.getBaseline() exactly: her personal
   * typical movement level, taken from the pattern outside of the most
   * recent day, so a quiet spell can be compared against what's normal for
   * her rather than against itself. */
  getBaseline(): number {
    const cutoffMs = Date.now() - BASELINE_CUTOFF_HOURS * 60 * 60 * 1000;
    const priorSamples = this.cache.filter((sample) => sample.timestamp.getTime() < cutoffMs);
    if (priorSamples.length === 0) {
      return 0;
    }
    const movedCount = priorSamples.filter((sample) => sample.moved).length;
    return movedCount / priorSamples.length;
  }

  /** Not part of the MovementStream interface — call this when a screen
   * that constructed its own SupabaseMovementStream unmounts, so the
   * Realtime channel doesn't leak. */
  dispose(): void {
    this.channel?.unsubscribe();
    this.channel = null;
  }
}
