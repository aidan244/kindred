/**
 * Shared reduced-motion detector for the two ambient views (the live-view
 * surface and the home ember band). The global CSS baseline in
 * src/index.css already collapses ordinary transition/animation durations
 * under `prefers-reduced-motion: reduce`, but the ambient views branch in JS
 * as well, per design-plan.md §5.1 — collapsing their durations to ~0 would
 * strobe rather than calm, so they swap to a genuinely static composition
 * instead.
 */

import { useEffect, useState } from 'react';

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (): void => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
