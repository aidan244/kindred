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

import type {
  CategoryAnswer,
  FollowUpAnswerValue,
  HistoryFlag,
  Patient,
  TriageContact,
  YesNo,
  YesNoUnsure,
} from '../types';

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
  /** The short noun the review screen files this category under (handoff
   * README, screen 06 — each card's muted caption label). Distinct from
   * `gateQuestion`, which is what the conversation actually asks: "Are you
   * bleeding?" is a question, "Bleeding" is a heading. Patient-facing. */
  label: string;
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
    label: 'Bleeding',
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
    label: 'Fluid',
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
    label: 'Pain',
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
    label: 'Collapse or injury',
    gateQuestion: 'Any seizure, fainting, collapse, or head injury?',
    gateType: 'yesno',
    hardStop: true,
    additionalGateQuestions: ['Any abdominal trauma or fall?'],
    followUps: [],
  },
  {
    id: 'vomiting',
    label: 'Vomiting',
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
    label: 'Movements',
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

// ---------------------------------------------------------------------------
// The yes/no vocabulary.
//
// ONE DEFINITION, used everywhere. These two words appeared independently in
// six places (the conversation's chips, its answer bubbles, the review
// screen, the PDF and this file's own formatter), which meant the screen
// whose entire purpose is letting her verify what her clinic will read could
// drift out of step with the transcript it is verifying. Nothing may define
// "Yes"/"No" again: import `YES_NO_OPTIONS` for a chip row and `yesNoLabel`
// for a rendered answer.
// ---------------------------------------------------------------------------

export const YES_LABEL = 'Yes';
export const NO_LABEL = 'No';

/** The chips a gate question (or a `yesno` follow-up) offers. */
export const YES_NO_OPTIONS: readonly FollowUpOption[] = [
  { value: 'yes', label: YES_LABEL },
  { value: 'no', label: NO_LABEL },
];

/** One recorded yes/no answer, as she will read it back. */
export function yesNoLabel(value: YesNo): string {
  return value === 'yes' ? YES_LABEL : NO_LABEL;
}

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
      return `${category.gateQuestion} — ${yesNoLabel(answer.gateAnswer)}`;
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
      return yesNoLabel(value.value);
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

/**
 * THE ONE CALL ROUTE. Paramedics, and nothing else.
 *
 * This product used to offer three: her private clinic during its opening
 * hours, the 24/7 maternity unit outside them, and 999 as a quieter note
 * underneath — plus a separate operator line on every screen. That was
 * reduced to one on instruction ("if they need to call anyone it will be
 * paramedics"), because a person choosing between numbers is doing triage on
 * herself at the moment she is least able to, and because two call controls
 * on one screen is a decision nobody wanted to be asked to make.
 *
 * What that removed, recorded so nobody has to reconstruct it: the
 * clinic/unit distinction and the opening-hours logic behind it, the quiet
 * 999 fallback note, the bleeding-specific variant of that note, and the
 * operator row. `getTriageContact()` (src/logic/triageContact.ts) still
 * resolves a clinic, but only to NAME it in the report's "sent to" line — it
 * no longer resolves anything anyone dials.
 */
export const EMERGENCY_CALL_LABEL = 'Call paramedics';
export const EMERGENCY_NUMBER = '999';

/**
 * What a screen reader hears on the call control. A call control must state
 * WHAT IT CALLS (handoff README, accessibility), and "Call paramedics" on its
 * own does not say which number is about to be dialled.
 */
export const EMERGENCY_CALL_ACCESSIBLE_LABEL = `${EMERGENCY_CALL_LABEL} on ${EMERGENCY_NUMBER}`;

/** The alert framing block's title and body (src/components/AlertFramingBlock.tsx),
 * shown when Home is in its alert state. Body updated per the founder's
 * "Speak to Kindred" rename of the persistent check-in control (owned by a
 * concurrent change to Home/CheckInControl/AlertFramingBlock — this file is
 * the one place their copy is allowed to be edited from here). */
export const ALERT_FRAMING_TITLE = "Worth checking on your baby's movements.";
export const ALERT_FRAMING_BODY =
  'You know your baby best. Speak to Kindred if anything feels different.';

/** The one-tap way out of the alert block. Never a dialog, never a
 * confirmation (handoff README §02). */
export const ALERT_FRAMING_DISMISS_LABEL = 'Dismiss';

/**
 * The label on the product's primary action, in both the places it appears —
 * the docked CheckInControl and the alert block's accent pill. It used to be
 * exported from src/components/CheckInControl.tsx, which made a COMPONENT the
 * source of truth for copy another component imported; it is referenced in
 * prose throughout this file (ALERT_FRAMING_BODY, `outcomeRoutineWaitNote`),
 * none of which could be kept in step with a constant living over there.
 */
export const CHECK_IN_CONTROL_LABEL = 'Speak to Kindred';

/**
 * The simulated push notification (handoff README §02, PushBanner).
 *
 * The body's first sentence IS `ALERT_FRAMING_TITLE`, composed rather than
 * retyped: this is the most safety-sensitive sentence in the product — the
 * one governed by "lead with the action and her own perception, never a
 * diagnostic assertion" — and it existed as two independent copies, either of
 * which could be edited without the other. The trailing clause is the
 * banner's own: permission to wait.
 */
export const PUSH_BANNER_TITLE = 'Kindred';
export const PUSH_BANNER_BODY = `${ALERT_FRAMING_TITLE} Open when you're ready.`;

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

/** Appended to a report section when a voice note is attached. Factual only:
 * it states that a recording exists and where the clinic can get it. It never
 * describes, transcribes, or characterises the recording. */
export const REPORT_VOICE_NOTE_NOTE =
  'A voice note was recorded and is available to the clinic.';

// ---------------------------------------------------------------------------
// Screen copy (handoff README, "Screens"). Patient-facing, so it lives here
// with the rest of the copy — never inline in a component.
//
// Voice rules every string below obeys: second person, sentence case, no
// exclamation mark, no uppercase warning, and never the word "detected".
// Nothing here interprets data or offers a verdict.
// ---------------------------------------------------------------------------

/** 01 — the greeting, and the sync line beneath the avatar. Metadata about
 * the app rather than anything clinical: who is looking, and when the band
 * last spoke. Neither makes a claim about her or the baby. */
export function homeGreeting(firstName: string): string {
  return `Welcome back, ${firstName}.`;
}

/**
 * 01 — the invitation at the foot of the column, directly above the dock.
 *
 * BUILT FROM `CHECK_IN_CONTROL_LABEL`, never re-typed. It names the docked
 * control sitting immediately below it, and the two must say the same words: a
 * prompt that reads "Speak to Kindred" pointing at a button that says anything
 * else is a prompt pointing at nothing. Now that the two are adjacent rather
 * than a screen apart, they repeat the label in view of each other — deliberate
 * (the prompt is the sentence, the pill is the door), but it is the thing to
 * revisit first if this line is ever reworded.
 *
 * IT IS COPY, NOT A SECOND CONTROL. Home's dock already carries the primary
 * accent pill for this exact action, and this screen's own note explains why a
 * second one is wrong ("two filled accent pills would read as two different
 * actions"). This line tells her the door is there; the dock is the door.
 *
 * "Worried?" ADDRESSES HER, NOT THE DATA, which is what keeps it inside the
 * voice rules. It offers no assessment of her or the baby and makes no claim
 * about the sensor — it answers rule 2 (her perception always wins) by saying,
 * before anything is measured, that her own worry is reason enough. It is a
 * question rather than an instruction for the same reason: she decides.
 */
export const HOME_WORRIED_PROMPT = `Worried? ${CHECK_IN_CONTROL_LABEL}`;

/** The sync line's whole vocabulary, in one place. `NOT_YET_SYNCED` in
 * particular is a statement about the band's state sitting directly above
 * `bandOfflineCopy()`'s, so the two are written and reviewed together. */
export function homeSyncedAgo(latest: Date | null, nowMs: number): string {
  if (!latest) {
    return 'Not yet synced';
  }
  const diffMinutes = Math.round(Math.max(0, nowMs - latest.getTime()) / 60000);
  if (diffMinutes < 1) {
    return 'Synced just now';
  }
  if (diffMinutes === 1) {
    return 'Synced 1 minute ago';
  }
  if (diffMinutes < 60) {
    return `Synced ${diffMinutes} minutes ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return 'Synced 1 hour ago';
  }
  return `Synced ${diffHours} hours ago`;
}

/** 01 — the live-data card. */
export const HOME_WINDOW_LABEL = 'Last 24 hours';
export const HOME_KICKS_LABEL = "Baby's kicks";
/** The unit beside Home's big number: kicks counted TODAY so far. */
export const HOME_KICKS_UNIT = 'kicks today';
export const HOME_TRACE_START_LABEL = '7 days ago';
export const TRACE_NOW_LABEL = 'today';

/** The live view counts by the hour, so its trailing label is 'now'. */
export const TRACE_HOUR_NOW_LABEL = 'now';
export const HOME_OPEN_LIVE_VIEW = 'Open live view';

/** 01 — the band-offline variant. A statement about the hardware, never
 * about the baby, and it names the one thing she can actually do. */
export function bandOfflineCopy(sinceClock: string): string {
  return `No signal since ${sinceClock}. Check the band is on.`;
}

/** The same statement when there is no honest clock to quote — the card
 * mounted with the band already quiet, so this session never saw a sample.
 * Same voice, same two facts, one fewer claim. */
export const BAND_OFFLINE_NO_CLOCK = 'No signal from the band. Check the band is on.';

/**
 * What a screen reader hears in place of the trace (handoff README,
 * accessibility): a SUMMARY, never a data dump.
 *
 * It announces THE SAME NUMBER THE SCREEN SHOWS — Home's latest sample, the
 * live view's newest settled one — rather than a mean computed across the
 * window. A derived average would be the closest thing to a score anywhere in
 * this product, and it would be the version only non-sighted users get. No
 * range, no list of samples, and no adjective that characterises the data
 * ("steady", "normal", "reassuring"): those are verdicts, and this product
 * does not have one.
 */
export function kickTraceCardSummary(kicks: number): string {
  // Announces the last COMPLETE day, which is the sample the dot marks —
  // never today's running total, because a partial day is always lower and
  // reading it aloud as the current figure would imply a fall every morning.
  return `Your baby's kicks, by day, over the last week. ${kicks} kicks on the last full day.`;
}

export function kickTraceLiveSummary(kicks: number): string {
  return `Your baby's kicks, by hour. ${kicks} kicks in the last full hour.`;
}

/** 03 — the third chip on a gate question: a way to answer in her own words
 * instead of picking one of the two. */
export const CHECK_IN_ADD_MORE_INFO = 'Add more info';
/** …and the way back out of it. */
export const CHECK_IN_BACK_TO_OPTIONS = 'Back';

/** 04/06 — the affordance that lets her change an answer she already gave.
 * Never a tick, never a pencil: the words say what it does. */
export const CHANGE_THIS_LABEL = 'Change this';

/** What a screen reader hears on that affordance. The visible words are the
 * same on every card and every exchange, so the accessible name names the
 * thing being changed — one sentence pattern, reviewed here with the rest of
 * the voice rather than assembled at four different call sites. */
export function changeAnswerAccessibleLabel(prompt: string): string {
  return `Change your answer to: ${prompt}`;
}

/** 03/04 — the button that commits a multiselect follow-up, and the one that
 * leaves the conversation for review. */
export const CHECK_IN_CONTINUE_LABEL = 'Continue';
export const CHECK_IN_CONTINUE_TO_REVIEW_LABEL = 'Continue to review';
/** …and the way past the closing beat without adding anything. */
export const CHECK_IN_CLOSING_SKIP_LABEL = 'Nothing to add';

/** The check-in's own accessible framing: the screen's name (visually the
 * conversation speaks for itself, so the heading is screen-reader only), and
 * what the progress rail announces. The rail carries no numeral visually, and
 * it counts CATEGORIES — the unit it actually measures — never questions,
 * whose total she was never promised. */
export const CHECK_IN_SCREEN_TITLE = 'Check in';
export const CHECK_IN_PROGRESS_LABEL = 'Check-in progress';
export function checkInProgressValueText(answered: number, total: number): string {
  return `${answered} of ${total} answered`;
}

/** 05 — the composer. */
export const COMPOSER_PLACEHOLDER = 'Type here';
export const COMPOSER_SKIP_LABEL = 'Skip this';
export const COMPOSER_SEND_LABEL = 'Send';

/** 06 — review. */
export const REVIEW_TITLE = 'Check everything';
export const REVIEW_LEAD = 'This is what goes to your clinic. You can change any answer.';
export const REVIEW_FREE_TEXT_LABEL = 'In your own words';
export const REVIEW_SEND_LABEL = 'Send this to your clinic';
export const REVIEW_SEND_NOTE = "A midwife reads it. If it can't wait, call instead.";

/** 07 — the emergency outcome. */
export const OUTCOME_EMERGENCY_TITLE = 'Please call paramedics now.';

/**
 * The one sentence that tells the call handler who she is, built from what
 * she actually gave us rather than hard-coded. Gestation always; then the
 * single most urgent thing she flagged, in her own categories' words. Never
 * a diagnosis, never a severity score — it is a handover line, not an
 * assessment.
 */
export function emergencyHandoverLead(
  gestationWeeks: number,
  answers: CategoryAnswer[]
): string {
  const flagged = (id: string): boolean =>
    answers.some((a) => a.categoryId === id && a.gateAnswer === 'yes');
  const heavyBleeding =
    flagged(BLEEDING_CATEGORY_ID) &&
    answers.some((a) =>
      a.followUpAnswers.some(
        (f) =>
          f.followUpId === BLEEDING_HOW_MUCH_FOLLOWUP_ID &&
          f.value.type === 'select' &&
          HEAVY_BLEEDING_VALUES.includes(f.value.value)
      )
    );

  const opening = `Tell them you are ${gestationWeeks} weeks pregnant`;
  if (heavyBleeding) {
    return `${opening} and bleeding heavily.`;
  }
  if (flagged(BLEEDING_CATEGORY_ID)) {
    return `${opening} and bleeding.`;
  }
  if (flagged(COLLAPSE_CATEGORY_ID)) {
    return `${opening} and tell them what happened.`;
  }
  return `${opening} and tell them what you told Kindred.`;
}

export const OUTCOME_EMERGENCY_ADVICE =
  'Stay where you are, lie on your left side, and unlock the front door if you can.';

/**
 * Names where the report has already gone, so she does not have to explain it
 * twice. Factual, and never a promise about what happens next.
 *
 * IT USED TO END "They know you are calling." That sentence was cut: there is
 * no acknowledgement channel, no receipt, and no mechanism by which the clinic
 * could know she is about to dial 999 — and this string is rendered on the
 * emergency screen, which is the one place in the product where a false
 * reassurance costs the most. What the app knows is that her answers were
 * sent. It says that, and stops.
 */
export function outcomeReportSentNote(clinicName: string): string {
  return `Your answers have gone to ${clinicName}.`;
}

// ---------------------------------------------------------------------------
// 07 — the other two outcome states (handoff README draws the emergency tier
// only; the triage tier and the routine state are the same composition with
// different content — see src/screens/Outcome.tsx).
//
// WHAT THE ROUTINE STATE IS ALLOWED TO SAY. Only what the app can stand
// behind: that she pressed Send, when, and when her clinic is open. It used to
// assert "Received by your clinic" and "Clinician reviewing" as timeline rows
// and "Your report is in their queue." as prose — three claims about a third
// party's system that nothing in this app confirms (`submitReport()` sets
// local React state; there is no transport). All three are gone rather than
// softened, because a softer wording would still be a claim.
// ---------------------------------------------------------------------------

/** The triage tier's title. Not "Please call 999 now." — in this tier 999 is
 * the quiet secondary route, not the number on the pill, and a title naming a
 * number she is not being asked to ring first would be actively wrong. */
export const OUTCOME_ESCALATE_TRIAGE_TITLE = 'Call now';

/** The triage tier's lead. It used to be the resolved contact's own `reason`
 * ("Your clinic is open now, call this number."), which named a route that no
 * longer exists. This says what is true instead. */
export const OUTCOME_ESCALATE_TRIAGE_LEAD =
  'Something you have told us needs looking at now.';

export const OUTCOME_DOWNLOAD_ESCALATE_LABEL = 'Download your report to bring with you';
export const OUTCOME_DOWNLOAD_ROUTINE_LABEL = 'Download your report';

/** The routine state's title once she has pressed Send. */
export const OUTCOME_ROUTINE_TITLE = 'Sent to your clinic';
/** …and when this screen is reached with nothing submitted (a direct visit to
 * /outcome, which is a real route). Nothing was sent, so nothing is claimed —
 * the screen names the clinic and states its hours, and that is all. */
export const OUTCOME_ROUTINE_NO_SUBMISSION_TITLE = 'Your clinic';

/** The one thing the app witnessed: she pressed Send, at this time. */
export function outcomeRoutineSentLead(clinicName: string, sentClock: string): string {
  return `Sent to ${clinicName} at ${sentClock}.`;
}

/** The clinic's hours, and nothing about what anyone there is doing. */
export function outcomeRoutineClinicHours(
  clinicName: string,
  clinicOpen: boolean,
  clinicOpensAt: string
): string {
  return clinicOpen ? `${clinicName} is open now.` : `${clinicName} opens at ${clinicOpensAt}.`;
}

export function outcomeRoutineWaitNote(contactLabel: string): string {
  return `If anything changes, ${lowerFirstWord(
    CHECK_IN_CONTROL_LABEL
  )} again or call ${contactLabel}.`;
}

/** The routine state's plain (never red, never EmergencyCall) call row. */
export function outcomeCallContactLabel(contactLabel: string): string {
  return `Call ${contactLabel}`;
}

/** Lowercases the first word of a schema-authored label so it can sit
 * mid-sentence. Only ever applied to copy in this file, never to anything she
 * typed. */
function lowerFirstWord(value: string): string {
  return value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

// ---------------------------------------------------------------------------
// The triage-contact sentence (src/logic/triageContact.ts resolves WHICH
// contact; the words she reads are authored here). It is rendered as the
// outcome screen's `lead` paragraph — the largest body copy on that screen —
// so it belongs with the rest of the voice rather than inside a routing
// function with unit tests attached.
// ---------------------------------------------------------------------------

export function triageContactReason(
  kind: TriageContact['kind'],
  clinicOpensAt: string
): string {
  return kind === 'clinic'
    ? 'Your clinic is open now, call this number.'
    : `Your clinic is closed until ${clinicOpensAt}, call the maternity unit instead.`;
}

/** 08 — live view. */
export const LIVE_VIEW_TITLE = 'Live view';
export const LIVE_VIEW_UNIT_CAPTION = "kicks in the last full hour";
export const LIVE_VIEW_TRACE_START_LABEL = '12 hours ago';

export function liveViewSessionCaption(sinceClock: string): string {
  return `Listening since ${sinceClock}. The band is connected.`;
}

/** 08 — the session ring's control. It is a toggle, not two controls, so it
 * carries one name in both states (see SessionRing.tsx). */
export const LIVE_VIEW_PAUSE_LABEL = 'Pause listening';

// ---------------------------------------------------------------------------
// Voice notes (handoff README §05). These name an object and two controls in
// the interface; they are still words she reads, so they live here.
// ---------------------------------------------------------------------------

export const VOICE_NOTE_LABEL = 'Voice note';
export const VOICE_NOTE_RECORD_AGAIN_LABEL = 'Record again';
export const VOICE_NOTE_DELETE_LABEL = 'Delete';
/** Accessible names for the recorder and the player — a control must say what
 * it does. */
export const VOICE_NOTE_RECORD_ACCESSIBLE_LABEL = 'Record a voice note';
export const VOICE_NOTE_STOP_ACCESSIBLE_LABEL = 'Stop recording';
export const VOICE_NOTE_PLAY_ACCESSIBLE_LABEL = 'Play voice note';
export const VOICE_NOTE_PAUSE_ACCESSIBLE_LABEL = 'Pause voice note';

// ---------------------------------------------------------------------------
// Navigation. Structural rather than clinical — the caret names a control and
// says nothing to her — but it is one word appearing on four screens, so it is
// defined once rather than four times.
// ---------------------------------------------------------------------------

export const BACK_LABEL = 'Back';

// ---------------------------------------------------------------------------
// Onboarding (src/screens/Onboarding.tsx and src/screens/onboarding/*).
//
// Onboarding is not one of the eight handoff screens, but the rule as stated
// is "all patient-facing copy", with no carve-out — and this file already owns
// the onboarding QUESTIONS (`onboardingQuestions`, above), so the questions and
// the chrome that presents them were split across two locations. They are one
// location now. Same voice rules as everything above: second person, sentence
// case, no exclamation mark, no uppercase, never the word "detected".
// ---------------------------------------------------------------------------

export const ONBOARDING_CONTINUE_LABEL = 'Continue';
export const ONBOARDING_PROGRESS_LABEL = 'Setup progress';
/** Plain language rather than the percentage a screen reader would otherwise
 * compute for a rail whose whole point is that it never shows one — the same
 * treatment `checkInProgressValueText` gives the check-in's rail. */
export function onboardingProgressValueText(answered: number, total: number): string {
  return `${answered} of ${total} answered`;
}

export const ONBOARDING_MULTI_SELECT_HINT = 'Select all that apply.';
export const ONBOARDING_OPTIONAL_DETAIL_LABEL = 'Anything you’d like to add (optional)';
export const ONBOARDING_OPTIONAL_DETAIL_PLACEHOLDER =
  'Share as much or as little as you want';
export const ONBOARDING_WEEKS_UNIT = 'weeks';

export const NOT_SURE_LABEL = 'Not sure';
export const YES_NO_UNSURE_OPTIONS: readonly { value: YesNoUnsure; label: string }[] = [
  { value: 'yes', label: YES_LABEL },
  { value: 'no', label: NO_LABEL },
  { value: 'not-sure', label: NOT_SURE_LABEL },
];

/** The closing pairing beat. Both lines are about the hardware and make no
 * claim about her or the baby. */
export const ONBOARDING_PAIRING_TITLE = 'Your band is paired.';
export const ONBOARDING_PAIRING_BODY =
  'It sends your movement data to Kindred while you wear it.';

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
