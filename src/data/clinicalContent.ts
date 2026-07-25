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

import type { CategoryAnswer, FollowUpAnswerValue, HistoryFlag, Patient } from '../types';

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
// Red-flag questionnaire (held-build-brief.md placeholder_content, amended)
//
// Six categories, verbatim from the medic. Each has one gate question and,
// only when the gate is answered yes, a set of follow-up questions that add
// detail for the report — "gate no skips straight to the next category. A
// yes reveals that category's follow-ups inline before moving on."
//
// This replaces the earlier flat six-question `redFlagQuestions` entirely.
// PRE-ECLAMPSIA GAP, FLAGGED, NOT FILLED: the earlier flat set's sixth
// question ("bad headache, changes in your vision, or sudden swelling")
// screened for pre-eclampsia. The amended brief's six categories have no
// headache/visual-disturbance/swelling category, and its own "open items"
// note says this explicitly: "There is no headache, visual disturbance, or
// swelling category, the standard pre-eclampsia screen present in most
// comparable red flag sets. Confirm with the medic whether this is a
// deliberate omission or a gap to fill before this becomes canonical." Per
// that same note ("do not silently fill these in"), this module does NOT
// add one back. The gap is real and is not this engineer's to close.
//
// MODELLING DECISIONS (documented here because the brief asked for them to
// be, and because a clinician replacing this file later needs to know what
// was invented versus what was verbatim):
//
// (a) Collapse/seizure/trauma has TWO gate questions ("any seizure,
//     fainting, collapse, or head injury?" and "any abdominal trauma or
//     fall?"), and "the instant either is answered yes" triggers the hard
//     stop. The brief's literal shape has one `gateQuestion` string per
//     category. Rather than splitting this into two categories (which would
//     make it seven categories, not six, and would fragment the "six short
//     categories" framing used for the progress rail), this module adds one
//     optional field, `additionalGateQuestions: string[]`, used by this
//     category alone. It is asked, in order, only once the primary gate has
//     been answered 'no' — answering 'yes' to EITHER one is read as "the
//     hard-stop gate fired" (src/logic/escalationTier.ts,
//     COLLAPSE_CATEGORY_ID) and short-circuits the conversation immediately
//     (src/screens/triage/CheckInConversation.tsx). This category has no
//     `followUps` — there is nothing left to ask once she's said no to both,
//     and if she's said yes to either she has already been routed away.
//
// (b) Bleeding's "How much?" is written as open text in the brief's source
//     list but the emergency-tier rule needs it structured, so it is a
//     `select` here, using the brief's own example options verbatim:
//     spotting / like a period / heavier than a period / soaking a pad
//     within an hour. Which of those count as "heavy" for the emergency-tier
//     rule: the brief's own framing is NHS-guidance-adjacent language —
//     "heavier than a period" and "soaking a pad within an hour" are named
//     directly in the escalation-tier paragraph — so `HEAVY_BLEEDING_VALUES`
//     below is exactly those two. "Spotting" and "like a period" are not
//     heavy. This is provisional, same as every other threshold here, until
//     the medic confirms it.
//
// (c) Category PRESENTATION order deviates from the brief's listing order
//     (Bleeding, Fluid, Movement, Vomiting, Pain, Collapse) for one
//     structural reason: the cross-category-overlap rule (below) needs an
//     overlap's SOURCE category to have already been asked before its
//     CONSUMER category. Pain's overlap source is Bleeding + Fluid; Vomiting's
//     overlap source is Pain. The brief's own listing order would ask
//     Vomiting (4th) before Pain (5th), making Vomiting's overlap
//     unsatisfiable by construction. This module orders the categories
//     Bleeding, Fluid, Pain, Collapse, Vomiting, Movement — every category's
//     content (gate question, follow-ups, options) is verbatim from the
//     brief; only the walking order changed, and only so the overlap rule
//     can ever fire. Collapse sitting third (rather than last) is a second,
//     independent choice: the hard stop is meant to interrupt "wherever it
//     falls in the sequence", and putting it last would mean it never
//     actually has anything left to skip — placing it mid-sequence is what
//     makes "jump immediately, do not wait for the remaining categories"
//     into something a demo (and a test) can actually show.
//
// (d) Every follow-up is answerable but none is individually skippable —
//     unlike the free-text detail beat, which stays fully optional. A
//     yes/no or select follow-up is a single tap either way, so there is
//     nothing to skip. A multiselect follow-up can be submitted with nothing
//     selected ("Continue" needs no minimum), which is the non-demanding
//     equivalent of skipping. A text follow-up can be sent empty. A number
//     follow-up is the one exception — Send stays disabled until a number is
//     entered, because there is no honest "blank" number to record. None of
//     this is load-bearing for safety logic: no-downgrade and the escalation
//     tier never read a follow-up's presence or absence, only the two named
//     Bleeding follow-ups and the gates themselves (see the header comment
//     on `getEscalationTier`, src/logic/escalationTier.ts).
//
// OPEN ITEMS FROM THE BRIEF, CARRIED FORWARD, NOT RESOLVED HERE:
//   - This list has no source citation or version yet. It cannot satisfy the
//     "sourced, version-pinned" requirement until the medic names the
//     guideline or protocol it is drawn from.
//   - The pre-eclampsia gap noted above.
// ---------------------------------------------------------------------------

export type FollowUpType = 'yesno' | 'text' | 'number' | 'select' | 'multiselect';

export interface FollowUpOption {
  value: string;
  label: string;
}

export interface RedFlagFollowUp {
  id: string;
  prompt: string;
  type: FollowUpType;
  options?: FollowUpOption[];
  /**
   * Cross-category overlap (placeholder_content): the id(s) of OTHER
   * categories whose gate answer this follow-up re-asks about. When any of
   * those categories has already been answered this session, the
   * conversation shows what was recorded and lets her confirm or add,
   * rather than presenting a blank prompt again (see `overlapRecap` below).
   * This is pure recall, never inference or scoring — it echoes an answer
   * she already gave, nothing more.
   */
  overlapsWith?: string[];
}

export interface RedFlagCategory {
  id: string;
  gateQuestion: string;
  gateType: 'yesno';
  hardStop: boolean;
  /** Modelling decision (a) above. Only the Collapse category uses this. */
  additionalGateQuestions?: string[];
  followUps: RedFlagFollowUp[];
}

/** Modelling decision (b) above — the two `bleeding-how-much` option values
 * that count as "heavy" for the emergency-tier rule
 * (src/logic/escalationTier.ts). */
export const HEAVY_BLEEDING_VALUES: readonly string[] = [
  'heavier-than-a-period',
  'soaking-a-pad-within-an-hour',
];

// Stable ids referenced by src/logic/escalationTier.ts and
// src/logic/disposition.ts, exported here rather than duplicated as string
// literals in the logic modules.
export const BLEEDING_CATEGORY_ID = 'bleeding';
export const BLEEDING_HOW_MUCH_FOLLOWUP_ID = 'bleeding-how-much';
export const BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID = 'bleeding-pain-or-dizziness';
export const COLLAPSE_CATEGORY_ID = 'collapse-seizure-trauma';

export const redFlagCategories: RedFlagCategory[] = [
  {
    id: BLEEDING_CATEGORY_ID,
    gateQuestion: 'Are you bleeding?',
    gateType: 'yesno',
    hardStop: false,
    followUps: [
      {
        id: BLEEDING_HOW_MUCH_FOLLOWUP_ID,
        prompt: 'How much?',
        type: 'select',
        options: [
          { value: 'spotting', label: 'Spotting' },
          { value: 'like-a-period', label: 'Like a period' },
          { value: 'heavier-than-a-period', label: 'Heavier than a period' },
          { value: 'soaking-a-pad-within-an-hour', label: 'Soaking a pad within an hour' },
        ],
      },
      { id: 'bleeding-how-long', prompt: 'How long?', type: 'text' },
      { id: 'bleeding-clots-or-tissue', prompt: 'Any clots or tissue?', type: 'yesno' },
      {
        id: BLEEDING_PAIN_OR_DIZZINESS_FOLLOWUP_ID,
        prompt: 'Any pain or dizziness?',
        type: 'yesno',
      },
    ],
  },
  {
    id: 'fluid',
    gateQuestion: 'Any gush or leaking fluid?',
    gateType: 'yesno',
    hardStop: false,
    followUps: [
      { id: 'fluid-when-started', prompt: 'When did it start?', type: 'text' },
      {
        id: 'fluid-colour',
        prompt: 'Clear, pink, or blood-stained?',
        type: 'select',
        options: [
          { value: 'clear', label: 'Clear' },
          { value: 'pink', label: 'Pink' },
          { value: 'blood-stained', label: 'Blood-stained' },
        ],
      },
      { id: 'fluid-still-leaking', prompt: 'Still leaking?', type: 'yesno' },
      { id: 'fluid-smell-or-fever', prompt: 'Any smell or fever?', type: 'yesno' },
    ],
  },
  {
    id: 'pain',
    gateQuestion: 'Do you have pain?',
    gateType: 'yesno',
    hardStop: false,
    followUps: [
      { id: 'pain-location', prompt: 'Where is it?', type: 'text' },
      { id: 'pain-when-started', prompt: 'When did it start?', type: 'text' },
      {
        id: 'pain-pattern',
        prompt: 'Is it constant or does it come and go?',
        type: 'select',
        options: [
          { value: 'constant', label: 'Constant' },
          { value: 'comes-and-goes', label: 'Comes and goes' },
        ],
      },
      { id: 'pain-severity', prompt: 'Severity out of 10?', type: 'number' },
      {
        id: 'pain-associated-symptoms',
        prompt: 'Any bleeding, fluid, contractions, or urinary symptoms?',
        type: 'multiselect',
        options: [
          { value: 'bleeding', label: 'Bleeding' },
          { value: 'fluid', label: 'Fluid' },
          { value: 'contractions', label: 'Contractions' },
          { value: 'urinary-symptoms', label: 'Urinary symptoms' },
          { value: 'none-of-these', label: 'None of these' },
        ],
        // Cross-category overlap (modelling decision (c)): both Bleeding and
        // Fluid are asked earlier in the walking order, so their gate
        // answers are available to recap here.
        overlapsWith: [BLEEDING_CATEGORY_ID, 'fluid'],
      },
    ],
  },
  {
    id: COLLAPSE_CATEGORY_ID,
    gateQuestion: 'Any seizure, fainting, collapse, or head injury?',
    gateType: 'yesno',
    hardStop: true,
    additionalGateQuestions: ['Any abdominal trauma or fall?'],
    followUps: [],
  },
  {
    id: 'vomiting',
    gateQuestion: 'Have you vomited in the past 24 hours?',
    gateType: 'yesno',
    hardStop: false,
    followUps: [
      { id: 'vomiting-how-many-times', prompt: 'How many times?', type: 'number' },
      { id: 'vomiting-keep-fluids-down', prompt: 'Can you keep fluids down?', type: 'yesno' },
      { id: 'vomiting-blood-or-colour', prompt: 'Any blood or green/brown vomit?', type: 'yesno' },
      {
        id: 'vomiting-associated-symptoms',
        prompt: 'Any abdominal pain, fever, dark urine, dizziness, or weight loss?',
        type: 'multiselect',
        options: [
          { value: 'abdominal-pain', label: 'Abdominal pain' },
          { value: 'fever', label: 'Fever' },
          { value: 'dark-urine', label: 'Dark urine' },
          { value: 'dizziness', label: 'Dizziness' },
          { value: 'weight-loss', label: 'Weight loss' },
          { value: 'none-of-these', label: 'None of these' },
        ],
        // Cross-category overlap: Pain is asked earlier in the walking order
        // (modelling decision (c)), so its gate answer is available here.
        overlapsWith: ['pain'],
      },
    ],
  },
  {
    id: 'movement',
    gateQuestion: 'Has the baby moved less, stopped, or changed from normal?',
    gateType: 'yesno',
    hardStop: false,
    followUps: [
      { id: 'movement-last-felt', prompt: 'When was the last movement?', type: 'text' },
      {
        id: 'movement-returned-after-rest',
        prompt: 'Did movement return after rest or food?',
        type: 'yesno',
        // No-downgrade rule (placeholder_content): captured for the
        // clinician's benefit only. src/logic/escalationTier.ts and
        // src/logic/disposition.ts never read this field — see their header
        // comments.
      },
    ],
  },
];

/**
 * Cross-category overlap (placeholder_content) — given the category ids a
 * follow-up's `overlapsWith` names, and the answers recorded so far this
 * session, returns a plain factual recap of what was already captured for
 * those categories, or null if none of them have been answered yet (in
 * which case the follow-up renders as an ordinary blank prompt — "the only
 * requirement: IF a fact was already captured this session, show what was
 * recorded"). This performs no inference, scoring, or cross-category
 * reasoning: it only echoes gate answers she already gave, verbatim.
 */
export function overlapRecap(categoryIds: string[], answers: CategoryAnswer[]): string | null {
  const lines = categoryIds
    .map((id) => {
      const category = redFlagCategories.find((c) => c.id === id);
      const answer = answers.find((a) => a.categoryId === id);
      if (!category || !answer) {
        return null;
      }
      return `${category.gateQuestion} — ${answer.gateAnswer === 'yes' ? 'Yes' : 'No'}`;
    })
    .filter((line): line is string => line !== null);
  if (lines.length === 0) {
    return null;
  }
  return `Already recorded this session — ${lines.join('; ')}.`;
}

/**
 * Formats a FollowUpAnswerValue for display — "her" bubble in the
 * conversation, the review screen, and the PDF all call this one function
 * so the three never drift apart. `options` resolves a select/multiselect
 * value to its label rather than its raw value string (e.g.
 * 'heavier-than-a-period' -> 'Heavier than a period').
 */
export function formatFollowUpAnswerValue(
  value: FollowUpAnswerValue,
  options?: FollowUpOption[]
): string {
  const labelFor = (raw: string): string => options?.find((o) => o.value === raw)?.label ?? raw;
  switch (value.type) {
    case 'yesno':
      return value.value === 'yes' ? 'Yes' : 'No';
    case 'text':
      return value.value;
    case 'number':
      return String(value.value);
    case 'select':
      return labelFor(value.value);
    case 'multiselect':
      return value.value.length > 0 ? value.value.map(labelFor).join(', ') : 'None';
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// Patient-facing clinical copy — centralised here per the rule at the top of
// this file. Never scatter clinical wording across components; import it
// from here instead.
// ---------------------------------------------------------------------------

/** The default, always-quieter secondary 999 route rendered under the
 * primary emergency control (src/components/EmergencyCall.tsx). */
export const EMERGENCY_DEFAULT_NOTE = 'Heavy bleeding, collapse, or fitting: call 999';

/** The bleeding-specific 999 variant, shown instead of the default note once
 * she has answered yes to the Bleeding category's gate question in the
 * red-flag questionnaire. Rendered on both the triage flow
 * (src/screens/TriageFlow.tsx) and the outcome screen (src/screens/Outcome.tsx)
 * — one constant, not two copies.
 *
 * Rekeyed from the old flat question id `bleeding-fluid` to the amended
 * schema's `BLEEDING_CATEGORY_ID` ('bleeding') — see the load-bearing-id
 * comment on that constant, above. Fluid loss is now its own category
 * ('fluid') rather than folded into this one, so this note is checked
 * against the Bleeding category's gate answer specifically. */
export const BLEEDING_EMERGENCY_NOTE = 'Bleeding was flagged. If it becomes heavy, call 999.';

/** The alert framing block's title and body (src/components/AlertFramingBlock.tsx),
 * shown when Home is in its alert state. Body updated per the founder's
 * "Speak to Kindred" rename of the persistent check-in control (owned by a
 * concurrent change to Home/CheckInControl/AlertFramingBlock — this file is
 * the one place their copy is allowed to be edited from here). */
export const ALERT_FRAMING_TITLE = "Worth checking on your baby's movements.";
export const ALERT_FRAMING_BODY =
  'You know your baby best. Speak to Kindred if anything feels different.';

/** Fixed disclaimer that must appear on every generated report. */
export const REPORT_DISCLAIMER =
  "This report includes movement data from a consumer wearable. It is supporting context for the clinical team, not a clinical measurement.";

// ---------------------------------------------------------------------------
// Conversational check-in framing (design-plan.md §14.2). Patient-facing, so
// it lives here with the rest of the clinical copy — never in a component.
//
// Voice rules these obey (design-plan.md §10, §14.2): second person only, no
// first person anywhere, sentence case, no exclamation marks, never
// evaluative, never responsive to what she wrote. Structural only.
// ---------------------------------------------------------------------------

/** Opens the conversation, before the first category's gate question.
 *
 * Amended from "Six short questions..." — the flat six-question set really
 * was six questions, but a category can now expand into several follow-ups
 * once its gate is answered yes, so promising a fixed count of six would be
 * broken the first time she answers one yes. "A few" is the honest version. */
export const CHECK_IN_OPENING =
  'A few short questions, then you can add anything in your own words.';

/** The one acknowledgement inside the category run. Appears exactly once,
 * after the first category resolves, so she learns the rhythm — not after
 * every category, which would become identical lines of noise. */
export const CHECK_IN_FIRST_ACK = 'Thank you. Here is the next one.';

/** Opens the auto-detail beat after a category's gate is answered yes and
 * its follow-ups are complete (design-plan.md §15, generalised from "per
 * question" to "per category"). */
export const CHECK_IN_DETAIL_INVITE = 'Anything you want to add about that?';

/** Rendered as a caption directly beneath CHECK_IN_DETAIL_INVITE, inside the
 * same bubble. The only place voice notes are introduced. */
export const CHECK_IN_DETAIL_HINT =
  'Type it, or record a voice note. This is optional.';

/** Opens the closing free-text beat, after the last category. */
export const CHECK_IN_CLOSING_INVITE =
  'Those are the questions. Anything else your clinic should know, in your own words?';

/** Closes the conversation, whether she wrote something or skipped. */
export const CHECK_IN_CLOSING_ACK = 'Thank you. You can look everything over before you send it.';

/** Shown inline, quietly, only when she asked to record and the browser
 * refused or has no microphone. Never a dialog, never a toast, never a retry
 * button (design-plan.md §15.5). */
export const CHECK_IN_MIC_UNAVAILABLE =
  'Voice notes are not available on this device. You can type instead.';

// ---------------------------------------------------------------------------
// Hard-stop interrupt (placeholder_content "Hard-stop rule"). The instant a
// Collapse/seizure/trauma question is answered yes, the conversation exits
// immediately and review is skipped — these strings cover the one path that
// stays open afterward: a quiet, optional way back in to add more, which
// never changes the emergency number already shown (src/screens/Outcome.tsx,
// src/screens/triage/CheckInConversation.tsx).
// ---------------------------------------------------------------------------

/** The quiet link on the emergency outcome screen back into the
 * conversation. Deliberately not styled as a call to action — adding more
 * detail is optional and must never look like a required next step. */
export const EMERGENCY_ADD_MORE_LABEL = 'Add more detail for your clinic';

/** Replaces CHECK_IN_CLOSING_ACK when she returns via EMERGENCY_ADD_MORE_LABEL
 * — there is no review to send her to (it stayed skipped), so the closing
 * line says what actually happens instead of promising a review screen. */
export const CHECK_IN_HARD_STOP_CLOSING_ACK = 'Thank you. This has been added to your report.';

/** The button that returns her to the outcome screen after adding more,
 * once a hard stop has already fired. Replaces "Continue to review" on that
 * path — there is nothing to review, and the number she is returning to is
 * unchanged (no-downgrade rule: nothing she adds here can move her out of
 * the emergency tier). */
export const CHECK_IN_RETURN_TO_EMERGENCY_LABEL = 'Back to your emergency contact';

/** Appended to a report section when a voice note is attached. Factual only:
 * it states that a recording exists and where the clinic can get it. It never
 * describes, transcribes, or characterises the recording. */
export const REPORT_VOICE_NOTE_NOTE =
  'A voice note was recorded and is available to the clinic.';

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
