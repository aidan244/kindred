/**
 * Clinical routing rule for the red-flag triage questionnaire.
 *
 * Rule (exactly):
 *  - entryPath 'alert' (she arrived via a sensor push notification) ALWAYS
 *    escalates, regardless of her answers — including zero positive flags.
 *    The entry path can only push towards escalation, never away from it.
 *  - entryPath 'adhoc' escalates if at least one answer is a positive red
 *    flag.
 *  - entryPath 'adhoc' with zero positive flags is the ONLY combination that
 *    returns 'routine'.
 *
 * A "positive flag" is answer-dependent per question: each RedFlagQuestion
 * carries a `flagWhen: 'yes' | 'no'` saying which answer counts as positive
 * for that question (question 1, movement, flags on "no"; the others flag
 * on "yes"). We resolve this by joining the given answers to the question
 * definitions in src/data/clinicalContent.ts by `questionId`.
 *
 * This function is pure and deterministic: no clock, no I/O, no mutation.
 */

import type { RedFlagAnswer } from '../types';
import { redFlagQuestions } from '../data/clinicalContent';

// questionId -> which answer ('yes' | 'no') is the positive flag for it.
const flagWhenByQuestionId = new Map(
  redFlagQuestions.map((q) => [q.id, q.flagWhen])
);

export function disposition(
  entryPath: 'alert' | 'adhoc',
  answers: RedFlagAnswer[]
): 'escalate' | 'routine' {
  // The alert entry path can escalate but never de-escalate: it always wins,
  // even with no answers at all.
  if (entryPath === 'alert') {
    return 'escalate';
  }

  const hasPositiveFlag = answers.some((answer) => {
    const flagWhen = flagWhenByQuestionId.get(answer.questionId);
    // An answer to a question we don't recognise must never crash the
    // function — just ignore it rather than treating it as a flag.
    if (flagWhen === undefined) {
      return false;
    }
    return answer.answer === flagWhen;
  });

  return hasPositiveFlag ? 'escalate' : 'routine';
}
