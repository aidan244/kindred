/**
 * Resolves the single HeldBackend instance for the app, once, from
 * `VITE_BACKEND` ('mock' | 'supabase', default 'mock'). Callers import
 * `getHeldBackend()` — never `MockBackend` or a future `SupabaseBackend`
 * directly, so swapping implementations never touches a call site.
 */

import type { HeldBackend } from './HeldBackend';
import { MockBackend } from './mockBackend';

type BackendKind = 'mock' | 'supabase';

function resolveBackendKind(): BackendKind {
  const raw = (import.meta.env.VITE_BACKEND as string | undefined)?.trim().toLowerCase();
  if (raw === 'supabase') {
    return 'supabase';
  }
  return 'mock';
}

let instance: HeldBackend | null = null;

export function getHeldBackend(): HeldBackend {
  if (!instance) {
    const kind = resolveBackendKind();
    if (kind === 'supabase') {
      // Phase 3 introduces SupabaseBackend. Until then this fails loudly
      // rather than silently falling back, so a misconfigured demo can't
      // quietly run on the wrong backend.
      throw new Error(
        "VITE_BACKEND=supabase is not implemented yet (arrives in Phase 3). Unset it, or set VITE_BACKEND=mock."
      );
    }
    instance = new MockBackend();
  }
  return instance;
}

/** Test-only: clears the cached instance so each test starts fresh. */
export function resetHeldBackendForTests(): void {
  instance = null;
}
