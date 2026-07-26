import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseMovementStream } from '../lib/backend/supabaseMovementStream';

interface FakeMovementRow {
  t: string;
  active_windows: number;
  covered_windows: number;
}

interface FakeKickRow {
  interval_start: string;
  interval_kind: 'hour' | 'day';
  kicks: number;
}

/** A minimal fake satisfying only the query/channel chains
 * SupabaseMovementStream actually calls — not a general Supabase mock.
 * Table-aware: `movement_bins` gets the select/eq/gte/order chain (order is
 * terminal, matching the real query shape), `kick_intervals` gets
 * select/eq/eq/order/limit (limit is terminal) and replicates the real
 * "most recent N of this kind" query — sorted descending by interval_start,
 * then sliced — so fetchKickSamples()'s own .reverse() produces the same
 * oldest-first order a real Supabase response would. */
function createFakeClient(
  movementRows: FakeMovementRow[],
  kickRows: FakeKickRow[] = []
): {
  client: SupabaseClient;
  emitMovementInsert: (row: FakeMovementRow) => void;
  emitKickChange: () => void;
  movementUnsubscribeSpy: ReturnType<typeof vi.fn>;
  kickUnsubscribeSpy: ReturnType<typeof vi.fn>;
} {
  const movementHandlers: Array<(payload: { new: FakeMovementRow }) => void> = [];
  const kickHandlers: Array<() => void> = [];
  const movementUnsubscribeSpy = vi.fn();
  const kickUnsubscribeSpy = vi.fn();

  function buildKickQuery() {
    let kind: 'hour' | 'day' | null = null;
    const builder = {
      select: () => builder,
      eq: (column: string, value: string) => {
        if (column === 'interval_kind') {
          kind = value as 'hour' | 'day';
        }
        return builder;
      },
      order: () => builder,
      limit: (n: number) => {
        const matching = kickRows
          .filter((r) => r.interval_kind === kind)
          .sort((a, b) => b.interval_start.localeCompare(a.interval_start))
          .slice(0, n);
        return Promise.resolve({ data: matching, error: null });
      },
    };
    return builder;
  }

  function buildMovementQuery() {
    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      order: () => Promise.resolve({ data: movementRows, error: null }),
    };
    return builder;
  }

  const client = {
    from: (table: string) => (table === 'kick_intervals' ? buildKickQuery() : buildMovementQuery()),
    channel: (name: string) => {
      const isKick = name.startsWith('kick-intervals-');
      const channelObj: Record<string, unknown> = {};
      channelObj.on = (
        _event: string,
        _filter: unknown,
        cb: (payload: { new: FakeMovementRow }) => void
      ) => {
        if (isKick) {
          kickHandlers.push(() => cb({ new: {} as FakeMovementRow }));
        } else {
          movementHandlers.push(cb);
        }
        return channelObj;
      };
      channelObj.subscribe = () => channelObj;
      channelObj.unsubscribe = isKick ? kickUnsubscribeSpy : movementUnsubscribeSpy;
      return channelObj;
    },
  } as unknown as SupabaseClient;

  return {
    client,
    emitMovementInsert: (row: FakeMovementRow) => movementHandlers.forEach((cb) => cb({ new: row })),
    emitKickChange: () => kickHandlers.forEach((cb) => cb()),
    movementUnsubscribeSpy,
    kickUnsubscribeSpy,
  };
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function isoHoursAgo(hours: number): string {
  return isoMinutesAgo(hours * 60);
}

function isoDaysAgo(days: number): string {
  return isoHoursAgo(days * 24);
}

/** A movement row recent enough that hasSignal() (15-minute threshold) sees
 * it as live — the precondition every kick-window test needs, since kick
 * windows are gated on the same answer as the movement channel. */
const RECENT_SIGNAL_ROW: FakeMovementRow = {
  t: isoMinutesAgo(5),
  active_windows: 3,
  covered_windows: 75,
};

describe('SupabaseMovementStream', () => {
  it('primes its cache from the initial fetch, dropping uncovered bins', async () => {
    const rows: FakeMovementRow[] = [
      { t: isoHoursAgo(1), active_windows: 5, covered_windows: 75 },
      { t: isoHoursAgo(2), active_windows: 0, covered_windows: 0 }, // uncovered
    ];
    const { client } = createFakeClient(rows);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    const window = stream.getWindow(24);
    expect(window).toHaveLength(1);
    expect(window[0].moved).toBe(true);
  });

  it('getBaseline mirrors MockMovementStream: fraction moved among samples older than 24h', async () => {
    const rows: FakeMovementRow[] = [
      { t: isoHoursAgo(30), active_windows: 5, covered_windows: 75 }, // moved, prior
      { t: isoHoursAgo(28), active_windows: 0, covered_windows: 75 }, // quiet, prior
      { t: isoHoursAgo(1), active_windows: 5, covered_windows: 75 }, // within last 24h, excluded
    ];
    const { client } = createFakeClient(rows);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    expect(stream.getBaseline()).toBeCloseTo(0.5, 5);
  });

  it('returns 0 baseline when there are no samples older than 24h', async () => {
    const { client } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();
    expect(stream.getBaseline()).toBe(0);
  });

  it('notifies subscribers on a covered realtime insert', async () => {
    const { client, emitMovementInsert } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    const received: Array<{ moved: boolean }> = [];
    stream.subscribe((sample) => received.push(sample));

    emitMovementInsert({ t: new Date().toISOString(), active_windows: 3, covered_windows: 75 });

    expect(received).toHaveLength(1);
    expect(received[0].moved).toBe(true);
    expect(stream.getWindow(1)).toHaveLength(1);
  });

  it('never notifies subscribers or updates the cache for an uncovered realtime insert', async () => {
    const { client, emitMovementInsert } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    const received: Array<{ moved: boolean }> = [];
    stream.subscribe((sample) => received.push(sample));

    emitMovementInsert({ t: new Date().toISOString(), active_windows: 0, covered_windows: 0 });

    expect(received).toHaveLength(0);
    expect(stream.getWindow(1)).toHaveLength(0);
  });

  it('unsubscribe() stops delivery to that callback', async () => {
    const { client, emitMovementInsert } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    const received: unknown[] = [];
    const unsubscribe = stream.subscribe((sample) => received.push(sample));
    unsubscribe();

    emitMovementInsert({ t: new Date().toISOString(), active_windows: 1, covered_windows: 75 });
    expect(received).toHaveLength(0);
  });

  it('dispose() unsubscribes both the movement and kick realtime channels', async () => {
    const { client, movementUnsubscribeSpy, kickUnsubscribeSpy } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    stream.dispose();
    expect(movementUnsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(kickUnsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  describe('hasSignal', () => {
    it('is false with an empty cache', async () => {
      const { client } = createFakeClient([]);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();
      expect(stream.hasSignal()).toBe(false);
    });

    it('is true when the most recent covered bin is within the 15-minute recency window', async () => {
      const { client } = createFakeClient([RECENT_SIGNAL_ROW]);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();
      expect(stream.hasSignal()).toBe(true);
    });

    it('is false when the most recent covered bin is older than the recency window', async () => {
      const { client } = createFakeClient([{ t: isoMinutesAgo(30), active_windows: 1, covered_windows: 75 }]);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();
      expect(stream.hasSignal()).toBe(false);
    });

    it('is false when the only recent bin is uncovered (dropped from the cache, not just quiet)', async () => {
      const { client } = createFakeClient([{ t: isoMinutesAgo(5), active_windows: 0, covered_windows: 0 }]);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();
      expect(stream.hasSignal()).toBe(false);
    });
  });

  describe('kick windows', () => {
    const dayRows: FakeKickRow[] = [
      { interval_start: isoDaysAgo(2), interval_kind: 'day', kicks: 300 },
      { interval_start: isoDaysAgo(1), interval_kind: 'day', kicks: 280 },
      { interval_start: isoDaysAgo(0), interval_kind: 'day', kicks: 50 }, // today, partial
    ];
    const hourRows: FakeKickRow[] = [
      { interval_start: isoHoursAgo(2), interval_kind: 'hour', kicks: 10 },
      { interval_start: isoHoursAgo(1), interval_kind: 'hour', kicks: 8 },
      { interval_start: isoHoursAgo(0), interval_kind: 'hour', kicks: 2 }, // current hour, partial
    ];

    it('getTrendKickWindow returns day-kind rows oldest-first with settledIndex on the last complete interval', async () => {
      const { client } = createFakeClient([RECENT_SIGNAL_ROW], dayRows);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();

      const window = stream.getTrendKickWindow();
      expect(window.samples.map((s) => s.kicks)).toEqual([300, 280, 50]);
      expect(window.settledIndex).toBe(1);
    });

    it('getDailyKickWindow is the newest slice of the same day-kind data as the trend window', async () => {
      const { client } = createFakeClient([RECENT_SIGNAL_ROW], dayRows);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();

      const daily = stream.getDailyKickWindow();
      // Fewer than DAILY_KICK_LIMIT (7) rows exist in this fixture, so the
      // "newest slice" is every row available — same as the trend window.
      expect(daily.samples.map((s) => s.kicks)).toEqual([300, 280, 50]);
      expect(daily.settledIndex).toBe(1);
    });

    it('getHourlyKickWindow returns hour-kind rows independently of the day-kind ones', async () => {
      const { client } = createFakeClient([RECENT_SIGNAL_ROW], hourRows);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();

      const window = stream.getHourlyKickWindow();
      expect(window.samples.map((s) => s.kicks)).toEqual([10, 8, 2]);
      expect(window.settledIndex).toBe(1);
    });

    it('all three kick windows are empty when hasSignal() is false, even with kick rows present', async () => {
      const { client } = createFakeClient([], [...dayRows, ...hourRows]);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();

      expect(stream.getDailyKickWindow()).toEqual({ samples: [], settledIndex: -1 });
      expect(stream.getHourlyKickWindow()).toEqual({ samples: [], settledIndex: -1 });
      expect(stream.getTrendKickWindow()).toEqual({ samples: [], settledIndex: -1 });
    });

    it('is empty (not a thrown error) when there is signal but no kick rows exist yet', async () => {
      const { client } = createFakeClient([RECENT_SIGNAL_ROW], []);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();

      expect(stream.getTrendKickWindow()).toEqual({ samples: [], settledIndex: -1 });
    });

    it('a kick_intervals realtime change refetches and is reflected on the next read', async () => {
      const rows: FakeKickRow[] = [{ interval_start: isoDaysAgo(0), interval_kind: 'day', kicks: 40 }];
      const { client, emitKickChange } = createFakeClient([RECENT_SIGNAL_ROW], rows);
      const stream = new SupabaseMovementStream(client, 'patient-1');
      await stream.whenReady();

      expect(stream.getTrendKickWindow().samples.map((s) => s.kicks)).toEqual([40]);

      // Simulate a new, more recent row landing (the ingest pipeline
      // upserting today's running tally) and the realtime channel firing
      // for it. A few seconds ahead of "now" so it sorts as the newest row
      // regardless of how much wall-clock time this test itself takes.
      const laterThanNow = new Date(Date.now() + 10_000).toISOString();
      rows.push({ interval_start: laterThanNow, interval_kind: 'day', kicks: 41 });
      emitKickChange();
      // refetchKicks() is private and fire-and-forget from the realtime
      // callback's own signature, so there's no promise here to await
      // directly — yielding to a macrotask flushes every pending microtask
      // in its chain (the two fetches plus Promise.all's own tick),
      // regardless of exactly how many hops that chain has.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(stream.getTrendKickWindow().samples.map((s) => s.kicks)).toEqual([40, 41]);
    });
  });
});
