/**
 * PLACEHOLDER CONTENT — WRITTEN BY AN ENGINEER, NOT A CLINICIAN.
 *
 * Every question, label, and fixture value in this file is a stand-in
 * written to get the prototype running. It must be replaced with the team
 * medic's sourced, version-pinned question set before this is used with any
 * real patient, or shown to anyone as more than a demo.
 *
 * All clinical copy lives in this one file on purpose — never scatter
 * question text or clinical wording across components.
 */

import type { HistoryFlag, Patient, RedFlagQuestion } from '../types';

// ---------------------------------------------------------------------------
// Onboarding questions
// ---------------------------------------------------------------------------

interface OnboardingQuestionBase {
  id: string;
  prompt: string;
}

export interface NumericOnboardingQuestion extends OnboardingQuestionBase {
  type: 'numeric';
}

export interface YesNoUnsureOnboardingQuestion extends OnboardingQuestionBase {
  type: 'yes-no-unsure';
  allowDetail: true;
}

export interface MultiSelectOnboardingQuestion extends OnboardingQuestionBase {
  type: 'multi-select';
  options: { value: HistoryFlag; label: string }[];
  allowDetail: true;
}

// A union so the onboarding screen can render each question type generically.
// New question types/questions can be added without changing this shape.
export type OnboardingQuestion =
  | NumericOnboardingQuestion
  | YesNoUnsureOnboardingQuestion
  | MultiSelectOnboardingQuestion;

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: 'weeks-pregnant',
    type: 'numeric',
    prompt: 'How many weeks pregnant are you?',
  },
  {
    id: 'extra-monitoring',
    type: 'yes-no-unsure',
    prompt:
      'Has anyone told you this pregnancy needs extra monitoring, or are you under consultant-led care?',
    allowDetail: true,
  },
  {
    id: 'history',
    type: 'multi-select',
    prompt:
      'Has anything happened in this or a previous pregnancy that your clinic should know about?',
    allowDetail: true,
    options: [
      { value: 'bleeding', label: 'Bleeding' },
      { value: 'reduced-movement-before', label: 'Reduced movement before' },
      { value: 'previous-loss', label: 'Previous loss' },
      { value: 'high-blood-pressure', label: 'High blood pressure' },
      { value: 'diabetes', label: 'Diabetes' },
      { value: 'none-of-these', label: 'None of these' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Red-flag questionnaire
// ---------------------------------------------------------------------------

/**
 * `flagWhen` records which answer counts as a positive red flag for that
 * question. Question 1 is the odd one out — "no movement felt" (answer: no)
 * is the flag, not "yes". Consumers (e.g. src/logic/disposition.ts) must
 * read this field rather than assuming "yes" is always the concerning
 * answer.
 */
export const redFlagQuestions: RedFlagQuestion[] = [
  {
    id: 'movement',
    question: 'Have you felt your baby move in the last two hours?',
    flagWhen: 'no',
  },
  {
    id: 'movement-slowed-or-changed',
    question: "Do you think your baby's movements have slowed down or changed?",
    flagWhen: 'yes',
  },
  {
    // This id is load-bearing: TriageFlow and Outcome key on 'bleeding-fluid' to
    // swap in the bleeding-specific 999 note. If a clinician renames or removes
    // this question, update those references or the note silently reverts to the
    // generic wording.
    id: 'bleeding-fluid',
    question: 'Have you had any bleeding or fluid loss?',
    flagWhen: 'yes',
  },
  {
    id: 'tummy-pain',
    question: 'Do you have tummy pain that stays rather than comes and goes?',
    flagWhen: 'yes',
  },
  {
    id: 'headache-vision-swelling',
    question:
      'Do you have a bad headache, changes in your vision, or sudden swelling in your face or hands?',
    flagWhen: 'yes',
  },
  {
    id: 'unwell-temperature',
    question: 'Do you feel unwell in yourself, or have a temperature?',
    flagWhen: 'yes',
  },
];

// ---------------------------------------------------------------------------
// Patient-facing clinical copy — centralised here per the rule at the top of
// this file. Never scatter clinical wording across components; import it
// from here instead.
// ---------------------------------------------------------------------------

/** The default, always-quieter secondary 999 route rendered under the
 * primary emergency control (src/components/EmergencyCall.tsx). */
export const EMERGENCY_DEFAULT_NOTE = 'Heavy bleeding, collapse, or fitting: call 999';

/** The bleeding-specific 999 variant, shown instead of the default note once
 * she has flagged bleeding or fluid loss in the red-flag questionnaire.
 * Rendered on both the triage flow (src/screens/TriageFlow.tsx) and the
 * outcome screen (src/screens/Outcome.tsx) — one constant, not two copies. */
export const BLEEDING_EMERGENCY_NOTE =
  'You told us about bleeding or fluid loss. If it becomes heavy, call 999.';

/** The alert framing block's title and body (src/components/AlertFramingBlock.tsx),
 * shown when Home is in its alert state. */
export const ALERT_FRAMING_TITLE = "Worth checking on your baby's movements.";
export const ALERT_FRAMING_BODY =
  'You know your baby best. Check in if anything feels different.';

/** Fixed disclaimer that must appear on every generated report. */
export const REPORT_DISCLAIMER =
  "This report includes movement data from a consumer wearable. It is supporting context for the clinical team, not a clinical measurement.";

// ---------------------------------------------------------------------------
// Patient fixture
// ---------------------------------------------------------------------------

export const patientFixture: Patient = {
  name: 'Amara Whitfield',
  gestationWeeks: 34,
  clinic: {
    name: 'Thornfield Private Maternity Clinic',
    triagePhoneNumber: '020 7946 0523',
    hours: {
      opens: '08:00',
      closes: '18:00',
      daysDescription: 'every day',
    },
  },
  bookedUnit: {
    name: "St. Augustine's Maternity Unit",
    triagePhoneNumber: '020 7946 0999',
  },
};
