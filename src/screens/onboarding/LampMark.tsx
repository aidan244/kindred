/**
 * The 96px KindredMark in its breathing lamp glow — onboarding's one lit
 * moment, now used at BOTH ends of the flow (WelcomeStep and PairingStep).
 *
 * EXTRACTED RATHER THAN COPIED. This was PairingStep's own markup until the
 * welcome step needed the identical treatment. The glow is not a div with a
 * background: it is proportioned off the mark, it has a reduced-motion branch
 * that cannot be expressed as a class, and it is sized so the layout does not
 * shift when it breathes. Two hand-maintained copies of that would drift, and
 * the drift would be silent — nothing type-checks a duplicated radial
 * gradient.
 *
 * THE MARK IS THE KindredMark AT 96px, in a `--lamp-3` glow — the handoff
 * README's "Marks" section assigns exactly that: "KindredMark (cupped hand
 * under lamplight) 22/24px in controls, 96px in onboarding". BandMark is the
 * right glyph for *device state* — the live view's no-signal line, Home's
 * offline card — and stays in use wherever the band's own state is reported.
 *
 * The glow is proportioned off the mark the same way Home's is off the avatar
 * (README §01: a 45x79 figure inside a 96px glow), so every lit moment in the
 * product reads as the same lamp at two sizes rather than unrelated haloes.
 *
 * Under prefers-reduced-motion the glow renders STATIC at full opacity rather
 * than animating — the animation class is omitted entirely rather than relying
 * on the global reduced-motion clamp, which would otherwise freeze it at the
 * breath keyframe's 0% opacity (0.62) and show the lamp half-lit. The README's
 * rule is "hold the blooms static (do not remove them)", and this is that rule
 * applied to it.
 */

import type { ReactElement } from 'react';
import { KindredMark } from '../../components/KindredMark';
import { usePrefersReducedMotion } from '../../components/usePrefersReducedMotion';

/** README, "Marks": the mark is 96px in onboarding. */
const MARK_SIZE = 96;
/** Home puts a 79px-tall figure inside a 96px glow; the same ratio keeps the
 * lit moments in the product looking like one lamp. */
const GLOW_RATIO = 96 / 79;

export function LampMark(): ReactElement {
  const reduced = usePrefersReducedMotion();
  const glowSize = Math.round(MARK_SIZE * GLOW_RATIO);

  return (
    // The box is sized to the glow, not the mark, so the two are concentric
    // and the layout does not shift when the glow breathes (it scales, which
    // is a transform and cannot affect layout).
    <div
      className="relative flex items-center justify-center"
      style={{ width: glowSize, height: glowSize }}
    >
      <div
        aria-hidden="true"
        data-reduced-keep={reduced ? '' : undefined}
        className={`absolute inset-0 rounded-full ${reduced ? '' : 'animate-breath'}`}
        style={{
          background: 'radial-gradient(closest-side, var(--lamp-3), transparent)',
          opacity: reduced ? 1 : undefined,
        }}
      />
      <KindredMark size={MARK_SIZE} className="relative text-accent" />
    </div>
  );
}
