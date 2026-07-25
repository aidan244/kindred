import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseMovementStream } from '../lib/backend/supabaseMovementStream';

interface FakeRow {
  t: string;
  active_windows: number;
  covered_windows: number;
}

/** A minimal fake satisfying only the query/channel chains
 * SupabaseMovementStream actually calls — not a general Supabase mock. */
function createFakeClient(rows: FakeRow[]): {
  client: SupabaseClient;
  emitInsert: (row: FakeRow) => void;
  unsubscribeSpy: ReturnType<typeof vi.fn>;
} {
  const handlers: Array<(payload: { new: FakeRow }) => void> = [];
  const unsubscribeSpy = vi.fn();

  const queryBuilder = {
    select: () => queryBuilder,
    eq: () => queryBuilder,
    gte: () => queryBuilder,
    order: () => Promise.resolve({ data: rows, error: null }),
  };

  const channelObj: Record<string, unknown> = {};
  channelObj.on = (
    _event: string,
    _filter: unknown,
    cb: (payload: { new: FakeRow }) => void
  ) => {
    handlers.push(cb);
    return channelObj;
  };
  channelObj.subscribe = () => channelObj;
  channelObj.unsubscribe = unsubscribeSpy;

  const client = {
    from: () => queryBuilder,
    channel: () => channelObj,
  } as unknown as SupabaseClient;

  return {
    client,
    emitInsert: (row: FakeRow) => handlers.forEach((cb) => cb({ new: row })),
    unsubscribeSpy,
  };
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

describe('SupabaseMovementStream', () => {
  it('primes its cache from the initial fetch, dropping uncovered bins', async () => {
    const rows: FakeRow[] = [
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
    const rows: FakeRow[] = [
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
    const { client, emitInsert } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    const received: Array<{ moved: boolean }> = [];
    stream.subscribe((sample) => received.push(sample));

    emitInsert({ t: new Date().toISOString(), active_windows: 3, covered_windows: 75 });

    expect(received).toHaveLength(1);
    expect(received[0].moved).toBe(true);
    expect(stream.getWindow(1)).toHaveLength(1);
  });

  it('never notifies subscribers or updates the cache for an uncovered realtime insert', async () => {
    const { client, emitInsert } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    const received: Array<{ moved: boolean }> = [];
    stream.subscribe((sample) => received.push(sample));

    emitInsert({ t: new Date().toISOString(), active_windows: 0, covered_windows: 0 });

    expect(received).toHaveLength(0);
    expect(stream.getWindow(1)).toHaveLength(0);
  });

  it('unsubscribe() stops delivery to that callback', async () => {
    const { client, emitInsert } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    const received: unknown[] = [];
    const unsubscribe = stream.subscribe((sample) => received.push(sample));
    unsubscribe();

    emitInsert({ t: new Date().toISOString(), active_windows: 1, covered_windows: 75 });
    expect(received).toHaveLength(0);
  });

  it('dispose() unsubscribes the realtime channel', async () => {
    const { client, unsubscribeSpy } = createFakeClient([]);
    const stream = new SupabaseMovementStream(client, 'patient-1');
    await stream.whenReady();

    stream.dispose();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });
});
