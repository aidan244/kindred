/**
 * Report-assembly helper for the outcome screen.
 *
 * Owned by the triage/outcome screens (not src/logic/*, which belongs to a
 * different agent). Pure, small, and deliberately dumb: it just gathers the
 * pieces `ReportData` needs from app state, the patient fixture and the
 * movement stream, plus a couple of small honest-timeline helpers for the
 * outcome screen's routine state (is the clinic open right now, so we never
 * imply a human is reading the report when the clinic is shut).
 */

import type {
  ActivityVariant,
  CategoryAnswer,
  ClinicHours,
  EntryPath,
  OnboardingAnswers,
  ReportData,
  VoiceNote,
} from '../types';
import { redFlagCategories, REPORT_DISCLAIMER } from '../data/clinicalContent';
import { getMovementStream } from '../sensors/MovementStream';

export interface AssembleReportInput {
  patientName: string;
  gestationWeeks: number;
  entryPath: EntryPath;
  submittedAt: Date;
  categoryAnswers: CategoryAnswer[];
  freeTextDescription: string;
  freeTextVoiceNote: VoiceNote | null;
  onboardingHistory: OnboardingAnswers;
  activityVariant: ActivityVariant;
}

/** Assembles the full ReportData handed to downloadReportPdf(). */
export function assembleReportData(input: AssembleReportInput): ReportData {
  const stream = getMovementStream(input.activityVariant);
  return {
    patientName: input.patientName,
    gestationWeeks: input.gestationWeeks,
    entryPath: input.entryPath,
    submittedAt: input.submittedAt,
    categoryAnswers: input.categoryAnswers,
    // Derived here rather than passed in — see ReportData.endedBeforeAllCategories.
    endedBeforeAllCategories: redFlagCategories.some(
      (category) => !input.categoryAnswers.some((a) => a.categoryId === category.id)
    ),
    freeTextDescription: input.freeTextDescription,
    freeTextVoiceNote: input.freeTextVoiceNote,
    onboardingHistory: input.onboardingHistory,
    recentActivity: stream.getWindow(24),
    activityBaseline: stream.getBaseline(),
    // The SAME window Home's trace draws, straight off the sensor boundary —
    // so the line graph in the document and the chart she looked at are one
    // measurement, not two derivations that could disagree. An offline band
    // returns an empty window here, exactly as it does for `getWindow`.
    dailyKicks: stream.getDailyKickWindow(),
    disclaimer: REPORT_DISCLAIMER,
  };
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseHmToMinutes(hm: string): number {
  const [hours, minutes] = hm.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Whether the clinic (as opposed to the 24/7 maternity unit) is open at `date`. */
export function isClinicOpenAt(date: Date, hours: ClinicHours): boolean {
  const now = minutesSinceMidnight(date);
  const opens = parseHmToMinutes(hours.opens);
  const closes = parseHmToMinutes(hours.closes);
  return now >= opens && now < closes;
}

/** 24h "HH:MM" for `date`, local time — matches the demo panel's own format. */
export function formatClock(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
