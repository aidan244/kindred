import { describe, expect, it } from 'vitest';
import { getEscalationTier } from '../logic/escalationTier';
import {
  BLEEDING_CATEGORY_ID,
  BLEEDING_HOW_MUCH_FOLLOWUP_ID,
  BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID,
  COLLAPSE_CATEGORY_ID,
} from '../data/clinicalContent';
import type { CategoryAnswer } from '../types';

function bleedingAnswer(overrides: Partial<CategoryAnswer> = {}): CategoryAnswer {
  return {
    categoryId: BLEEDING_CATEGORY_ID,
    gateAnswer: 'yes',
    followUpAnswers: [],
    ...overrides,
  };
}

describe('getEscalationTier', () => {
  it('the collapse category gated yes (primary gate) returns emergency regardless of everything else', () => {
    const answers: CategoryAnswer[] = [
      { categoryId: COLLAPSE_CATEGORY_ID, gateAnswer: 'yes', followUpAnswers: [] },
      // A bleeding category present but non-emergency on its own — must not
      // matter either way, the collapse gate alone decides this.
      bleedingAnswer({ gateAnswer: 'no' }),
    ];
    expect(getEscalationTier(answers)).toBe('emergency');
  });

  it('the collapse category gated yes via its additional gate question returns emergency', () => {
    const answers: CategoryAnswer[] = [
      { categoryId: COLLAPSE_CATEGORY_ID, gateAnswer: 'no', additionalGateAnswers: ['yes'], followUpAnswers: [] },
    ];
    expect(getEscalationTier(answers)).toBe('emergency');
  });

  it('heavy bleeding ("heavier than a period") returns emergency', () => {
    const answers: CategoryAnswer[] = [
      bleedingAnswer({
        followUpAnswers: [
          { followUpId: BLEEDING_HOW_MUCH_FOLLOWUP_ID, value: { type: 'select', value: 'heavier-than-a-period' } },
        ],
      }),
    ];
    expect(getEscalationTier(answers)).toBe('emergency');
  });

  it('heavy bleeding ("soaking a pad within an hour") returns emergency', () => {
    const answers: CategoryAnswer[] = [
      bleedingAnswer({
        followUpAnswers: [
          {
            followUpId: BLEEDING_HOW_MUCH_FOLLOWUP_ID,
            value: { type: 'select', value: 'soaking-a-pad-within-an-hour' },
          },
        ],
      }),
    ];
    expect(getEscalationTier(answers)).toBe('emergency');
  });

  it('bleeding with pain or dizziness returns emergency, even when "how much" is not heavy', () => {
    const answers: CategoryAnswer[] = [
      bleedingAnswer({
        followUpAnswers: [
          { followUpId: BLEEDING_HOW_MUCH_FOLLOWUP_ID, value: { type: 'select', value: 'spotting' } },
          { followUpId: BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID, value: { type: 'yesno', value: 'yes' } },
        ],
      }),
    ];
    expect(getEscalationTier(answers)).toBe('emergency');
  });

  it('light bleeding with no pain or dizziness returns triage, not emergency', () => {
    const answers: CategoryAnswer[] = [
      bleedingAnswer({
        followUpAnswers: [
          { followUpId: BLEEDING_HOW_MUCH_FOLLOWUP_ID, value: { type: 'select', value: 'like-a-period' } },
          { followUpId: BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID, value: { type: 'yesno', value: 'no' } },
        ],
      }),
    ];
    expect(getEscalationTier(answers)).toBe('triage');
  });

  it('bleeding gate no never reads its follow-ups, even if they carry heavy/pain values', () => {
    // A defensive case: these follow-up values should never exist alongside
    // gateAnswer: 'no' in real data (the rendering rule means a 'no' gate
    // has no follow-ups), but the tier function must not crash or escalate
    // if they somehow do — it gates on gateAnswer === 'yes' first.
    const answers: CategoryAnswer[] = [
      bleedingAnswer({
        gateAnswer: 'no',
        followUpAnswers: [
          {
            followUpId: BLEEDING_HOW_MUCH_FOLLOWUP_ID,
            value: { type: 'select', value: 'soaking-a-pad-within-an-hour' },
          },
        ],
      }),
    ];
    expect(getEscalationTier(answers)).toBe('triage');
  });

  it('every other escalate combination (Pain, Vomiting, Fluid, Movement gated yes) returns triage', () => {
    const nonBleedingCollapseCategoryIds = ['fluid', 'pain', 'vomiting', 'movement'];
    for (const categoryId of nonBleedingCollapseCategoryIds) {
      const answers: CategoryAnswer[] = [{ categoryId, gateAnswer: 'yes', followUpAnswers: [] }];
      expect(getEscalationTier(answers)).toBe('triage');
    }
  });

  it('no categories answered at all returns triage (defensive default, never emergency by absence)', () => {
    expect(getEscalationTier([])).toBe('triage');
  });
});
