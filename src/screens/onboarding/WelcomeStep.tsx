/**
 * The opening beat of onboarding — the first thing she ever sees.
 *
 * It is the same lamp, the same `display` line and the same lead paragraph as
 * the closing PairingStep (both render `LampMark`), so the flow opens and
 * closes on one gesture rather than two unrelated ones.
 *
 * IT PROMISES NOTHING. A welcome screen is exactly where a product like this
 * would say "we'll keep watch" or "you'll know if something changes", and
 * either would be the false reassurance the whole design exists to avoid —
 * see the note on ONBOARDING_WELCOME_BODY in src/data/clinicalContent.ts. The
 * copy describes the next minute and stops.
 *
 * NO RAIL ON THIS STEP. Onboarding hides the progress rail wherever there is
 * no question being asked — the same rule that hides it on the pairing step.
 * It would otherwise read 0-of-n before she has been asked anything.
 *
 * NO CONTINUE BUTTON HERE. Onboarding.tsx owns the single 60px accent pill for
 * every step, so it never moves or changes weight between this step, the
 * questions and the pairing beat (src/screens/Onboarding.tsx).
 */

import type { ReactElement } from 'react';
import {
  ONBOARDING_WELCOME_BODY,
  ONBOARDING_WELCOME_TITLE,
} from '../../data/clinicalContent';
import { LampMark } from './LampMark';

export function WelcomeStep(): ReactElement {
  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <LampMark />

      {/* The screen's one `display` line — the README allows at most one per
          screen, and on this step it is the hero rather than a greeting. */}
      <h1 className="mt-8 text-display text-text">{ONBOARDING_WELCOME_TITLE}</h1>
      <p className="mt-3 text-lead text-text-muted">{ONBOARDING_WELCOME_BODY}</p>
    </div>
  );
}
