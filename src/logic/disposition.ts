/**
 * Clinical routing rule for the red-flag triage questionnaire (held-build-
 * build-brief.md rule 4c, amended for the six-category schema).
 *
 * Rule (exactly):
 *  - entryPath 'alert' (she arrived via a sensor push notification) ALWAYS
 *    escalates, regardless of her answers — including zero categories
 *    answered yes. The entry path can only push towards escalation, never
 *    away from it.
 *  - entryPath 'adhoc' escalates if at least one category's gate was
 *    answered yes.
 *  - entryPath 'adhoc' with every gate answered no is the ONLY combination
 *    that returns 'routine'.
 *
 * "Any gate yes" reads `gateAnswer` and, for the one category that has them
 * (Collapse/seizure/trauma — src/data/clinicalContent.ts modelling decision
 * (a)), `additionalGateAnswers` too. It never reads a follow-up answer: the
 * no-downgrade rule says a follow-up can add detail for the clinician but
 * can never soften or reverse a category that already gated yes, and the
 * simplest way to make that true "by construction" rather than by
 * discipline is for this function to never look at follow-ups at all.
 *
 * This function is pure and deterministic: no clock, no I/O, no mutation.
 */

import type { CategoryAnswer } from '../types';

function categoryGatedYes(answer: CategoryAnswer): boolean {
  if (answer.gateAnswer === 'yes') {
    return true;
  }
  return answer.additionalGateAnswers?.some((value) => value === 'yes') ?? false;
}

export function disposition(
  entryPath: 'alert' | 'adhoc',
  answers: CategoryAnswer[]
): 'escalate' | 'routine' {
  // The alert entry path can escalate but never de-escalate: it always wins,
  // even with no answers at all.
  if (entryPath === 'alert') {
    return 'escalate';
  }

  return answers.some(categoryGatedYes) ? 'escalate' : 'routine';
}
