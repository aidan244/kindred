/**
 * Turns a CanonicalReportData into plain-text/tabular section content, with
 * no jsPDF dependency — mirrors the frontend's own src/logic/reportPdf.ts
 * three-layer split (sections / layout / save) on purpose: it's what makes
 * forbidden-word and structure checks possible without parsing a PDF
 * binary. `pdf.ts` only lays this out on the page; it never composes
 * additional wording.
 */

import { onboardingQuestions } from '../../data/clinicalContent';
import type { HistoryFlag } from '../../types';
import { WINDOWS_PER_BIN } from '../movement/aggregate.ts';
import { longestQuietInterval } from '../movement/features.ts';
import type { MovementBin, QuietInterval } from '../movement/types.ts';
import type { CanonicalReportData, PriorEpisode, RedFlagEntry } from './types.ts';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatDateOnly(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function formatUtcOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function formatDateTime24hWithTz(date: Date): string {
  return `${formatDateOnly(date)}, ${pad2(date.getHours())}:${pad2(date.getMinutes())} (${formatUtcOffset(date)})`;
}

/** Weeks + days at `now`, derived from EDD (never stored stale) — the same
 * derivation as supabaseBackend.ts's gestationWeeksAt, extended to also
 * return the remainder in days, since the report wants "weeks+days". */
export function gestationWeeksAndDaysAt(edd: Date, now: Date): { weeks: number; days: number } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.round((edd.getTime() - now.getTime()) / msPerDay);
  const gestationDays = Math.max(0, 280 - daysUntilDue);
  return { weeks: Math.floor(gestationDays / 7), days: gestationDays % 7 };
}

export function formatGestation(edd: Date, now: Date): string {
  const { weeks, days } = gestationWeeksAndDaysAt(edd, now);
  if (days === 0) {
    return `${weeks} weeks`;
  }
  return `${weeks} weeks ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function formatEntryPath(entryPath: 'alert' | 'adhoc'): string {
  return entryPath === 'alert'
    ? 'Prompted by wearable activity alert'
    : 'Patient-initiated check-in';
}

export function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : fullName;
}

export function reportFilename(patientName: string, generatedAt: Date): string {
  const stamp = `${generatedAt.getFullYear()}${pad2(generatedAt.getMonth() + 1)}${pad2(
    generatedAt.getDate()
  )}-${pad2(generatedAt.getHours())}${pad2(generatedAt.getMinutes())}`;
  return `Held_Report_${surnameOf(patientName)}_${stamp}.pdf`;
}

// ---------------------------------------------------------------------------
// Movement figures (section 5) — reusing Phase 2's own feature functions
// rather than re-deriving them.
// ---------------------------------------------------------------------------

export interface MovementFigures {
  activeFraction: number;
  baselineFraction: number;
  coveragePercent: number;
  quietInterval: QuietInterval | null;
}

export function computeMovementFigures(bins: MovementBin[], baselineFraction: number): MovementFigures {
  let active = 0;
  let covered = 0;
  for (const bin of bins) {
    active += bin.activeWindows;
    covered += bin.coveredWindows;
  }
  const totalPossibleWindows = bins.length * WINDOWS_PER_BIN;
  return {
    activeFraction: covered > 0 ? active / covered : 0,
    baselineFraction,
    coveragePercent: totalPossibleWindows > 0 ? (covered / totalPossibleWindows) * 100 : 0,
    quietInterval: longestQuietInterval(bins),
  };
}

export interface HourlyMovementBucket {
  hourLabel: string;
  covered: boolean;
  activeFraction: number;
}

/** 24 hourly buckets, oldest first, ending at `now` — for the vector band
 * in pdf.ts. Uncovered hours (no covered windows at all that hour) are
 * marked, never given a synthetic zero-activity bar (clinical safety rule
 * 4: absence of data is never rendered as stillness). */
export function buildHourlyBuckets(bins: MovementBin[], now: Date): HourlyMovementBucket[] {
  const HOUR_MS = 60 * 60 * 1000;
  const HOURS = 24;
  const totals = Array.from({ length: HOURS }, () => ({ active: 0, covered: 0 }));

  for (const bin of bins) {
    const hoursAgo = Math.floor((now.getTime() - bin.t.getTime()) / HOUR_MS);
    const index = HOURS - 1 - hoursAgo;
    if (index < 0 || index >= HOURS) {
      continue;
    }
    totals[index].active += bin.activeWindows;
    totals[index].covered += bin.coveredWindows;
  }

  return totals.map((totalsForHour, i) => {
    const hourStart = new Date(now.getTime() - (HOURS - 1 - i) * HOUR_MS);
    return {
      hourLabel: `${pad2(hourStart.getHours())}:00`,
      covered: totalsForHour.covered > 0,
      activeFraction: totalsForHour.covered > 0 ? totalsForHour.active / totalsForHour.covered : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Onboarding history prose (section 7)
// ---------------------------------------------------------------------------

const historyQuestion = onboardingQuestions.find(
  (q) => q.id === 'history' && q.type === 'multi-select'
);
const historyOptionLabels = new Map<HistoryFlag, string>(
  (historyQuestion && historyQuestion.type === 'multi-select' ? historyQuestion.options : []).map(
    (option) => [option.value, option.label]
  )
);

function historyFlagLabel(flag: HistoryFlag): string {
  return historyOptionLabels.get(flag) ?? flag;
}

function buildOnboardingParagraphs(data: CanonicalReportData): string[] {
  const { onboardingHistory } = data;
  const paragraphs: string[] = [];

  paragraphs.push(
    onboardingHistory.weeksPregnant != null
      ? `Weeks pregnant recorded at onboarding: ${onboardingHistory.weeksPregnant}.`
      : 'Weeks pregnant at onboarding: not recorded.'
  );

  const monitoringAnswer = onboardingHistory.extraMonitoring.answer;
  const monitoringLabel =
    monitoringAnswer === 'yes' ? 'Yes' : monitoringAnswer === 'no' ? 'No' : 'Not sure';
  const monitoringDetail = onboardingHistory.extraMonitoring.detail?.trim();
  paragraphs.push(
    monitoringDetail
      ? `Under consultant-led care or extra monitoring: ${monitoringLabel} (${monitoringDetail}).`
      : `Under consultant-led care or extra monitoring: ${monitoringLabel}.`
  );

  const selected = onboardingHistory.history.selected.map(historyFlagLabel);
  const historyDetail = onboardingHistory.history.detail?.trim();
  const selectedText = selected.length > 0 ? selected.join(', ') : 'None recorded';
  paragraphs.push(
    historyDetail
      ? `Relevant history from this or a previous pregnancy: ${selectedText} (${historyDetail}).`
      : `Relevant history from this or a previous pregnancy: ${selectedText}.`
  );

  return paragraphs;
}

// ---------------------------------------------------------------------------
// Section assembly
// ---------------------------------------------------------------------------

export interface ReportSections {
  documentTitle: string;
  clinicName: string;
  generatedLine: string;
  patientIdentification: string[];
  reasonForContact: string[];
  redFlagEntries: RedFlagEntry[];
  description: { structuredParagraphs: string[]; verbatimHighlights: string[]; rawFallback: string | null };
  movementFigures: MovementFigures;
  hourlyBuckets: HourlyMovementBucket[];
  perceptionContext: { sensorParagraph: string; selfReportParagraph: string };
  onboardingParagraphs: string[];
  priorEpisodes: PriorEpisode[];
  recurrenceCount: number;
  disclaimerParagraphs: string[];
}

export const REPORT_DISCLAIMER_PARAGRAPH =
  'Movement data is from a consumer wearable and is supporting context, not a clinical measurement. ' +
  'The device does not classify every movement; in validation against ultrasound the classifier achieved ' +
  '78% sensitivity and 91% specificity in a supervised in-clinic setting. Quiet periods in this record may ' +
  'reflect sensor limitations or periods without data rather than reduced fetal activity. This document ' +
  'records what the patient reported and what the application did. It contains no clinical assessment and ' +
  'no recommendation.';

export const NOT_RECORDED_ASSESSMENT =
  'Not recorded — this system is not told what happened after the clinic was contacted.';

export function buildCanonicalReportSections(data: CanonicalReportData): ReportSections {
  const gestation = formatGestation(data.edd, data.contactedAt);

  const patientIdentification = [
    `Name: ${data.patientName}`,
    `Date of birth: ${formatDateOnly(data.dateOfBirth)}`,
    `Clinic reference: ${data.clinicReference ?? 'Not recorded'}`,
    `Gestation at contact: ${gestation}`,
    `Estimated due date: ${formatDateOnly(data.edd)}`,
    `Booked maternity unit: ${data.bookedUnitName}`,
    `Registered clinic: ${data.clinicName}`,
  ];

  const reasonForContact = [
    `Date and time of contact: ${formatDateTime24hWithTz(data.contactedAt)}`,
    `Entry route: ${formatEntryPath(data.entryPath)}`,
    data.disposition === 'escalate'
      ? 'Outcome: immediate contact was recommended, based on her own report.'
      : 'Outcome: a routine report was sent; no immediate contact was recommended.',
    `Contact route given: ${data.triageContact.label} (${data.triageContact.number}) — ${data.triageContact.reason}`,
  ];

  const structured = data.structured;
  const descriptionParagraphs: string[] = [];
  if (structured) {
    if (structured.perceivedMovement) {
      descriptionParagraphs.push(`Movement, as she described it: ${structured.perceivedMovement}.`);
    }
    if (structured.character.length > 0) {
      descriptionParagraphs.push(`Character: ${structured.character.join(', ')}.`);
    }
    if (structured.timeWindow) {
      const confidenceNote = structured.timeWindow.confidence === 'inferred' ? ' (inferred from a vague time reference)' : '';
      descriptionParagraphs.push(
        `Time window: ${formatDateTime24hWithTz(structured.timeWindow.start)} to ` +
          `${formatDateTime24hWithTz(structured.timeWindow.end)}${confidenceNote}.`
      );
    }
    if (structured.additionalSymptoms.length > 0) {
      descriptionParagraphs.push(`Additional symptoms mentioned: ${structured.additionalSymptoms.join(', ')}.`);
    }
  }

  const movementFigures = computeMovementFigures(data.movementBins, computeOverallBaseline(data.baseline));
  const hourlyBuckets = buildHourlyBuckets(data.movementBins, data.contactedAt);

  const sensorParagraph =
    movementFigures.coveragePercent > 0
      ? `Sensor-observed activity in the preceding 24 hours: active in ${(movementFigures.activeFraction * 100).toFixed(0)}% of covered windows, with ${movementFigures.coveragePercent.toFixed(0)}% coverage.`
      : 'Sensor-observed activity in the preceding 24 hours: no covered data available for this window.';

  const positiveFlags = data.redFlags.filter((entry) => entry.answer === 'yes');
  const selfReportParagraph =
    positiveFlags.length > 0
      ? `What she reported: positive on ${positiveFlags.map((f) => f.question).join('; ')}.` +
        (data.freeTextRaw.trim() ? ` In her own words: "${data.freeTextRaw.trim()}"` : '')
      : `What she reported: no positive red flags.` +
        (data.freeTextRaw.trim() ? ` In her own words: "${data.freeTextRaw.trim()}"` : '');

  return {
    documentTitle: 'Maternity contact report',
    clinicName: data.clinicName,
    generatedLine: `Generated ${formatDateTime24hWithTz(data.reportGeneratedAt)}`,
    patientIdentification,
    reasonForContact,
    redFlagEntries: data.redFlags,
    description: {
      structuredParagraphs: descriptionParagraphs,
      verbatimHighlights: structured?.verbatimHighlights ?? [],
      rawFallback: structured ? null : data.freeTextRaw.trim() || null,
    },
    movementFigures,
    hourlyBuckets,
    perceptionContext: { sensorParagraph, selfReportParagraph },
    onboardingParagraphs: buildOnboardingParagraphs(data),
    priorEpisodes: data.priorEpisodes,
    recurrenceCount: data.priorEpisodes.length + 1,
    disclaimerParagraphs: [REPORT_DISCLAIMER_PARAGRAPH],
  };
}

function computeOverallBaseline(baseline: CanonicalReportData['baseline']): number {
  if (!baseline) {
    return 0;
  }
  const usable = baseline.byHour.filter((entry) => entry.coverageFraction > 0);
  if (usable.length === 0) {
    return 0;
  }
  return usable.reduce((sum, entry) => sum + entry.expectedActiveFraction, 0) / usable.length;
}
