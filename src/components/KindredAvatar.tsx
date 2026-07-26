/**
 * The Kindred avatar — a new hand-drawn moment in the §6.2 family, added for
 * the reworked home screen. The founder's brief: a glowing single-line
 * figure "inspired by Terry from Soul (Pixar)" — one flowing stroke,
 * generous curves, sitting beside/under the greeting.
 *
 * Hand-drawn law (§6.2), same hand as KindredMark / BandMark: fill="none",
 * stroke="currentColor", stroke-width="1.25" in a fixed viewBox (so it scales
 * proportionally at any rendered size), round caps and joins. Deliberate
 * imperfection is the point — the two sides of the figure are not exact
 * mirrors of each other, and the contour is left open at the base rather
 * than closed into a literal body outline, the same way the cupped-hand mark
 * and the band mark are both open curves rather than closed shapes.
 *
 * Construction: a single continuous path, one M and a chain of C curves,
 * traced from the lower-left hem up through a hip/waist/shoulder taper, over
 * a softly rounded head-like crest, and back down the other side to the
 * lower-right hem — a calm standing presence rather than a rendered anatomy.
 *
 * Safety rule: this is a presence, not a face. It carries no eyes, no mouth,
 * no expression of any kind — nothing that could read as a verdict on how
 * she or the baby are doing (design-plan.md rule 6 bans a smiley outright,
 * and §6.1 bans WarningCircle-style cues for the same reason). Do not add
 * interior detail of any kind to this mark.
 *
 * Sits in a soft `--lamp-3` glow with the same breathing treatment as the
 * onboarding pairing mark (src/screens/onboarding/PairingStep.tsx): the glow
 * pulses on the shared `animate-breath` loop, the line itself stays still.
 * Under prefers-reduced-motion the glow renders static at full opacity
 * rather than animating, matching PairingStep's own reduced-motion handling.
 */

import type { ReactElement } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface KindredAvatarProps {
  /** Rendered footprint (glow diameter) in px. The figure inside scales to
   * match, keeping its own aspect ratio. */
  size?: number;
  className?: string;
}

const VIEW_WIDTH = 60;
const VIEW_HEIGHT = 104;

/** One continuous stroke — a calm standing presence, asymmetric on purpose
 * (the right side is not a mirror of the left), open at the hem. */
const FIGURE_PATH =
  'M24 94.2 C 15 84.3, 14 71.4, 19 60.3 C 22.6 52.7, 25.2 47.1, 21.4 40.1 ' +
  'C 18.9 34.6, 17.4 28.2, 23 21.6 C 20 17.1, 21.1 11.6, 27.6 8.1 ' +
  'C 30.9 6.3, 33.7 6.5, 36.1 8.5 C 41.1 12.6, 41.7 18.1, 38 22.6 ' +
  'C 43.1 28.6, 41.9 35.1, 39.5 40.6 C 36 47.6, 38.8 53.1, 42.1 60.6 ' +
  'C 47.2 71.6, 46.2 84.6, 37.2 94.5';

export function KindredAvatar({ size = 104, className }: KindredAvatarProps): ReactElement {
  const reduced = usePrefersReducedMotion();
  const figureHeight = size * 0.82;
  const figureWidth = (figureHeight * VIEW_WIDTH) / VIEW_HEIGHT;
  const glowSize = size * 0.95;

  return (
    <div
      className={`relative flex items-center justify-center${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
    >
      {/* `data-reduced-keep` matches Aura, SessionRing and PairingStep. The
          stylesheet (src/index.css) documents it as the guard that stops the
          global reduced-motion rule from ever re-animating a held-static
          element at 0.01ms, which would strobe rather than calm. Dropping the
          animation class alone happens to be enough TODAY — with no
          animation-name there is nothing to clamp — but that is a property of
          this markup, not a rule. */}
      <div
        aria-hidden="true"
        data-reduced-keep={reduced ? '' : undefined}
        className={`absolute rounded-full ${reduced ? '' : 'animate-breath'}`}
        style={{
          width: glowSize,
          height: glowSize,
          background: 'radial-gradient(closest-side, var(--lamp-3), transparent)',
          opacity: reduced ? 1 : undefined,
        }}
      />
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        width={figureWidth}
        height={figureHeight}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="relative text-accent"
      >
        <path d={FIGURE_PATH} />
      </svg>
    </div>
  );
}
