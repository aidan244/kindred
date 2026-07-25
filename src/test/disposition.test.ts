import { describe, expect, it } from 'vitest';
import { disposition } from '../logic/disposition';
import { redFlagQuestions } from '../data/clinicalContent';
import type { RedFlagAnswer } from '../types';

const NO_ANSWERS: RedFlagAnswer[] = redFlagQuestions.map((q) => ({
  questionId: q.id,
  // The "safe" (non-flagging) answer for every question.
  answer: q.flagWhen === 'yes' ? 'no' : 'yes',
}));

function positiveAnswerFor(questionId: string): RedFlagAnswer {
  const question = redFlagQuestions.find((q) => q.id === questionId)!;
  return { questionId, answer: question.flagWhen };
}

describe('disposition', () => {
  it("alert path with no positive flags still escalates", () => {
    expect(disposition('alert', [])).toBe('escalate');
    expect(disposition('alert', NO_ANSWERS)).toBe('escalate');
  });

  it('ad hoc with one positive flag escalates', () => {
    expect(
      disposition('adhoc', [
        ...NO_ANSWERS.filter((a) => a.questionId !== 'bleeding-fluid'),
        positiveAnswerFor('bleeding-fluid'),
      ])
    ).toBe('escalate');
  });

  it('ad hoc with zero positive flags is routine — the only combination that is', () => {
    expect(disposition('adhoc', NO_ANSWERS)).toBe('routine');
    expect(disposition('adhoc', [])).toBe('routine');
  });

  it('never returns routine for an alert-path entry, across every yes/no combination', () => {
    const questionIds = redFlagQuestions.map((q) => q.id);
    const totalCombinations = 2 ** questionIds.length;

    for (let mask = 0; mask < totalCombinations; mask += 1) {
      const answers: RedFlagAnswer[] = questionIds.map((questionId, index) => ({
        questionId,
        answer: (mask >> index) & 1 ? 'yes' : 'no',
      }));

      expect(disposition('alert', answers)).toBe('escalate');
    }
  });

  it('flagWhen correctness: "no" to the movement question escalates ad hoc', () => {
    expect(
      disposition('adhoc', [{ questionId: 'movement', answer: 'no' }])
    ).toBe('escalate');
  });

  it('flagWhen correctness: "yes" to movement plus "no" to the rest is routine', () => {
    const answers: RedFlagAnswer[] = redFlagQuestions.map((q) =>
      q.id === 'movement'
        ? { questionId: q.id, answer: 'yes' }
        : { questionId: q.id, answer: 'no' }
    );
    expect(disposition('adhoc', answers)).toBe('routine');
  });

  it('her perception of reduced/changed movement escalates the ad hoc path on its own, with every other answer non-flagging', () => {
    const answers: RedFlagAnswer[] = redFlagQuestions.map((q) =>
      q.id === 'movement-slowed-or-changed'
        ? { questionId: q.id, answer: 'yes' }
        : { questionId: q.id, answer: q.flagWhen === 'yes' ? 'no' : 'yes' }
    );
    expect(disposition('adhoc', answers)).toBe('escalate');
  });

  it('ignores an answer whose questionId matches no known question, rather than crashing', () => {
    expect(() =>
      disposition('adhoc', [{ questionId: 'not-a-real-question', answer: 'yes' }])
    ).not.toThrow();
    expect(
      disposition('adhoc', [{ questionId: 'not-a-real-question', answer: 'yes' }])
    ).toBe('routine');
  });
});
