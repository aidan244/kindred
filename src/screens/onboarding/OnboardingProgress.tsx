/**
 * Onboarding's progress rail.
 *
 * THE SAME RAIL AS THE CHECK-IN'S, deliberately — handoff README §"03
 * Check-in — the first gate": 3px, pill, accent on line, no numeral, no
 * gradient, no glow, no colour change at 100%. Onboarding is not one of the
 * eight handoff screens, but it is the first thing she ever sees, so it has
 * to teach the same grammar the rest of the product then speaks. A second,
 * different progress idiom (this used to be a row of dots) would mean the
 * app changes its mind about what "how far through am I" looks like between
 * the setup flow and the check-in.
 *
 * WHAT IT COUNTS: questions she has answered and moved past — not steps, and
 * not the closing pairing step, which asks her nothing. Like the check-in's
 * rail it may go DOWN (she taps back), and that is correct rather than a case
 * to special-case: the rail states where she is, it does not record a best
 * score.
 *
 * The parent decides whether the rail is on screen at all (it is hidden once
 * there is nothing left to answer, mirroring the README's "hidden once the
 * last category is answered"). This component only draws it.
 *
 * IT SPEAKS THE SAME WAY TOO. `aria-valuetext` gives a screen reader plain
 * language ("2 of 3 answered"), exactly as the check-in's rail does with
 * `checkInProgressValueText`. Without it, valuemin/valuenow/valuemax make a
 * screen reader compute and announce a PERCENTAGE — "Setup progress, 67%" —
 * against a rail whose whole point is that it never shows one. Two rails
 * described in their own headers as "the same rail" cannot say different
 * things.
 */

import type { ReactElement } from 'react';
import {
  ONBOARDING_PROGRESS_LABEL,
  onboardingProgressValueText,
} from '../../data/clinicalContent';

export interface OnboardingProgressProps {
  /** Questions answered and left behind. May decrease — see the header. */
  answeredCount: number;
  /** How many questions the flow asks in total (the pairing step is not one). */
  totalQuestions: number;
}

export function OnboardingProgress({
  answeredCount,
  totalQuestions,
}: OnboardingProgressProps): ReactElement {
  // Clamped rather than trusted: a rail that renders wider than its track, or
  // at a negative width, would be the one place in the product that lies
  // about progress.
  const fraction =
    totalQuestions > 0 ? Math.min(1, Math.max(0, answeredCount / totalQuestions)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalQuestions}
      aria-valuenow={answeredCount}
      aria-valuetext={onboardingProgressValueText(answeredCount, totalQuestions)}
      aria-label={ONBOARDING_PROGRESS_LABEL}
      className="h-[3px] flex-1 rounded-pill bg-line"
    >
      {/* The fill animates its width on the shared entrance curve so a step
          change reads as movement rather than a jump. Width only: no colour
          change, no glow, nothing that would make reaching the end feel like
          a reward. */}
      <div
        className="h-full rounded-pill bg-accent"
        style={{
          width: `${fraction * 100}%`,
          transition: 'width var(--dur-enter) var(--ease-soft)',
        }}
      />
    </div>
  );
}
