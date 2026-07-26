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

export interface OnboardingAnswers {
  weeksPregnant: number | null;
  extraMonitoring: {
    answer: YesNoUnsure | null;
    detail: string;
  };
  history: {
    selected: HistoryFlag[];
    detail: string;
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
 * One fetal heart-rate reading from the band (handoff README, screens 01 and
 * 08 — "HeartRateTrace"). The band reports movement and heart rate over the
 * same link, so both live behind the one sensor boundary
 * (src/sensors/MovementStream.ts).
 *
 * `bpm` is whole beats per minute as the band reports it. There is no
 * "quality" or "confidence" field and no interpretation of any kind: the app
 * draws the shape of this and stops. A window with no samples renders
 * nothing at all — absence is absence (handoff README, invariants).
 */
export interface HeartRateSample {
  timestamp: Date;
  bpm: number;
}

/**
 * A window of heart-rate samples, plus where the band's own settling ends.
 *
 * `settledIndex` is the last sample the band has confirmed; anything after
 * it is still arriving and is drawn as the greyed incoming edge on the live
 * view (handoff README, screen 08 — the gradient's hard switch at 62%, with
 * the live-sample dot at the switch point). On a settled window
 * (`getHeartRateWindow`) it is simply the last index.
 */
export interface HeartRateWindow {
  samples: HeartRateSample[];
  settledIndex: number;
}

// ---------------------------------------------------------------------------
// Triage outcome
// ---------------------------------------------------------------------------

export interface TriageContact {
  label: string;
  number: string;
  reason: string;
  /** Which kind of contact this is, so callers can render an accurate
   * label instead of assuming: "Call the clinic" / "Call the unit" for
   * `getTriageContact()`'s two results, or "Call 999" for the emergency-tier
   * pseudo-contact a screen builds itself (src/screens/Outcome.tsx) — never
   * returned by getTriageContact(), which never resolves to 999 (see that
   * function's header comment). */
  kind: 'clinic' | 'unit' | 'emergency';
}

export interface ReportData {
  patientName: string;
  gestationWeeks: number;
  entryPath: EntryPath;
  submittedAt: Date;
  categoryAnswers: CategoryAnswer[];
  /** True when this report was submitted by the hard-stop interrupt (held-
   * build-brief.md placeholder_content, "Hard-stop rule") rather than by
   * pressing Send on the review screen. When true, any category with no
   * entry in `categoryAnswers` was genuinely never reached — the report
   * must say so plainly rather than implying it was silently skipped or
   * answered no (src/logic/reportPdf.ts). */
  hardStopEndedEarly: boolean;
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
  disclaimer: string;
}
