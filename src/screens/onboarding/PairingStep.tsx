/**
 * The closing moment of onboarding: a calm, mocked confirmation that the
 * wearable is paired.
 *
 * This is a statement about the DEVICE, not about the baby — no verdict, no
 * tick, no "all good". Nothing here ticks or spins like a loader; the only
 * motion is the shared slow breath behind the mark, the same 9s cycle the
 * avatar on Home breathes on.
 *
 * THE MARK IS THE KindredMark AT 96px in a `--lamp-3` glow, and that glow now
 * lives in `LampMark` because WelcomeStep opens the flow with the identical
 * treatment — see that file for the README citation and the reduced-motion
 * rule. It used to be BandMark at 112px. The band mark is the right glyph for
 * *device state* — the live view's no-signal line, Home's offline card — but
 * this beat is not a status readout: it closes the introduction the welcome
 * step opened, and the cupped hand under lamplight is the thing being
 * introduced. BandMark stays in use wherever the band's own state is reported.
 *
 * NO CONTINUE BUTTON HERE. Onboarding.tsx owns the single 60px accent pill
 * for every step, so it never moves or changes weight between the questions
 * and this step (src/screens/Onboarding.tsx).
 */

import type { ReactElement } from 'react';
import {
  ONBOARDING_PAIRING_BODY,
  ONBOARDING_PAIRING_TITLE,
} from '../../data/clinicalContent';
import { LampMark } from './LampMark';

export function PairingStep(): ReactElement {
  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <LampMark />

      {/* The screen's one `display` line — the README allows at most one per
          screen, and on this step it is the hero rather than a greeting. */}
      <h1 className="mt-8 text-display text-text">{ONBOARDING_PAIRING_TITLE}</h1>
      <p className="mt-3 text-lead text-text-muted">{ONBOARDING_PAIRING_BODY}</p>
    </div>
  );
}
