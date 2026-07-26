/**
 * The closing moment of onboarding: a calm, mocked confirmation that the
 * wearable is paired.
 *
 * This is a statement about the DEVICE, not about the baby — no verdict, no
 * tick, no "all good". Nothing here ticks or spins like a loader; the only
 * motion is the shared slow breath behind the mark, the same 9s cycle the
 * avatar on Home breathes on.
 *
 * THE MARK IS THE KindredMark AT 96px, in a `--lamp-3` glow — the handoff
 * README's "Marks" section assigns exactly that: "KindredMark (cupped hand
 * under lamplight) 22/24px in controls, 96px in onboarding". It used to be
 * BandMark at 112px. The band mark is the right glyph for *device state* —
 * the live view's no-signal line, Home's offline card — but this beat is not
 * a status readout: it is the one moment the product introduces itself, and
 * the cupped hand under lamplight is the thing it introduces. BandMark stays
 * in use wherever the band's own state is being reported.
 *
 * The glow is proportioned off the mark the same way Home's is off the
 * avatar (README §01: a 45x79 figure inside a 96px glow), so the two lit
 * moments in the product read as the same lamp at two sizes rather than two
 * unrelated haloes.
 *
 * Under prefers-reduced-motion the glow renders STATIC at full opacity rather
 * than animating — the animation class is omitted entirely rather than
 * relying on the global reduced-motion clamp, which would otherwise freeze it
 * at the breath keyframe's 0% opacity (0.62) and show the lamp half-lit. The
 * README's rule is "hold the blooms static (do not remove them)", and this is
 * that rule applied to the one glow on this screen.
 *
 * NO CONTINUE BUTTON HERE. Onboarding.tsx owns the single 60px accent pill
 * for every step, so it never moves or changes weight between the questions
 * and this step (src/screens/Onboarding.tsx).
 */

import type { ReactElement } from 'react';
import { KindredMark } from '../../components/KindredMark';
import { usePrefersReducedMotion } from '../../components/usePrefersReducedMotion';
import {
  ONBOARDING_PAIRING_BODY,
  ONBOARDING_PAIRING_TITLE,
} from '../../data/clinicalContent';

/** README, "Marks": the mark is 96px in onboarding. */
const MARK_SIZE = 96;
/** Home puts a 79px-tall figure inside a 96px glow; the same ratio keeps the
 * two lit moments in the product looking like one lamp. */
const GLOW_RATIO = 96 / 79;

export function PairingStep(): ReactElement {
  const reduced = usePrefersReducedMotion();
  const glowSize = Math.round(MARK_SIZE * GLOW_RATIO);

  return (
    <div className="flex flex-col items-center pt-4 text-center">
      {/* The box is sized to the glow, not the mark, so the two are concentric
          and the layout does not shift when the glow breathes (it scales,
          which is a transform and cannot affect layout). */}
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

      {/* The screen's one `display` line — the README allows at most one per
          screen, and on this step it is the hero rather than a greeting. */}
      <h1 className="mt-8 text-display text-text">{ONBOARDING_PAIRING_TITLE}</h1>
      <p className="mt-3 text-lead text-text-muted">{ONBOARDING_PAIRING_BODY}</p>
    </div>
  );
}
