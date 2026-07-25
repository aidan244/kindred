/**
 * Renders a ReportData (src/types.ts) into a downloadable clinical PDF using
 * jsPDF with direct text/table layout (no html2canvas, no DOM screenshot,
 * no autotable plugin). The goal is a document a midwife opens and reads —
 * a clear heading, labelled sections, and legible tables drawn with text
 * and line primitives — not a picture of the app.
 *
 * Two words are never allowed to appear anywhere in the document:
 *  - "A&E"       (this report is supporting context, not an A&E referral)
 *  - "detected"  (movement data is reported as counts, not a diagnostic
 *                 "detection")
 *
 * The module is split in three layers so each is independently testable:
 *  - `buildReportSections` turns a ReportData into plain-text section
 *    content (headings + paragraphs). No jsPDF involved — this is what
 *    tests inspect for forbidden words and correct field joins.
 *  - `buildReportPdf` lays those sections out on the page (headings, page
 *    breaks, text wrapping) and returns the jsPDF document, so tests can
 *    assert it renders non-empty output without touching the filesystem or
 *    a browser download.
 *  - `downloadReportPdf` is the frozen public entry point: build + save().
 */

import { jsPDF } from 'jspdf';
import type {
  ActivitySample,
  HistoryFlag,
  ReportData,
} from '../types';
import { REPORT_DISCLAIMER, onboardingQuestions, redFlagQuestions } from '../data/clinicalContent';
import type {
  MultiSelectOnboardingQuestion,
  YesNoUnsureOnboardingQuestion,
} from '../data/clinicalContent';

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatDateTime(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}, ${formatTime(
    date
  )}`;
}

function formatDateForFilename(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// ---------------------------------------------------------------------------
// Onboarding content lookups (joined from src/data/clinicalContent.ts)
// ---------------------------------------------------------------------------

const extraMonitoringQuestion = onboardingQuestions.find(
  (q): q is YesNoUnsureOnboardingQuestion =>
    q.id === 'extra-monitoring' && q.type === 'yes-no-unsure'
);

const historyQuestion = onboardingQuestions.find(
  (q): q is MultiSelectOnboardingQuestion =>
    q.id === 'history' && q.type === 'multi-select'
);

const historyOptionLabels = new Map<HistoryFlag, string>(
  (historyQuestion?.options ?? []).map((option) => [option.value, option.label])
);

function historyFlagLabel(flag: HistoryFlag): string {
  // Falls back to the raw value rather than crashing if the data module
  // ever adds a HistoryFlag without a corresponding option label.
  return historyOptionLabels.get(flag) ?? flag;
}

function yesNoUnsureLabel(answer: 'yes' | 'no' | 'not-sure' | null): string {
  switch (answer) {
    case 'yes':
      return 'Yes';
    case 'no':
      return 'No';
    case 'not-sure':
      return 'Not sure';
    default:
      return 'Not answered';
  }
}

// ---------------------------------------------------------------------------
// Activity summary
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const HOURS_IN_WINDOW = 24;

interface HourlyActivityBucket {
  /** e.g. "07:00-08:00", the clock-time span this bucket covers. */
  label: string;
  moved: number;
  samples: number;
}

interface ActivitySummary {
  /** Oldest hour first, most recent hour last. */
  hourly: HourlyActivityBucket[];
  totalMoved: number;
  totalSamples: number;
  baseline: number;
}

/**
 * Buckets 5-minute activity samples into the 24 clock-hours preceding
 * `submittedAt`. Bucket 0 is the most recent hour (i.e. [submittedAt - 1h,
 * submittedAt)); bucket 23 is the oldest (~24h before submittedAt).
 *
 * `totalMoved`/`totalSamples` are summed over every sample passed in
 * (matching the ReportData contract that `recentActivity` already *is* "the
 * 24h of activity samples preceding submission"), while the hourly buckets
 * only count samples whose offset from `submittedAt` falls cleanly within
 * the 0-24h window — a defensive measure so a stray out-of-window sample
 * can't silently vanish from the total or throw on an out-of-range bucket
 * index.
 *
 * Pure and crash-safe on an empty `recentActivity` array (renders as 24
 * zeroed rows).
 */
function summarizeActivity(
  recentActivity: ActivitySample[],
  submittedAt: Date,
  baseline: number
): ActivitySummary {
  const buckets = Array.from({ length: HOURS_IN_WINDOW }, () => ({
    moved: 0,
    samples: 0,
  }));

  let totalMoved = 0;
  let totalSamples = 0;

  for (const sample of recentActivity) {
    totalSamples += 1;
    if (sample.moved) {
      totalMoved += 1;
    }

    const diffMs = submittedAt.getTime() - sample.timestamp.getTime();
    const bucketIndex = Math.floor(diffMs / HOUR_MS);
    if (bucketIndex >= 0 && bucketIndex < HOURS_IN_WINDOW) {
      buckets[bucketIndex].samples += 1;
      if (sample.moved) {
        buckets[bucketIndex].moved += 1;
      }
    }
  }

  const hourly: HourlyActivityBucket[] = [];
  for (let i = HOURS_IN_WINDOW - 1; i >= 0; i -= 1) {
    const rangeStart = new Date(submittedAt.getTime() - (i + 1) * HOUR_MS);
    const rangeEnd = new Date(submittedAt.getTime() - i * HOUR_MS);
    hourly.push({
      label: `${formatTime(rangeStart)}-${formatTime(rangeEnd)}`,
      moved: buckets[i].moved,
      samples: buckets[i].samples,
    });
  }

  return { hourly, totalMoved, totalSamples, baseline };
}

// ---------------------------------------------------------------------------
// Section content (jsPDF-free, so it's directly testable)
// ---------------------------------------------------------------------------

export interface ReportSection {
  heading: string;
  /** Logical paragraphs. An empty string is a blank-line spacer. */
  paragraphs: string[];
}

export interface ReportSections {
  appName: string;
  documentTitle: string;
  generatedLine: string;
  patient: ReportSection;
  entry: ReportSection;
  redFlags: ReportSection;
  description: ReportSection;
  history: ReportSection;
  activity: ReportSection;
  disclaimer: ReportSection;
}

function buildEntryParagraphs(report: ReportData): string[] {
  let howItStarted: string;
  switch (report.entryPath) {
    case 'alert':
      howItStarted =
        'Started after a movement-alert notification from her sensor.';
      break;
    case 'adhoc':
      howItStarted = 'Started by the patient, not from a notification.';
      break;
    default:
      howItStarted = 'Entry method not recorded.';
  }

  return [howItStarted, `Timestamp: ${formatDateTime(report.submittedAt)}`];
}

function buildRedFlagParagraphs(report: ReportData): string[] {
  return redFlagQuestions.map((question) => {
    const answer = report.redFlagAnswers.find(
      (a) => a.questionId === question.id
    );
    if (!answer) {
      return `${question.question} - not answered`;
    }
    const answerLabel = answer.answer === 'yes' ? 'Yes' : 'No';
    const detail = answer.detail?.trim();
    return detail
      ? `${question.question} - ${answerLabel} (additional detail: ${detail})`
      : `${question.question} - ${answerLabel}`;
  });
}

function buildDescriptionParagraphs(report: ReportData): string[] {
  const text = report.freeTextDescription?.trim();
  return [text ? report.freeTextDescription : '(No description provided.)'];
}

function buildHistoryParagraphs(report: ReportData): string[] {
  const { onboardingHistory } = report;
  const paragraphs: string[] = [];

  paragraphs.push(
    onboardingHistory.weeksPregnant != null
      ? `Weeks pregnant at onboarding: ${onboardingHistory.weeksPregnant}`
      : 'Weeks pregnant at onboarding: not recorded'
  );

  const extraMonitoringPrompt =
    extraMonitoringQuestion?.prompt ?? 'Extra monitoring / consultant-led care';
  const extraMonitoringAnswerLabel = yesNoUnsureLabel(
    onboardingHistory.extraMonitoring.answer
  );
  const extraMonitoringDetail = onboardingHistory.extraMonitoring.detail?.trim();
  paragraphs.push(
    extraMonitoringDetail
      ? `${extraMonitoringPrompt} - ${extraMonitoringAnswerLabel} (additional detail: ${extraMonitoringDetail})`
      : `${extraMonitoringPrompt} - ${extraMonitoringAnswerLabel}`
  );

  const historyPrompt =
    historyQuestion?.prompt ?? 'Relevant history from this or a previous pregnancy';
  const selectedLabels = onboardingHistory.history.selected.map(historyFlagLabel);
  const historyLabelsText =
    selectedLabels.length > 0 ? selectedLabels.join(', ') : 'None recorded';
  const historyDetail = onboardingHistory.history.detail?.trim();
  paragraphs.push(
    historyDetail
      ? `${historyPrompt} - ${historyLabelsText} (additional detail: ${historyDetail})`
      : `${historyPrompt} - ${historyLabelsText}`
  );

  return paragraphs;
}

function buildActivityParagraphs(report: ReportData): string[] {
  const summary = summarizeActivity(
    report.recentActivity,
    report.submittedAt,
    report.activityBaseline
  );

  const paragraphs: string[] = [
    `24-hour total: ${summary.totalMoved} movements recorded across ${summary.totalSamples} samples. Personal baseline: ${summary.baseline} movements.`,
    '',
    'Hourly breakdown (oldest to most recent):',
  ];

  for (const bucket of summary.hourly) {
    paragraphs.push(
      `${bucket.label}: moved in ${bucket.moved} of ${bucket.samples} samples`
    );
  }

  return paragraphs;
}

/**
 * Turns a ReportData into plain-text section content, with no jsPDF
 * dependency. This is the single source of truth for what the report says
 * — `buildReportPdf` only lays this out on the page, it doesn't compose any
 * additional wording.
 */
export function buildReportSections(report: ReportData): ReportSections {
  return {
    appName: 'Kindred',
    documentTitle: 'Movement check-in report',
    generatedLine: `Generated ${formatDateTime(report.submittedAt)}`,
    patient: {
      heading: 'Patient',
      paragraphs: [
        `Name: ${report.patientName}`,
        `Gestation: ${report.gestationWeeks} weeks`,
      ],
    },
    entry: {
      heading: 'Entry',
      paragraphs: buildEntryParagraphs(report),
    },
    redFlags: {
      heading: 'Red-flag questionnaire',
      paragraphs: buildRedFlagParagraphs(report),
    },
    description: {
      heading: "Patient's own description",
      paragraphs: buildDescriptionParagraphs(report),
    },
    history: {
      heading: 'History captured at onboarding',
      paragraphs: buildHistoryParagraphs(report),
    },
    activity: {
      heading: 'Activity summary (preceding 24 hours)',
      paragraphs: buildActivityParagraphs(report),
    },
    disclaimer: {
      heading: 'Important',
      paragraphs: [report.disclaimer?.trim() || REPORT_DISCLAIMER],
    },
  };
}

// ---------------------------------------------------------------------------
// PDF layout
// ---------------------------------------------------------------------------

const PAGE_MARGIN = 48;
const BODY_FONT_SIZE = 10;
const HEADING_FONT_SIZE = 12;
const LINE_HEIGHT = 14;

/**
 * Lays out a ReportData as a jsPDF document: header, then every section
 * from `buildReportSections` in order, with text wrapping and page breaks.
 * Exported (rather than only `downloadReportPdf`) so it's directly
 * testable headlessly, without triggering a file save.
 */
export function buildReportPdf(report: ReportData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;

  let y = PAGE_MARGIN;

  function ensureSpace(height: number): void {
    if (y + height > pageHeight - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  }

  function drawParagraph(text: string): void {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BODY_FONT_SIZE);
    const lines = doc.splitTextToSize(text, contentWidth) as string[];
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, PAGE_MARGIN, y);
      y += LINE_HEIGHT;
    }
  }

  function drawHeading(text: string): void {
    ensureSpace(LINE_HEIGHT * 2 + 10);
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(HEADING_FONT_SIZE);
    doc.text(text, PAGE_MARGIN, y);
    y += 4;
    doc.setLineWidth(0.75);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    y += LINE_HEIGHT;
  }

  function drawSection(section: ReportSection): void {
    drawHeading(section.heading);
    for (const paragraph of section.paragraphs) {
      if (paragraph === '') {
        y += LINE_HEIGHT / 2;
        continue;
      }
      drawParagraph(paragraph);
    }
  }

  const sections = buildReportSections(report);

  // 1. Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(sections.appName, PAGE_MARGIN, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(sections.documentTitle, PAGE_MARGIN, y);
  y += 18;

  doc.setFontSize(BODY_FONT_SIZE);
  doc.text(sections.generatedLine, PAGE_MARGIN, y);
  y += 10;

  doc.setLineWidth(1);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
  y += 16;

  // 2-8. Sections, in the required order.
  drawSection(sections.patient);
  drawSection(sections.entry);
  drawSection(sections.redFlags);
  drawSection(sections.description);
  drawSection(sections.history);
  drawSection(sections.activity);
  drawSection(sections.disclaimer);

  return doc;
}

function reportFilename(report: ReportData): string {
  return `kindred-movement-report-${formatDateForFilename(report.submittedAt)}.pdf`;
}

/**
 * Public entry point (frozen signature): builds the PDF and triggers a
 * direct file download via jsPDF's `save()` — never a print dialog.
 */
export function downloadReportPdf(report: ReportData): void {
  const doc = buildReportPdf(report);
  doc.save(reportFilename(report));
}
