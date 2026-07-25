/**
 * The hand-drawn "worn sensor" mark — design-plan.md §6.2 (4). A single loop
 * drawn open (the gap is the clasp), tilted ~8° so it reads as a worn object
 * rather than a symbol. Never red, never carries a status dot.
 *
 * The single consolidated component, parameterised by `size` — used
 * wherever device/connection state appears: the live view's "No signal from
 * the band" line (src/screens/LiveView.tsx) and onboarding's pairing
 * confirmation (src/screens/onboarding/PairingStep.tsx). There used to be a
 * second, divergent copy of this mark under src/screens/onboarding/ (opposite
 * tilt, different stroke math); it has been deleted in favour of this one.
 */

import type { ReactElement } from 'react';

export interface BandMarkProps {
  size?: number;
  className?: string;
}

export function BandMark({ size = 24, className }: BandMarkProps): ReactElement {
  // A constant stroke-width in viewBox units. The viewBox stays fixed at
  // 24x24 while width/height follow `size`, so the browser's own coordinate
  // scaling already makes the rendered stroke grow proportionally at larger
  // sizes (design-plan.md §6.2) — recomputing it here on top of that would
  // double-apply the scale factor.
  const strokeWidth = 1.25;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <g transform="rotate(-8 12 12)">
        {/* The main loop, open at the top, around the bottom. */}
        <path d="M5.2 9.1 A 7 8 0 1 0 18.9 8.8" />
        {/* A short arc closing the top, separated by a gap — the clasp. */}
        <path d="M9.6 4.5 Q 12 3.2 14.6 4.7" />
      </g>
    </svg>
  );
}
