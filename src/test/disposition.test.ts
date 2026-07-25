import { describe, expect, it } from 'vitest';
import { disposition } from '../logic/disposition';
import { redFlagCategories } from '../data/clinicalContent';
import type { CategoryAnswer } from '../types';

/** Every category's gate answered no — additional gate questions (the
 * Collapse category only) all answered no too. */
const NO_ANSWERS: CategoryAnswer[] = redFlagCategories.map((category) => ({
  categoryId: category.id,
  gateAnswer: 'no',
  additionalGateAnswers: category.additionalGateQuestions?.map(() => 'no'),
  followUpAnswers: [],
}));

function positiveAnswerFor(categoryId: string): CategoryAnswer {
  return { categoryId, gateAnswer: 'yes', followUpAnswers: [] };
}

describe('disposition', () => {
  it('alert path with every gate no still escalates', () => {
    expect(disposition('alert', [])).toBe('escalate');
    expect(disposition('alert', NO_ANSWERS)).toBe('escalate');
  });

  it('ad hoc with one gate yes escalates', () => {
    const bleeding = redFlagCategories[0].id;
    expect(
      disposition('adhoc', [
        ...NO_ANSWERS.filter((a) => a.categoryId !== bleeding),
        positiveAnswerFor(bleeding),
      ])
    ).toBe('escalate');
  });

  it('ad hoc with every gate no is routine — the only combination that is', () => {
    expect(disposition('adhoc', NO_ANSWERS)).toBe('routine');
    expect(disposition('adhoc', [])).toBe('routine');
  });

  it('never returns routine for an alert-path entry, across every gate yes/no combination', () => {
    const categoryIds = redFlagCategories.map((c) => c.id);
    const totalCombinations = 2 ** categoryIds.length;

    for (let mask = 0; mask < totalCombinations; mask += 1) {
      const answers: CategoryAnswer[] = categoryIds.map((categoryId, index) => ({
        categoryId,
        gateAnswer: (mask >> index) & 1 ? 'yes' : 'no',
        followUpAnswers: [],
      }));

      expect(disposition('alert', answers)).toBe('escalate');
    }
  });

  it('a single category gate yes escalates the ad hoc path on its own, every other gate no', () => {
    const movement = redFlagCategories.find((c) => c.id === 'movement')!;
    const answers: CategoryAnswer[] = redFlagCategories.map((c) =>
      c.id === movement.id
        ? { categoryId: c.id, gateAnswer: 'yes', followUpAnswers: [] }
        : { categoryId: c.id, gateAnswer: 'no', followUpAnswers: [] }
    );
    expect(disposition('adhoc', answers)).toBe('escalate');
  });

  it('the collapse category escalates via an additional gate answer, even when its primary gate is no', () => {
    const collapse = redFlagCategories.find((c) => c.hardStop)!;
    const answers: CategoryAnswer[] = redFlagCategories.map((c) =>
      c.id === collapse.id
        ? { categoryId: c.id, gateAnswer: 'no', additionalGateAnswers: ['yes'], followUpAnswers: [] }
        : { categoryId: c.id, gateAnswer: 'no', followUpAnswers: [] }
    );
    expect(disposition('adhoc', answers)).toBe('escalate');
  });

  it('never reads a follow-up answer — no-downgrade rule, by construction', () => {
    // A category gated yes, with every follow-up answer set to a value that
    // would look "reassuring" if disposition() looked at follow-ups at all
    // (it must not — see src/logic/disposition.ts's header comment).
    const movement = redFlagCategories.find((c) => c.id === 'movement')!;
    const answers: CategoryAnswer[] = [
      {
        categoryId: movement.id,
        gateAnswer: 'yes',
        followUpAnswers: [{ followUpId: 'movement-returned-after-rest', value: { type: 'yesno', value: 'yes' } }],
      },
    ];
    expect(disposition('adhoc', answers)).toBe('escalate');
  });

  it('ignores an answer whose categoryId matches no known category, rather than crashing', () => {
    expect(() =>
      disposition('adhoc', [{ categoryId: 'not-a-real-category', gateAnswer: 'yes', followUpAnswers: [] }])
    ).not.toThrow();
    // An unrecognised categoryId still carries gateAnswer: 'yes' at face
    // value in this implementation (disposition() trusts the shape it's
    // given rather than cross-checking ids against the schema) — so this
    // documents that behaviour rather than a defensive lookup.
    expect(
      disposition('adhoc', [{ categoryId: 'not-a-real-category', gateAnswer: 'yes', followUpAnswers: [] }])
    ).toBe('escalate');
    expect(
      disposition('adhoc', [{ categoryId: 'not-a-real-category', gateAnswer: 'no', followUpAnswers: [] }])
    ).toBe('routine');
  });
});
