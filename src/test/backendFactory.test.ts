import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHeldBackend, resetHeldBackendForTests } from '../lib/backend/factory';
import { MockBackend } from '../lib/backend/mockBackend';

afterEach(() => {
  resetHeldBackendForTests();
  vi.unstubAllEnvs();
});

describe('getHeldBackend', () => {
  it('defaults to the mock backend when VITE_BACKEND is unset', () => {
    vi.stubEnv('VITE_BACKEND', '');
    expect(getHeldBackend()).toBeInstanceOf(MockBackend);
  });

  it('returns the same cached instance on repeated calls', () => {
    vi.stubEnv('VITE_BACKEND', 'mock');
    expect(getHeldBackend()).toBe(getHeldBackend());
  });

  it('throws rather than silently running the wrong backend when VITE_BACKEND=supabase', () => {
    vi.stubEnv('VITE_BACKEND', 'supabase');
    expect(() => getHeldBackend()).toThrow(/Phase 3/);
  });
});
