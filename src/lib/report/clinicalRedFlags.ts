/**
 * PLACEHOLDER CONTENT — not clinician-sourced, backend/report-only.
 *
 * This is a richer, category-plus-follow-up red-flag structure, provided
 * during review of the Phase 4 plan. It is used as MockBackend's demo
 * fixture data so the canonical clinical PDF's red-flag section can show
 * its full intended fidelity (a positive primary question with detailed
 * follow-ups) in an actual generated document.
 *
 * It is NOT wired into the live questionnaire screens, `disposition.ts`,
 * or the persisted `red_flag_answers` schema (Supabase migration
 * 001_core.sql) — those all still use the frontend's own flat six-question
 * set in src/data/clinicalContent.ts, unchanged. Adopting this structure
 * for the live flow (new screens for follow-up questions, a
 * `red_flag_categories`-shaped schema, updated disposition lookups) is a
 * real, separate frontend/schema decision for later — same category as
 * every other deferred integration point in this project. Replace this
 * file entirely once the team medic sources and version-pins the real set,
 * exactly as the frontend's own placeholder file asks for itself.
 */

export interface RedFlagFollowUpQuestion {
  id: string;
  question: string;
}

export interface RedFlagCategory {
  id: string;
  label: string;
  /** One or more primary red-flag prompts in this category. Any "yes" is
   * a positive flag — matching the existing disposition() rule that any
   * positive flag escalates the ad hoc path (and the alert path always
   * escalates regardless). This file never re-implements that rule; it
   * only supplies richer question content for the report to render. */
  primaryQuestions: string[];
  /** Only meaningful once a primary question in this category is positive. */
  followUps: RedFlagFollowUpQuestion[];
}

export const redFlagCategories: RedFlagCategory[] = [
  {
    id: 'bleeding',
    label: 'Bleeding',
    primaryQuestions: ['Are you bleeding?'],
    followUps: [
      { id: 'bleeding-amount', question: 'How much?' },
      { id: 'bleeding-duration', question: 'How long?' },
      { id: 'bleeding-clots', question: 'Any clots or tissue?' },
      { id: 'bleeding-pain-dizziness', question: 'Any pain or dizziness?' },
    ],
  },
  {
    id: 'fluid',
    label: 'Fluid',
    primaryQuestions: ['Any gush or leaking fluid?'],
    followUps: [
      { id: 'fluid-onset', question: 'When did it start?' },
      { id: 'fluid-colour', question: 'Clear, pink, or blood-stained?' },
      { id: 'fluid-ongoing', question: 'Still leaking?' },
      { id: 'fluid-smell-fever', question: 'Any smell or fever?' },
    ],
  },
  {
    id: 'movement',
    label: 'Movement',
    primaryQuestions: ['Has the baby moved less, stopped, or changed from normal?'],
    followUps: [
      { id: 'movement-last-felt', question: 'When was the last movement?' },
      { id: 'movement-returned', question: 'Did movement return after rest or food?' },
    ],
  },
  {
    id: 'vomiting',
    label: 'Vomiting',
    primaryQuestions: ['Have you vomited in the past 24 hours?'],
    followUps: [
      { id: 'vomiting-count', question: 'How many times?' },
      { id: 'vomiting-fluids', question: 'Can you keep fluids down?' },
      { id: 'vomiting-appearance', question: 'Any blood or green/brown vomit?' },
      {
        id: 'vomiting-associated',
        question: 'Any abdominal pain, fever, dark urine, dizziness, or weight loss?',
      },
    ],
  },
  {
    id: 'pain',
    label: 'Pain',
    primaryQuestions: ['Do you have pain?'],
    followUps: [
      { id: 'pain-location', question: 'Where is it?' },
      { id: 'pain-onset', question: 'When did it start?' },
      { id: 'pain-pattern', question: 'Is it constant or does it come and go?' },
      { id: 'pain-severity', question: 'Severity out of 10?' },
      { id: 'pain-associated', question: 'Any bleeding, fluid, contractions, or urinary symptoms?' },
    ],
  },
  {
    id: 'collapse',
    label: 'Collapse, seizure, or trauma',
    primaryQuestions: [
      'Any seizure, fainting, collapse, or head injury?',
      'Any abdominal trauma or fall?',
    ],
    followUps: [],
  },
];

export interface RedFlagCategoryAnswer {
  categoryId: string;
  positive: boolean;
  followUpAnswers?: Record<string, string>;
}

/** MockBackend's demo answers: everything clear except a positive,
 * followed-up movement entry — the one combination that both escalates
 * (matching disposition()'s existing rule) and gives the report something
 * real to render in every section that depends on a positive flag. */
export const demoRedFlagAnswers: RedFlagCategoryAnswer[] = [
  { categoryId: 'bleeding', positive: false },
  { categoryId: 'fluid', positive: false },
  {
    categoryId: 'movement',
    positive: true,
    followUpAnswers: {
      'movement-last-felt': 'Around 6 hours ago',
      'movement-returned': 'No — still reduced after resting and having something to eat',
    },
  },
  { categoryId: 'vomiting', positive: false },
  { categoryId: 'pain', positive: false },
  { categoryId: 'collapse', positive: false },
];

/**
 * Expands categories + category-level answers into the generic
 * RedFlagEntry[] shape src/lib/report/sections.ts renders — one entry per
 * primary question, with follow-up answers attached only where a category
 * was positive and an answer for that follow-up was actually given.
 */
export function toRedFlagEntries(
  categories: RedFlagCategory[],
  answers: RedFlagCategoryAnswer[]
): Array<{
  question: string;
  answer: 'yes' | 'no';
  followUps?: Array<{ question: string; answer: string }>;
}> {
  const answerByCategory = new Map(answers.map((a) => [a.categoryId, a]));

  return categories.flatMap((category) => {
    const answer = answerByCategory.get(category.id);
    const positive = answer?.positive ?? false;

    return category.primaryQuestions.map((question) => ({
      question,
      answer: (positive ? 'yes' : 'no') as 'yes' | 'no',
      followUps: positive
        ? category.followUps
            .filter((followUp) => answer?.followUpAnswers?.[followUp.id] !== undefined)
            .map((followUp) => ({
              question: followUp.question,
              answer: answer!.followUpAnswers![followUp.id],
            }))
        : undefined,
    }));
  });
}
