import { describe, expect, it } from 'vitest';
import {
  demoRedFlagAnswers,
  redFlagCategories,
  toRedFlagEntries,
} from '../lib/report/clinicalRedFlags';

describe('toRedFlagEntries', () => {
  it('expands every category into one entry per primary question', () => {
    const entries = toRedFlagEntries(redFlagCategories, []);
    const totalPrimaryQuestions = redFlagCategories.reduce(
      (sum, category) => sum + category.primaryQuestions.length,
      0
    );
    expect(entries).toHaveLength(totalPrimaryQuestions);
    expect(entries.every((entry) => entry.answer === 'no')).toBe(true);
  });

  it('attaches follow-up answers only for a positive category, and only for follow-ups actually answered', () => {
    const entries = toRedFlagEntries(redFlagCategories, demoRedFlagAnswers);
    const movementEntry = entries.find((entry) => entry.question.startsWith('Has the baby moved'));

    expect(movementEntry?.answer).toBe('yes');
    expect(movementEntry?.followUps).toHaveLength(2);
    expect(movementEntry?.followUps?.map((f) => f.question)).toEqual([
      'When was the last movement?',
      'Did movement return after rest or food?',
    ]);
  });

  it('gives no follow-ups to a category that was not positive', () => {
    const entries = toRedFlagEntries(redFlagCategories, demoRedFlagAnswers);
    const bleedingEntry = entries.find((entry) => entry.question === 'Are you bleeding?');
    expect(bleedingEntry?.answer).toBe('no');
    expect(bleedingEntry?.followUps).toBeUndefined();
  });

  it('renders a category with more than one primary question as separate entries sharing the same positivity', () => {
    const entries = toRedFlagEntries(redFlagCategories, [{ categoryId: 'collapse', positive: true }]);
    const collapseEntries = entries.filter((entry) =>
      redFlagCategories
        .find((c) => c.id === 'collapse')!
        .primaryQuestions.includes(entry.question)
    );
    expect(collapseEntries).toHaveLength(2);
    expect(collapseEntries.every((entry) => entry.answer === 'yes')).toBe(true);
  });

  it('defaults to a negative answer for a category with no supplied answer at all', () => {
    const entries = toRedFlagEntries(redFlagCategories, []);
    expect(entries.every((entry) => entry.answer === 'no' && entry.followUps === undefined)).toBe(true);
  });
});
