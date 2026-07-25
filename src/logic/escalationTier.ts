/**
 * Resolves WHICH escalation tier applies once `disposition()` has already
 * decided the outcome is 'escalate' (held-build-brief.md placeholder_content,
 * "Escalation tier"). This changes only the phone number and framing shown
 * on the outcome screen — nothing else (src/screens/Outcome.tsx,
 * src/components/EmergencyCall.tsx).
 *
 * Rule (exactly, from placeholder_content):
 *  - Emergency tier, 999 primary: the Collapse/seizure/trauma gate is yes
 *    (either of its two questions — src/data/clinicalContent.ts modelling
 *    decision (a)), OR Bleeding's gate is yes AND either "how much" is a
 *    heavy value or "any pain or dizziness" is yes.
 *  - Triage tier, maternity triage primary via getTriageContact: every other
 *    escalate case. Pain, Vomiting, and Fluid are not defined precisely
 *    enough yet and default to triage tier until the medic sets thresholds
 *    for them — this function does not invent any.
 *
 * NO-DOWNGRADE, BY CONSTRUCTION: this function reads exactly three things —
 * the Collapse category's gate answers, the Bleeding category's gate
 * answer, and the two NAMED Bleeding follow-ups
 * (BLEEDING_HOW_MUCH_FOLLOWUP_ID, BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID).
 * It never reads any other follow-up on any category — not Movement's "did
 * movement return after rest or food", not Bleeding's "how long" or "any
 * clots or tissue", nothing from Pain, Vomiting, or Fluid. There is no
 * follow-up-keyed branch anywhere below this comment; if one is ever added,
 * it violates the no-downgrade rule by definition, not just in spirit.
 *
 * Pure and deterministic: no clock, no I/O, no mutation.
 */

import type { CategoryAnswer } from '../types';
import {
  BLEEDING_CATEGORY_ID,
  BLEEDING_HOW_MUCH_FOLLOWUP_ID,
  BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID,
  COLLAPSE_CATEGORY_ID,
  HEAVY_BLEEDING_VALUES,
} from '../data/clinicalContent';

export type EscalationTier = 'emergency' | 'triage';

/**
 * Whether the Collapse/seizure/trauma category's hard-stop fired this
 * session — either of its two gate questions answered yes (modelling
 * decision (a), src/data/clinicalContent.ts). Exported because
 * src/screens/triage/CheckInConversation.tsx needs the same check to know
 * whether it is rendering a fresh conversation or one continuing after the
 * hard-stop interrupt already routed her to the emergency outcome once
 * (design-plan.md-style "quiet way to add more", held-build-brief.md
 * placeholder_content "Hard-stop rule").
 */
export function hasHardStopFired(answers: CategoryAnswer[]): boolean {
  const collapse = answers.find((a) => a.categoryId === COLLAPSE_CATEGORY_ID);
  if (!collapse) {
    return false;
  }
  if (collapse.gateAnswer === 'yes') {
    return true;
  }
  return collapse.additionalGateAnswers?.some((value) => value === 'yes') ?? false;
}

function bleedingIsHeavyOrPainful(answers: CategoryAnswer[]): boolean {
  const bleeding = answers.find((a) => a.categoryId === BLEEDING_CATEGORY_ID);
  if (!bleeding || bleeding.gateAnswer !== 'yes') {
    return false;
  }

  const howMuch = bleeding.followUpAnswers.find((f) => f.followUpId === BLEEDING_HOW_MUCH_FOLLOWUP_ID);
  const isHeavy =
    howMuch?.value.type === 'select' && HEAVY_BLEEDING_VALUES.includes(howMuch.value.value);

  const painOrDizziness = bleeding.followUpAnswers.find(
    (f) => f.followUpId === BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID
  );
  const isPainOrDizzy = painOrDizziness?.value.type === 'yesno' && painOrDizziness.value.value === 'yes';

  return Boolean(isHeavy) || Boolean(isPainOrDizzy);
}

export function getEscalationTier(answers: CategoryAnswer[]): EscalationTier {
  if (hasHardStopFired(answers)) {
    return 'emergency';
  }
  if (bleedingIsHeavyOrPainful(answers)) {
    return 'emergency';
  }
  return 'triage';
}
