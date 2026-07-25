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
// Red-flag triage questionnaire
// ---------------------------------------------------------------------------

/** Which answer to this question counts as a positive red flag. */
export type FlagWhen = 'yes' | 'no';

export interface RedFlagQuestion {
  id: string;
  question: string;
  flagWhen: FlagWhen;
}

export interface RedFlagAnswer {
  questionId: string;
  answer: 'yes' | 'no';
  detail?: string;
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

// ---------------------------------------------------------------------------
// Triage outcome
// ---------------------------------------------------------------------------

export interface TriageContact {
  label: string;
  number: string;
  reason: string;
  /** Which kind of contact this is, so callers can render an accurate
   * "Call the clinic" / "Call the unit" label instead of assuming. */
  kind: 'clinic' | 'unit';
}

export interface ReportData {
  patientName: string;
  gestationWeeks: number;
  entryPath: EntryPath;
  submittedAt: Date;
  redFlagAnswers: RedFlagAnswer[];
  freeTextDescription: string;
  onboardingHistory: OnboardingAnswers;
  /** The 24h of activity samples preceding submission. */
  recentActivity: ActivitySample[];
  /** Her personal typical movement level, for comparison. */
  activityBaseline: number;
  disclaimer: string;
}
