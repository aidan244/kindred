/**
 * Screen transitions — handoff README, "page_transitions". One visual
 * language for the whole app: 320ms, `--ease-soft-out`, opacity plus a short
 * directional slide. Forward slides in from the trailing edge; back reverses
 * it. No spring, no scale-in, no fade-through-white, no cross-dissolve of
 * whole screens — only the ARRIVING screen animates, and it animates in.
 *
 * Direction comes from react-router's own navigation type: POP is a back
 * navigation (browser back, or `navigate(-1)`), everything else is forward.
 * That is the only signal available that is honest about intent — inferring
 * direction from a route ordering would be wrong the first time a screen is
 * reachable from two places.
 *
 * What deliberately sits OUTSIDE this wrapper (see src/App.tsx): the aura
 * and the dock. Both are fixed reference points and must not move or reflow
 * while a screen changes underneath them.
 *
 * Keyed on pathname, so each arrival is a genuine mount. The check-in's own
 * conversation/review switch is internal state on one route, not a
 * navigation, and so is untouched by this — its beats never re-animate.
 *
 * Reduced motion: a <=120ms opacity fade, no translate. The transition is
 * softened, not deleted — arriving somewhere still has to read as arriving.
 */

import type { ReactElement, ReactNode } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export function RouteTransition({ children }: { children: ReactNode }): ReactElement {
  const location = useLocation();
  const navigationType = useNavigationType();
  const reduced = usePrefersReducedMotion();

  const keyframes = reduced
    ? 'route-in-fade'
    : navigationType === 'POP'
      ? 'route-in-back'
      : 'route-in-forward';

  return (
    <div
      key={location.pathname}
      // Exempts this one animation from index.css's blanket reduced-motion
      // collapse, so the fade lands at --dur-press (120ms) rather than
      // effectively zero. See that file's @media block.
      data-reduced-fade=""
      style={{
        animation: `${keyframes} var(--dur-route) var(--ease-soft-out) both`,
      }}
    >
      {children}
    </div>
  );
}
