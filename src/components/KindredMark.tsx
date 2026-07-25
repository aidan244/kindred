/**
 * The product's only logo — design-plan.md §6.2 (1): a cupped hand under a
 * pool of lamplight, drawn as a single hand-crafted SVG rather than an icon
 * glyph. It is the glyph inside CheckInControl, replacing the Phosphor
 * `Hand` the scaffold used.
 *
 * Hand-drawn moments share one hand: fill="none", stroke="currentColor",
 * stroke-width 1.25 (scaled proportionally at larger sizes), round caps and
 * joins. Deliberate imperfection is the point — the three light arcs above
 * the hand are not concentric and their radii and end angles are varied by
 * hand rather than by formula.
 */

import type { ReactElement } from 'react';

export interface KindredMarkProps {
  /** Rendered width/height in px. 24 inside controls, 96 for onboarding. */
  size?: number;
  className?: string;
}

export function KindredMark({ size = 24, className }: KindredMarkProps): ReactElement {
  // A constant stroke-width in viewBox units. The viewBox stays fixed at
  // 24x24 while width/height follow `size`, so the browser's own coordinate
  // scaling already makes the rendered stroke grow proportionally at larger
  // sizes (design-plan.md §6.2) — recomputing it here on top of that would
  // double-apply the scale factor (stroke would grow with size squared
  // instead of linearly).
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
      {/* The cupped hand: one shallow open curve, (4,13) through ~(12,19)
          back up to (20,13), asymmetric on purpose. */}
      <path d="M4 13 C 6.8 17.6, 9.6 19.3, 12 19.1 C 14.6 19.4, 17.3 17.4, 20 13.2" />
      {/* Two short finger ticks rising off the ends. */}
      <path d="M4 13 L 3.1 10.6" />
      <path d="M20 13.2 L 21 10.9" />
      {/* Three shallow arcs, light falling into the hand — radii ~3/5.6/7.7,
          each spanning ~70° across the top, not exactly concentric. */}
      <path d="M10.17 4.88 A 3 3 0 0 1 13.65 5.04" />
      <path d="M8.83 2.63 A 5.6 5.6 0 0 1 15.17 2.35" />
      <path d="M7.59 1.22 A 7.7 7.7 0 0 1 16.43 1.37" />
    </svg>
  );
}
