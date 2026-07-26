/**
 * The presence under Home's greeting — THE PRODUCT'S MARK, in a breathing lamp
 * glow.
 *
 * WHAT THIS USED TO BE, AND WHY IT IS GONE. It carried a bespoke single-line
 * standing figure ("inspired by Terry from Soul"), drawn only for this one
 * screen. The product now has an actual logo (src/components/KindredMark.tsx),
 * so a second hand-drawn figure appearing nowhere else made Home the one
 * screen that introduced her to a shape the rest of the app never used again.
 * The glow, the breath, the sizing and the safety rules below are all kept
 * verbatim; only the drawing inside them changed.
 *
 * IT IS THE SAME TREATMENT PairingStep GIVES THE MARK — mark in a `--lamp-3`
 * glow, glow breathing on the shared `animate-breath` loop, line held still.
 * That is deliberate: onboarding's pairing step is where she first meets this
 * shape, and Home is where she meets it every day after. Two different
 * treatments of one mark would read as two different marks.
 *
 * SAFETY RULE, UNCHANGED AND STILL LOAD-BEARING: this is a presence, not a
 * status light. It carries no face, no expression, and — the part that matters
 * — NO STATE. It is the same drawing at the same weight in the same colour
 * whatever the sensor says, whatever the time is, and whatever she answered
 * last time. design-plan.md rule 6 bans a smiley outright and §6.1 bans
 * WarningCircle-style cues for the same reason: the instant this mark could
 * differ between two visits, it becomes a verdict she has to interpret. Do not
 * give it variants.
 *
 * Under prefers-reduced-motion the glow renders static at full opacity rather
 * than animating, matching PairingStep and Aura — the room stays lit, the light
 * stops moving.
 */

import type { ReactElement } from 'react';
import { KindredMark } from './KindredMark';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface KindredAvatarProps {
  /** Rendered footprint (glow diameter) in px. The mark inside scales to
   * match, keeping its own aspect ratio. */
  size?: number;
  className?: string;
}

/**
 * How much of the footprint the mark itself occupies.
 *
 * 0.82 is inherited from the figure this replaced, and it still holds for the
 * same reason: the glow has to read as light AROUND the drawing rather than a
 * disc behind it, so the mark has to sit inside the glow's falloff with room
 * to spare. The mark is letterboxed inside its own square box (it is taller
 * than it is wide — see KindredMark), so the drawn ink is narrower than this
 * again, which is what keeps the glow visible either side of it.
 */
const MARK_FRACTION = 0.82;
const GLOW_FRACTION = 0.95;

export function KindredAvatar({ size = 104, className }: KindredAvatarProps): ReactElement {
  const reduced = usePrefersReducedMotion();
  const markSize = size * MARK_FRACTION;
  const glowSize = size * GLOW_FRACTION;

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
      {/* KindredMark is `aria-hidden` itself and picks its own stroke weight
          from the size it is given, so at this scale it draws the light line
          the 96px onboarding mark does rather than the heavy small-size one. */}
      <KindredMark size={markSize} className="relative text-accent" />
    </div>
  );
}
