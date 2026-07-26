/**
 * Shared types — single source of truth for the Kindred prototype.
 *
 * Later agents (screens, logic, design) should import from here and never
 * redefine or fork these shapes. If a screen needs a new field, add it here.
 */

// ---------------------------------------------------------------------------
// Clinic / patient
// ---------------------------------------------------------------------------

export interface ClinicHours {
  /** 24h "HH:MM", e.g. "08:00" */
  opens: string;
  /** 24h "HH:MM", e.g. "18:00" */
  closes: string;
  /** Human-readable days description, e.g. "every day" */
  daysDescription: string;
}

export interface Clinic {
  name: string;
  triagePhoneNumber: string;
  hours: ClinicHours;
}

export interface MaternityUnit {
  name: string;
  /** 24/7 triage line. */
  triagePhoneNumber: string;
}

export interface Patient {
  name: string;
  gestationWeeks: number;
  clinic: Clinic;
  bookedUnit: MaternityUnit;
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export type YesNoUnsure = 'yes' | 'no' | 'not-sure';

export type HistoryFlag =
  | 'bleeding'
  | 'reduced-movement-before'
  | 'previous-loss'
  | 'high-blood-pressure'
  | 'diabetes'
  | 'none-of-these';

/**
 * `detailVoiceNote` is the spoken alternative to the matching `detail` field:
 * both optional-detail boxes in onboarding carry a mic, for the same reason
 * the check-in's composers do — a woman who would rather say it than type it
 * must not have to type it. OPTIONAL, and never a replacement for `detail`:
 * she may record instead of typing, as well as typing, or neither.
 *
 * Additive on purpose. `onboarding_history` is persisted as a single JSON
 * column (src/lib/backend/supabaseBackend.ts), so this needs no migration
 * and an older stored row simply has no note — which is the truth about it.
 */
export interface OnboardingAnswers {
  weeksPregnant: number | null;
  extraMonitoring: {
    answer: YesNoUnsure | null;
    detail: string;
    detailVoiceNote?: VoiceNote | null;
  };
  history: {
    selected: HistoryFlag[];
    detail: string;
    detailVoiceNote?: VoiceNote | null;
  };
}

// ---------------------------------------------------------------------------
// Red-flag triage questionnaire (held-build-brief.md placeholder_content —
// amended: six categories, each a gate question plus conditional follow-ups.
// The category/follow-up *schema* shapes (RedFlagCategory, RedFlagFollowUp,
// FollowUpType, FollowUpOption) live in src/data/clinicalContent.ts, next to
// the data itself, following the same precedent as OnboardingQuestion. This
// section holds the *answer* shapes — the values captured while she's
// walking through the conversation — which is where RedFlagAnswer used to
// live too.
// ---------------------------------------------------------------------------

export type YesNo = 'yes' | 'no';

/**
 * A follow-up's recorded value, tagged by the same `type` the follow-up's
 * schema entry carries (src/data/clinicalContent.ts `RedFlagFollowUp`). The
 * tag lets every consumer (conversation UI, review, PDF) narrow to the right
 * shape without a second lookup into the schema.
 */
export type FollowUpAnswerValue =
  | { type: 'yesno'; value: YesNo }
  | { type: 'text'; value: string }
  | { type: 'number'; value: number }
  | { type: 'select'; value: string }
  | { type: 'multiselect'; value: string[] };

export interface FollowUpAnswer {
  followUpId: string;
  value: FollowUpAnswerValue;
  /**
   * A voice note recorded into a `text` follow-up's composer, if any.
   *
   * An ATTACHMENT ON THE RECORD, not a member of `FollowUpAnswerValue` —
   * exactly the shape `CategoryAnswer` already uses for its own
   * `detail`/`voiceNote` pair. Audio is not a formattable value, so putting
   * it inside the tagged union would mean every consumer of
   * `formatFollowUpAnswerValue` had to know to ignore one field of one
   * variant.
   *
   * Only ever set on a `text` follow-up: a mic is offered wherever she can
   * type free text and nowhere else (there is no spoken answer to a number
   * or a chip row).
   */
  voiceNote?: VoiceNote;
}

/**
 * A recorded voice note (design-plan.md §15.6). The prototype is offline and
 * never uploads or persists audio — `url` is either a local browser object
 * URL (real recordings) or a data URL (the demo panel's synthetic note).
 */
export interface VoiceNote {
  /** Object URL (or data URL, for the demo injection) for local playback. */
  url: string;
  /** Whole seconds, measured with performance.now() at start and stop. Never
   * read from audio.duration, which reports Infinity for a webm blob the
   * browser recorded itself. */
  durationSeconds: number;
  /** The MIME type the recorder actually produced, e.g. 'audio/webm'. */
  mimeType: string;
}

/**
 * Everything captured for one category this session. `gateAnswer` is the
 * category's primary gate question; `additionalGateAnswers` only exists for
 * a hard-stop category with more than one gate question (modelling decision
 * — see the header comment on `redFlagCategories` in
 * src/data/clinicalContent.ts) and is ordered to match
 * `RedFlagCategory.additionalGateQuestions`.
 *
 * `followUpAnswers` is only ever populated when the gate resolved 'yes' —
 * "gate no skips straight to the next category" (held-build-brief.md)
 * means there is nothing else to collect for a 'no' gate.
 *
 * `detail` / `voiceNote` are the category's own optional free-text/voice
 * beat (design-plan.md §15, generalised from "per question" to "per
 * category" — see CheckInConversation.tsx's header comment).
 */
export interface CategoryAnswer {
  categoryId: string;
  gateAnswer: YesNo;
  additionalGateAnswers?: YesNo[];
  followUpAnswers: FollowUpAnswer[];
  detail?: string;
  voiceNote?: VoiceNote;
}

// ---------------------------------------------------------------------------
// Entry path / app flow state
// ---------------------------------------------------------------------------

export type EntryPath = 'alert' | 'adhoc' | null;

export type ActivityVariant = 'quiet' | 'active';

// ---------------------------------------------------------------------------
// Sensor / activity data
// ---------------------------------------------------------------------------

export interface ActivitySample {
  timestamp: Date;
  moved: boolean;
}

/**
 * One interval's kick tally from the band (screens 01 and 08 — KickTrace).
 * The band reports movement and kicks over the same link, so both live
 * behind the one sensor boundary (src/sensors/MovementStream.ts).
 *
 * `kicks` is a COUNT OVER AN INTERVAL, not a value at an instant, and
 * `timestamp` is the START of that interval. There is no
 * "quality" or "confidence" field and no interpretation of any kind: the app
 * draws the shape of this and stops. A window with no samples renders
 * nothing at all — absence is absence (handoff README, invariants).
 */
export interface KickSample {
  timestamp: Date;
  kicks: number;
}

/**
 * A window of kick tallies, plus where the completed intervals end.
 *
 * `settledIndex` is the last sample the band has confirmed; anything after
 * it is still arriving and is drawn as the greyed incoming edge on the live
 * view (handoff README, screen 08 — the gradient's hard switch at 62%, with
 * the live-sample dot at the switch point). On a settled window
 * (`getKickWindow`) it is simply the last index.
 */
export interface KickWindow {
  samples: KickSample[];
  settledIndex: number;
}

// ---------------------------------------------------------------------------
// Triage outcome
// ---------------------------------------------------------------------------

export interface TriageContact {
  label: string;
  number: string;
  reason: string;
  /**
   * Which kind of contact this is.
   *
   * NOTHING DIALS THIS ANY MORE. Every call control in the product is "Call
   * paramedics" on 999; `getTriageContact()` survives only to NAME a clinic
   * in the report's "sent to" line and to set expectations about when it will
   * be read. Kept as a field because those two uses still want to know which
   * of the two it resolved to.
   */
  kind: 'clinic' | 'unit' | 'emergency';
}

export interface ReportData {
  patientName: string;
  gestationWeeks: number;
  entryPath: EntryPath;
  submittedAt: Date;
  categoryAnswers: CategoryAnswer[];
  /**
   * True when at least one category has no entry in `categoryAnswers` — the
   * check-in did not cover everything before it was sent.
   *
   * DERIVED, NEVER ASSERTED (src/screens/reportAssembly.ts). It used to be a
   * flag set by the hard-stop interrupt, which could end a check-in
   * mid-questionnaire; that interrupt was removed, so nothing sets it any
   * more — but a report that silently prints "no" for a question nobody
   * asked is the one failure mode this document cannot have, so the
   * distinction is now computed from the answers themselves and cannot fall
   * out of step with them.
   */
  endedBeforeAllCategories: boolean;
  freeTextDescription: string;
  /** A voice note attached to the closing free-text beat, if any
   * (design-plan.md §15.6). Never attached to a specific category — those
   * live on the matching CategoryAnswer instead. */
  freeTextVoiceNote: VoiceNote | null;
  onboardingHistory: OnboardingAnswers;
  /** The 24h of activity samples preceding submission. */
  recentActivity: ActivitySample[];
  /** Her personal typical movement level, for comparison. */
  activityBaseline: number;
  /**
   * The band's kick tallies, one per day, oldest first — the same window
   * Home's trace draws (`getDailyKickWindow`), so the clinician's line graph
   * and the chart she saw are the same data rather than two derivations of
   * it.
   *
   * DAILY, NOT HOURLY, and that is a choice about what the document is for.
   * `recentActivity` already covers the preceding 24 hours hour by hour; a
   * second 24-hour view would restate it at a different resolution, whereas a
   * week of daily tallies is the time-scale that view cannot show. The window
   * is a fixed measurement from the sensor boundary, not a span this report
   * requests — see MovementStream's kick section for why a day and an hour
   * are two different measurements rather than two samplings of one.
   *
   * An EMPTY window is a legitimate, expected value: a band with no signal
   * reports nothing, and `SupabaseMovementStream` has no kick table yet.
   * `settledIndex` is the last COMPLETE interval — the final sample is today,
   * still counting, and is always lower for that reason alone. Nothing in the
   * report may print it as a headline figure.
   */
  dailyKicks: KickWindow;
  disclaimer: string;
}
