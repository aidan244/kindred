import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHeldBackend, resetHeldBackendForTests } from '../lib/backend/factory';
import { MockBackend } from '../lib/backend/mockBackend';

afterEach(() => {
  resetHeldBackendForTests();
  vi.unstubAllEnvs();
});

describe('getHeldBackend', () => {
  it('defaults to the mock backend when VITE_BACKEND is unset', async () => {
    vi.stubEnv('VITE_BACKEND', '');
    expect(await getHeldBackend()).toBeInstanceOf(MockBackend);
  });

  it('returns the same cached instance on repeated calls', async () => {
    vi.stubEnv('VITE_BACKEND', 'mock');
    const [first, second] = await Promise.all([getHeldBackend(), getHeldBackend()]);
    expect(first).toBe(second);
  });

  it('throws rather than silently running the wrong backend when VITE_BACKEND=supabase has no Supabase config', () => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(() => getHeldBackend()).toThrow(/VITE_SUPABASE_URL/);
  });
});
