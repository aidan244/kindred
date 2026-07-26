/**
 * The product's only logo — a single continuous line: a sweep falling into a
 * circle, a curled baby inside it, a heart at its centre.
 *
 * SUPPLIED ARTWORK, TRANSCRIBED NOT REDRAWN. The geometry below is verbatim
 * from `kindred-mark.svg`; nothing here nudges a control point. Three things
 * about that file did have to change to make it a component in this codebase,
 * and each is a rule rather than a preference:
 *
 *  1. THE ROOT'S `color` ATTRIBUTE IS GONE. The file set it to a near-black
 *     ink, which looks like a harmless default — but a `color` on the root
 *     resolves every `stroke="currentColor"` beneath it to that value, which
 *     is the opposite of inheriting. In the night theme the mark renders
 *     `text-accent`, a warm lamp on a dark room, so keeping the attribute
 *     would have painted it near-black on near-black: invisible, in the theme
 *     that renders after 20:00. It was also a colour literal outside
 *     src/styles/tokens.css, which src/test/invariants.test.ts fails the build
 *     over — and did, on this comment, when it quoted the value.
 *
 *  2. THE STROKE SCALES WITH `size` — the opposite of what this file used to
 *     do, and of the comment it used to carry. That comment was correct for
 *     the old mark: a 24-unit viewBox with a 1.25 stroke is ~5% of the box, so
 *     the browser's own coordinate scaling kept it proportional and
 *     recomputing here would have double-applied. This artwork is a 750-unit
 *     viewBox with a 6.30 stroke — 0.84% — used across a 4.4x size range. At
 *     96px that renders 0.81px (thin but alive); at 24px it renders 0.20px,
 *     a sub-pixel line that all but vanishes. One viewBox stroke-width cannot
 *     serve both ends, so the weight is chosen per size from the anchors below.
 *
 *  3. `role="img"` + `aria-label` + `<title>` become `aria-hidden`. The mark is
 *     decorative at all three call sites — beside a text label in
 *     CheckInControl and AlertFramingBlock, under a heading in PairingStep —
 *     so announcing "Kindred" again is noise, and the old mark was already
 *     `aria-hidden` for exactly this reason.
 *
 * LEGIBILITY AT 24px, recorded so it is not rediscovered. This is a fine line
 * drawing, and at 24 CSS px the baby and the heart inside the circle merge
 * into one mass that no stroke weight recovers: lighter is grey mush, heavier
 * fills in solid. The weights below are the best of a rendered sweep, not a
 * cure. What survives at that size is the SILHOUETTE — the sweep and the
 * circle — which is enough beside a label but is not the whole mark. If the
 * small sizes ever have to carry meaning alone, the answer is a simplified
 * small variant of this artwork, not a heavier stroke.
 */

import type { ReactElement } from 'react';

export interface KindredMarkProps {
  /** Rendered width/height in px. 24 inside controls, 96 for onboarding. */
  size?: number;
  className?: string;
}

/**
 * The artwork's own coordinate space, verbatim from the supplied file. TALL
 * rather than square (462x750, ratio 0.62), so the mark is letterboxed inside
 * the square box its callers lay out: it fills the height and sits centred
 * across the width. The box stays square deliberately — every call site sized
 * this as a square, and changing that would reflow the controls it sits in for
 * a purely cosmetic gain.
 */
export const MARK_VIEW_BOX = '118 140 462 750';

/** The sweep: the tail falling from the top, round into the circle. */
export const MARK_SWEEP = 'M 171 150 C 247 304 440 366 515 496 A 248 248 0 0 1 207 850';

/** The womb. */
export const MARK_CIRCLE = { cx: 300, cy: 620, r: 170 };

/** The curled baby and the heart at its centre, as one continuous line. */
export const MARK_FIGURE =
  'M 344 545.6 C 357.9 529.1 347.5 509.7 341.1 501.8 C 321.6 473.7 293.7 468.1 269 481.2 ' +
  'C 242.5 495.3 233.4 525.1 247.5 551.6 C 261.4 573.6 285.7 576.6 297.5 586.1 ' +
  'C 309.4 595.6 274.7 636.8 283.6 670.5 C 297.9 706 355 702.8 395.6 676.7 ' +
  'C 436.9 647.9 443.9 605.7 420.7 575 C 407.9 563.6 393.6 562.2 384 574.1 ' +
  'C 388.7 589.9 390.8 595.1 392 600 C 393.2 604.9 395.2 611.2 395 617 ' +
  'C 394.8 622.8 393.3 629.5 391 635 C 388.7 640.5 385.0 645.8 381 650 ' +
  'C 377.0 654.2 372.0 657.3 367 660 C 362.0 662.7 356.8 665.1 351 666 ' +
  'C 345.2 666.9 337.9 667.4 332 665.5 C 326.1 663.6 320.6 658.9 315.9 654.5 ' +
  'C 311.2 650.1 306.2 644.2 303.9 639.1 C 301.6 634.0 300.9 628.0 302.3 623.9 ' +
  'C 303.7 619.8 308.7 615.4 312.4 614.5 C 316.1 613.6 321.1 616.1 324.4 618.8 ' +
  'C 327.7 621.5 329.5 630.6 332 630.6 C 334.5 630.6 336.3 621.5 339.6 618.8 ' +
  'C 342.9 616.1 347.9 613.6 351.6 614.5 C 355.3 615.4 360.4 619.8 361.8 623.9 ' +
  'C 363.2 628.0 362.4 634.0 360.1 639.1 C 357.8 644.2 352.8 650.1 348.1 654.5 ' +
  'C 343.4 658.9 337.0 662.4 332 665.5 C 327.0 668.6 322.7 670.3 318 673 ' +
  'C 313.3 675.8 309.0 679.2 304 682 C 299.0 684.8 293.7 687.7 288 690 ' +
  'C 282.3 692.3 275.8 693.8 270 696 C 264.2 698.2 258.3 699.8 253 703 ' +
  'C 247.7 706.2 242.2 710.3 238 715 C 233.8 719.7 229.7 725.2 228 731 ' +
  'C 226.3 736.8 226.0 743.5 228 750 C 230.0 756.5 235.3 764.7 240 770 ' +
  'C 244.7 775.3 251.0 779.2 256 782 C 261.0 784.8 267.7 786.2 270 787';

/**
 * Stroke weight in viewBox units at each end of the range this mark is used
 * at. READ OFF A RENDERED SWEEP (6.3 / 20 / 40 / 60 at both sizes) rather than
 * derived: 20 is the lightest weight that still reads at 96px, and 40 the
 * heaviest the interior survives at 24px.
 */
const STROKE_AT_MIN_SIZE = 40;
const STROKE_AT_MAX_SIZE = 20;
const MIN_SIZE = 24;
const MAX_SIZE = 96;

/**
 * Interpolated between the two anchors, and CLAMPED outside them, so a caller
 * passing an untested size gets a sane line rather than an extrapolated
 * hairline (large) or a solid blob (small). 22px — CheckInControl's secondary
 * variant — sits below the floor and takes the 24px weight, which is correct:
 * two pixels of size difference should not change the drawn weight.
 */
export function markStrokeWidth(size: number): number {
  if (size <= MIN_SIZE) {
    return STROKE_AT_MIN_SIZE;
  }
  if (size >= MAX_SIZE) {
    return STROKE_AT_MAX_SIZE;
  }
  const t = (size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE);
  return STROKE_AT_MIN_SIZE + t * (STROKE_AT_MAX_SIZE - STROKE_AT_MIN_SIZE);
}

export function KindredMark({ size = 24, className }: KindredMarkProps): ReactElement {
  return (
    <svg
      viewBox={MARK_VIEW_BOX}
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={markStrokeWidth(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={MARK_SWEEP} />
      <circle cx={MARK_CIRCLE.cx} cy={MARK_CIRCLE.cy} r={MARK_CIRCLE.r} />
      <path d={MARK_FIGURE} />
    </svg>
  );
}
