/**
 * Resolves the single HeldBackend instance for the app, once, from
 * `VITE_BACKEND` ('mock' | 'supabase', default 'mock'). Callers import
 * `getHeldBackend()` — never `MockBackend` or `SupabaseBackend` directly,
 * so swapping implementations never touches a call site.
 *
 * Async, unlike a plain constructor call, because resolving a real
 * `SupabaseBackend` means resolving the authenticated user and her
 * `patients` row first (see `supabaseBackend.ts`'s `create()`) — there is
 * no honest synchronous version of that. `MockBackend` is still
 * constructed synchronously internally; it's just wrapped in an
 * already-resolved promise so callers have one call shape regardless of
 * which backend is selected.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { HeldBackend } from './HeldBackend';
import { MockBackend } from './mockBackend';
import { SupabaseBackend } from './supabaseBackend';

type BackendKind = 'mock' | 'supabase';

/** Exported so src/sensors/MovementStream.ts's getMovementStream() can
 * branch the same way, from the same env var, without duplicating the
 * read-and-default logic. */
export function resolveBackendKind(): BackendKind {
  const raw = (import.meta.env.VITE_BACKEND as string | undefined)?.trim().toLowerCase();
  return raw === 'supabase' ? 'supabase' : 'mock';
}

/** Exported for the same reason as resolveBackendKind() above — the sensor
 * boundary's real implementation needs its own authenticated client. */
export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    throw new Error(
      'VITE_BACKEND=supabase requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set.'
    );
  }
  return createClient(url, anonKey);
}

let instance: Promise<HeldBackend> | null = null;

export function getHeldBackend(): Promise<HeldBackend> {
  if (!instance) {
    const kind = resolveBackendKind();
    instance =
      kind === 'supabase'
        ? SupabaseBackend.create(createSupabaseClient())
        : Promise.resolve(new MockBackend());
  }
  return instance;
}

/** Test-only: clears the cached instance so each test starts fresh. */
export function resetHeldBackendForTests(): void {
  instance = null;
}
