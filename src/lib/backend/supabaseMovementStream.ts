/**
 * Supabase-backed MovementStream. Satisfies the exact same interface as
 * src/sensors/MovementStream.ts's mock implementation — subscribe /
 * getWindow / getBaseline / the three kick windows / hasSignal, all
 * synchronous — by priming in-memory caches with async fetches at
 * construction, then keeping them warm via Supabase Realtime subscriptions
 * on `movement_bins` and `kick_intervals`. Nothing about the public
 * interface is async; the network only happens at construction and in the
 * background thereafter.
 *
 * Wired into src/sensors/MovementStream.ts's getMovementStream() factory —
 * see that file's VITE_BACKEND branch.
 *
 * Coverage reconciliation (same as supabaseBackend.ts): an uncovered bin
 * (`covered_windows = 0`) is dropped entirely, never reported as
 * `moved: false` — clinical safety rule 4.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { ActivitySample, KickSample, KickWindow } from '../../types';
import type { MovementStream } from '../../sensors/MovementStream';

interface MovementBinRow {
  t: string;
  active_windows: number;
  covered_windows: number;
}

interface KickIntervalRow {
  interval_start: string;
  interval_kind: 'hour' | 'day';
  kicks: number;
}

// Wide enough to answer getBaseline() (which needs data older than the most
// recent 24h, per the same semantics as the frontend's own
// MockMovementStream.getBaseline()) entirely from the in-memory cache, with
// no second async fetch — getBaseline() must stay synchronous to satisfy
// the MovementStream interface.
const CACHE_WINDOW_HOURS = 8 * 24;
const BASELINE_CUTOFF_HOURS = 24;

// Fixed bucket counts, matching src/data/seedKicks.ts's DAILY_BUCKET_COUNT /
// HOURLY_BUCKET_COUNT / TREND_BUCKET_COUNT exactly — the windows are fixed
// questions, not a span the caller requests (see MovementStream.ts's own
// comment on why neither kick method takes a parameter).
const DAILY_KICK_LIMIT = 7;
const HOURLY_KICK_LIMIT = 12;
const TREND_KICK_LIMIT = 84;

// How stale the most recent covered movement bin can be before this class
// reports the band as offline. Bins are 5-minute aligned (001_core.sql); a
// few missed cycles' grace avoids flapping to "no signal" on ordinary
// ingest lag rather than an actual dropped link.
const SIGNAL_RECENCY_MS = 15 * 60 * 1000;

function rowToSample(row: MovementBinRow): ActivitySample | null {
  if (row.covered_windows === 0) {
    return null;
  }
  return { timestamp: new Date(row.t), moved: row.active_windows > 0 };
}

function rowToKickSample(row: KickIntervalRow): KickSample {
  return { timestamp: new Date(row.interval_start), kicks: row.kicks };
}

export class SupabaseMovementStream implements MovementStream {
  private cache: ActivitySample[] = [];
  private dailyKicks: KickSample[] = [];
  private hourlyKicks: KickSample[] = [];
  private trendKicks: KickSample[] = [];
  private readonly subscribers = new Set<(sample: ActivitySample) => void>();
  private channel: RealtimeChannel | null = null;
  private kickChannel: RealtimeChannel | null = null;
  private readonly ready: Promise<void>;

  constructor(
    private readonly client: SupabaseClient,
    private readonly patientId: string
  ) {
    this.ready = this.prime();
    this.subscribeRealtime();
    this.subscribeKickRealtime();
  }

  // -- Kicks ---------------------------------------------------------------
  // Backed by kick_intervals (004_kick_intervals.sql): one table, two
  // interval kinds ('day', 'hour'), queried "most recent N of this kind,
  // oldest first" for each of the three fixed windows the interface exposes.

  /**
   * Shared by all three kick windows — mirrors MockMovementStream's helper
   * of the same name exactly, including `settledIndex = samples.length - 2`.
   * The newest interval (today, or the current hour) is a TALLY OVER AN
   * INTERVAL THAT HAS NOT FINISHED YET, which is true of any real ingest
   * pipeline upserting a running count as kicks arrive — not a mock-only
   * concern, see 004_kick_intervals.sql's header.
   */
  private kickWindow(samples: KickSample[]): KickWindow {
    if (!this.hasSignal() || samples.length === 0) {
      return { samples: [], settledIndex: -1 };
    }
    return { samples, settledIndex: Math.max(0, samples.length - 2) };
  }

  getDailyKickWindow(): KickWindow {
    return this.kickWindow(this.dailyKicks);
  }

  getHourlyKickWindow(): KickWindow {
    return this.kickWindow(this.hourlyKicks);
  }

  getTrendKickWindow(): KickWindow {
    return this.kickWindow(this.trendKicks);
  }

  /** Derived from ingest liveness — the most recent covered movement bin in
   * the cache — not a stored flag, the honest version of what the mock's
   * setBandSignal() fakes for the demo. Movement bins are the finer-grained
   * of the real signals (5-minute cadence vs. kicks' hourly/daily tallies),
   * so they notice a dropped link faster; the kick windows above are gated
   * on this same answer rather than deriving their own. */
  hasSignal(): boolean {
    const latest = this.cache[this.cache.length - 1];
    if (!latest) {
      return false;
    }
    return Date.now() - latest.timestamp.getTime() <= SIGNAL_RECENCY_MS;
  }

  /** Resolves once the initial cache fetch completes. The MovementStream
   * interface itself stays fully synchronous — this is an escape hatch for
   * a caller that wants to guarantee data is present before first render,
   * not part of the contract other code should depend on. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  private async fetchKickSamples(kind: 'hour' | 'day', limit: number): Promise<KickSample[]> {
    const { data, error } = await this.client
      .from('kick_intervals')
      .select('interval_start, interval_kind, kicks')
      .eq('patient_id', this.patientId)
      .eq('interval_kind', kind)
      .order('interval_start', { ascending: false })
      .limit(limit);
    if (error) {
      console.error(`SupabaseMovementStream: initial ${kind} kick fetch failed`, error);
      return [];
    }
    // Queried most-recent-first (the index kick_intervals_recent is built
    // on); reversed here so every caller sees oldest-first, matching
    // KickWindow's contract.
    return ((data as KickIntervalRow[] | null) ?? []).map(rowToKickSample).reverse();
  }

  private async refetchKicks(): Promise<void> {
    // A single changed row can affect more than one cached window (a 'day'
    // row belongs to both the 7-bucket daily window and the 84-bucket trend
    // window), and at most one row per patient changes per hour/day — a
    // fresh fetch of both 'day'-kind windows plus the hourly one is simpler
    // and safer than patching an INSERT-vs-UPDATE distinction into three
    // caches by hand, and costs nothing at this write rate.
    const [trend, hourly] = await Promise.all([
      this.fetchKickSamples('day', TREND_KICK_LIMIT),
      this.fetchKickSamples('hour', HOURLY_KICK_LIMIT),
    ]);
    this.trendKicks = trend;
    this.dailyKicks = trend.slice(-DAILY_KICK_LIMIT);
    this.hourlyKicks = hourly;
  }

  private async prime(): Promise<void> {
    const since = new Date(Date.now() - CACHE_WINDOW_HOURS * 60 * 60 * 1000);
    const [movementResult, trend, hourly] = await Promise.all([
      this.client
        .from('movement_bins')
        .select('t, active_windows, covered_windows')
        .eq('patient_id', this.patientId)
        .gte('t', since.toISOString())
        .order('t', { ascending: true }),
      this.fetchKickSamples('day', TREND_KICK_LIMIT),
      this.fetchKickSamples('hour', HOURLY_KICK_LIMIT),
    ]);
    const { data, error } = movementResult;
    if (error) {
      console.error('SupabaseMovementStream: initial movement fetch failed', error);
    } else {
      this.cache = ((data as MovementBinRow[] | null) ?? [])
        .map(rowToSample)
        .filter((sample): sample is ActivitySample => sample !== null);
    }
    this.trendKicks = trend;
    // The 7 most recent day-tallies are the newest slice of the same 84
    // fetched above — one query, not two, and no risk of the two windows
    // disagreeing if a row lands between two separate requests.
    this.dailyKicks = trend.slice(-DAILY_KICK_LIMIT);
    this.hourlyKicks = hourly;
  }

  private subscribeKickRealtime(): void {
    this.kickChannel = this.client
      .channel(`kick-intervals-${this.patientId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT for a new interval, UPDATE as the current one's tally grows
          schema: 'public',
          table: 'kick_intervals',
          filter: `patient_id=eq.${this.patientId}`,
        },
        () => {
          void this.refetchKicks();
        }
      )
      .subscribe();
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
   * Realtime channels don't leak. */
  dispose(): void {
    this.channel?.unsubscribe();
    this.channel = null;
    this.kickChannel?.unsubscribe();
    this.kickChannel = null;
  }
}
