/**
 * Renders a ReportData (src/types.ts) into a downloadable clinical PDF using
 * jsPDF with direct text/vector layout (no html2canvas, no DOM screenshot,
 * no autotable plugin). The goal is a document a midwife opens and reads —
 * a clear heading, labelled sections, legible tables drawn with text and line
 * primitives, and one line graph of the kick tallies drawn the same way — not
 * a picture of the app.
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
 *  - `buildKickChart` derives the line graph's geometry inputs, also with no
 *    jsPDF involved, so the axis rules it enforces are testable without
 *    rendering a page. Everything it plots is also printed as text by
 *    `buildReportSections`.
 *  - `buildReportPdf` lays those sections out on the page (headings, page
 *    breaks, text wrapping, the graph) and returns the jsPDF document, so
 *    tests can assert it renders non-empty output without touching the
 *    filesystem or a browser download.
 *  - `downloadReportPdf` is the frozen public entry point: build + save().
 */

import { jsPDF } from 'jspdf';
import type {
  ActivitySample,
  HistoryFlag,
  KickSample,
  ReportData,
} from '../types';
import {
  REPORT_DISCLAIMER,
  REPORT_VOICE_NOTE_NOTE,
  formatFollowUpAnswerValue,
  onboardingQuestions,
  redFlagCategories,
} from '../data/clinicalContent';
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

/**
 * What a blank free-text answer prints as. Factual and narrow: it states that
 * nothing was written, which is not the same claim as "nothing was said" — she
 * may have recorded a voice note instead, and the line after it will say so.
 * Local to this module, like ACTIVITY_NO_DATA below, because this document is
 * written for a clinician and src/data/clinicalContent.ts is her voice.
 */
const NO_WRITTEN_ANSWER = 'no written answer';

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
 * Pure and crash-safe on an empty `recentActivity` array. The 24 pre-filled
 * buckets are a bucketing convenience ONLY — a bucket with `samples: 0` is an
 * hour the band did not report, not an hour of no movement, and
 * `buildActivityParagraphs` is responsible for never printing one as data.
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
// Kick counts
//
// The one DRAWING in this document. Everything else here is text, and this is
// text plus a line — a clinician reading a week of daily tallies wants the
// shape as well as the seven numbers, and both are printed.
//
// THE RULES IT INHERITS, and each one is load-bearing:
//
//  - THE AXIS STARTS AT ZERO. Not the window's own min/max. A count is not a
//    heart rate: scaling 262..333 kicks onto the full plot height turns a 21%
//    spread into a line that swings floor to ceiling, and this document is
//    read by someone deciding whether to bring a woman in. Same reasoning, and
//    the same headroom fraction, as src/components/KickTrace.tsx.
//  - THE FINAL INTERVAL IS UNFINISHED. `settledIndex` is the last COMPLETE
//    tally; the sample after it is today, still counting, and is therefore
//    always lower for a reason that has nothing to do with the baby. It is
//    drawn as a broken segment, excluded from the quoted range, and never the
//    headline figure — the headline is `samples[settledIndex]`.
//  - ABSENCE IS ABSENCE. An empty window draws NOTHING: no frame, no axis, no
//    flat line at zero. A flat line at zero is a confirmed week of no kicks,
//    manufactured out of no data, on the document that goes to her clinic.
//    (`SupabaseMovementStream` returns an empty window today, so this path is
//    reachable in production, not just in theory.)
//  - NO VERDICT. No threshold, no shaded "normal" band, no trend arrow, no
//    adjective. The axis, the line and the numbers, and nothing else.
// ---------------------------------------------------------------------------

/** Matches KickTrace's HEADROOM_FRACTION: without it the tallest day of every
 * window touches the top of the frame, which reads as having hit a limit.
 * Here it is a FLOOR on the headroom rather than the final figure — see
 * `niceAxisMax` — which also guarantees the axis top is strictly above the
 * tallest sample, so no point is ever drawn on the frame's top edge. */
const KICK_HEADROOM_FRACTION = 0.12;

/**
 * Rounds the axis top up to a figure worth printing beside an axis.
 *
 * The headroomed maximum alone is an arbitrary number — 333 kicks becomes 373,
 * and a clinician reading "373" on the axis has to wonder where it came from,
 * because it corresponds to nothing. Rounding up to the next 1/1.25/1.5/2/2.5/
 * 3/4/5/6/8 x 10^n gives 400: a figure that reads as a scale rather than as a
 * residue of the arithmetic, at the cost of a little more headroom.
 *
 * ALWAYS AN INTEGER, and always strictly greater than the tallest sample. A
 * fractional axis top would be printed rounded (`Math.round`) while the line
 * was scaled against the unrounded value — every point would sit slightly off
 * the scale the reader is measuring it against. On a window whose maximum is 1
 * kick that error would be 20% of the plot height.
 */
function niceAxisMax(max: number): number {
  if (max <= 0) {
    return 0;
  }
  const target = max * (1 + KICK_HEADROOM_FRACTION);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  for (const step of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8]) {
    const candidate = Math.ceil(step * magnitude);
    if (candidate >= target) {
      return candidate;
    }
  }
  return Math.ceil(10 * magnitude);
}

const KICKS_NO_DATA = 'No kick counts were recorded by the wearable for this period.';

export interface KickChart {
  /** Oldest first. Never empty — `buildKickChart` returns null instead. */
  samples: KickSample[];
  /** Index of the last COMPLETE tally, or -1 if none has completed yet. */
  settledIndex: number;
  /** Top of the y axis, a whole number of kicks. The bottom is always 0. */
  axisMax: number;
}

/**
 * The chart's geometry inputs, derived and clamped — jsPDF-free, so the axis
 * rule above is testable without rendering a page.
 *
 * Returns null when there is nothing honest to draw. `settledIndex` is clamped
 * into range rather than trusted: it arrives from a sensor boundary, and an
 * out-of-range index would otherwise index past the end of the samples array
 * while drawing.
 */
export function buildKickChart(report: ReportData): KickChart | null {
  const samples = report.dailyKicks?.samples ?? [];
  if (samples.length === 0) {
    return null;
  }
  const max = samples.reduce((highest, sample) => Math.max(highest, sample.kicks), 0);
  return {
    samples,
    settledIndex: Math.min(Math.max(report.dailyKicks.settledIndex, -1), samples.length - 1),
    // An all-zero window returns 0: there is no height to scale across, and the
    // line is drawn on the floor, which is where zero belongs.
    axisMax: niceAxisMax(max),
  };
}

function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

/**
 * What the kicks section SAYS. The graph beside it is a drawing of exactly
 * these numbers — nothing is plotted that is not also printed, so a clinician
 * who cannot read the line still has every value.
 */
function buildKickParagraphs(report: ReportData): string[] {
  const chart = buildKickChart(report);
  if (!chart) {
    return [KICKS_NO_DATA];
  }

  const { samples, settledIndex } = chart;
  const first = samples[0].timestamp;
  const last = samples[samples.length - 1].timestamp;
  const hasUnsettledTail = settledIndex < samples.length - 1;

  const paragraphs: string[] = [
    `Window: ${samples.length} daily ${samples.length === 1 ? 'tally' : 'tallies'}, ${formatDayMonth(first)} to ${formatDayMonth(last)}. One tally per day, from the wearable.`,
    'The graph plots these figures on an axis that starts at zero.',
  ];

  if (settledIndex >= 0) {
    const settled = samples[settledIndex];
    paragraphs.push(
      `Most recent complete day (${formatDayMonth(settled.timestamp)}): ${settled.kicks} kicks.`
    );
    // Across the COMPLETE days only. Including the day still in progress would
    // drag the bottom of the range down by an artefact of when she pressed
    // Send, not by anything the baby did.
    const complete = samples.slice(0, settledIndex + 1).map((sample) => sample.kicks);
    const low = Math.min(...complete);
    const high = Math.max(...complete);
    paragraphs.push(
      low === high
        ? `Every complete day in this window: ${low} kicks.`
        : `Range across the complete days: ${low} to ${high} kicks.`
    );
  } else {
    // Reachable in principle from a boundary that has not confirmed anything
    // yet. Stated rather than left to be inferred from a wholly broken line.
    paragraphs.push('No day in this window has completed yet.');
  }

  if (hasUnsettledTail) {
    paragraphs.push(
      'The broken segment at the right is an interval still in progress. A partial tally is always lower than a full one, and is not a fall.'
    );
  }

  paragraphs.push('', 'Daily tallies (oldest to most recent):');
  samples.forEach((sample, index) => {
    const inProgress = index > settledIndex;
    paragraphs.push(
      inProgress
        ? `${formatDayMonth(sample.timestamp)}: ${sample.kicks} kicks (interval still in progress)`
        : `${formatDayMonth(sample.timestamp)}: ${sample.kicks} kicks`
    );
  });

  return paragraphs;
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
  /** Kick tallies — the section the line graph is drawn into. */
  kicks: ReportSection;
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

/**
 * Renders one category's block, category-by-category (held-build-brief.md
 * "Report contents"): the gate question and her answer, any additional gate
 * questions (the Collapse category only), each answered follow-up with its
 * answer, her detail text, and a voice-note line — in that order, one
 * category at a time, using `redFlagCategories`' own order so the report
 * reads in the same sequence she was asked.
 *
 * Honest, not merely accurate, about categories she was never asked
 * (`endedBeforeAllCategories`): a category nobody reached reads very
 * differently on a clinical document from
 * "she was asked and said no" — conflating the two would be exactly the
 * kind of silent interpretation this report must not do.
 */
function buildRedFlagParagraphs(report: ReportData): string[] {
  const paragraphs: string[] = [];

  for (const category of redFlagCategories) {
    const answer = report.categoryAnswers.find((a) => a.categoryId === category.id);

    if (!answer) {
      paragraphs.push(
        report.endedBeforeAllCategories
          ? `${category.gateQuestion} - not asked — the check-in did not reach this question`
          : `${category.gateQuestion} - not asked`
      );
      continue;
    }

    paragraphs.push(`${category.gateQuestion} - ${answer.gateAnswer === 'yes' ? 'Yes' : 'No'}`);

    category.additionalGateQuestions?.forEach((prompt, index) => {
      const value = answer.additionalGateAnswers?.[index];
      if (value !== undefined) {
        paragraphs.push(`${prompt} - ${value === 'yes' ? 'Yes' : 'No'}`);
      }
    });

    if (answer.gateAnswer === 'yes') {
      for (const followUp of category.followUps) {
        const fuAnswer = answer.followUpAnswers.find((f) => f.followUpId === followUp.id);
        if (fuAnswer) {
          const formatted = formatFollowUpAnswerValue(fuAnswer.value, followUp.options);
          // A `text` follow-up may legitimately be blank, and may now be
          // answered by voice alone (its composer has a mic). Printing
          // "prompt - " with nothing after the dash reads as a rendering
          // fault on a clinical document; NO_WRITTEN_ANSWER states the fact
          // instead, and the voice-note line below says where the answer is.
          paragraphs.push(
            formatted.trim().length > 0
              ? `${followUp.prompt} - ${formatted}`
              : `${followUp.prompt} - ${NO_WRITTEN_ANSWER}`
          );
          // Its own paragraph, immediately after the line it belongs to —
          // the same treatment a category's note gets below (design-plan.md
          // §15.6). Never parenthesised into the answer.
          if (fuAnswer.voiceNote) {
            paragraphs.push(REPORT_VOICE_NOTE_NOTE);
          }
        }
      }
    }

    const detail = answer.detail?.trim();
    if (detail) {
      paragraphs.push(`Additional detail: ${detail}`);
    }
    // A voice note is its own paragraph, immediately after the category's
    // lines — not parenthesised into any of them (design-plan.md §15.6).
    if (answer.voiceNote) {
      paragraphs.push(REPORT_VOICE_NOTE_NOTE);
    }
  }

  return paragraphs;
}

function buildDescriptionParagraphs(report: ReportData): string[] {
  const text = report.freeTextDescription?.trim();
  const paragraphs = [text ? report.freeTextDescription : '(No description provided.)'];
  if (report.freeTextVoiceNote) {
    paragraphs.push(REPORT_VOICE_NOTE_NOTE);
  }
  return paragraphs;
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
  // Both onboarding detail boxes carry a mic (src/screens/onboarding/
  // QuestionStep.tsx), so both can hold a recording the clinic needs to know
  // exists. Its own paragraph, as everywhere else in this document.
  if (onboardingHistory.extraMonitoring.detailVoiceNote) {
    paragraphs.push(REPORT_VOICE_NOTE_NOTE);
  }

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
  if (onboardingHistory.history.detailVoiceNote) {
    paragraphs.push(REPORT_VOICE_NOTE_NOTE);
  }

  return paragraphs;
}

/**
 * The one sentence this section prints when the band reported nothing at all.
 * It names the hardware and stops — the same voice as the app's own
 * band-offline copy, on the surface where getting this wrong costs the most.
 * Local to this module rather than imported from src/data/clinicalContent.ts:
 * that file is the PATIENT-facing voice, and this document is written for a
 * clinician.
 */
const ACTIVITY_NO_DATA =
  'No movement data was recorded from the wearable for this period.';

/**
 * ABSENCE IS ABSENCE, IN THE ONE ARTEFACT A CLINICIAN READS.
 *
 * This used to emit the summary line and then loop over all 24 buckets
 * unconditionally, so an empty `recentActivity` printed "0 movements recorded
 * across 0 samples" followed by 24 rows of "moved in 0 of 0 samples". That is
 * a confirmed twenty-four hours of zero fetal movement, manufactured out of no
 * data — the precise claim src/components/KickTrace.tsx refuses to draw
 * on screen ("a flat line is a claim that nothing happened"), made in
 * the document that goes to her clinic.
 *
 * Two rules now:
 *  - no samples at all: one absence statement, no total, no table;
 *  - an hour with no samples: no row. An hour the band did not report is not
 *    an hour of stillness, and the two must not look alike in a list.
 */
function buildActivityParagraphs(report: ReportData): string[] {
  const summary = summarizeActivity(
    report.recentActivity,
    report.submittedAt,
    report.activityBaseline
  );

  if (summary.totalSamples === 0) {
    return [ACTIVITY_NO_DATA];
  }

  const paragraphs: string[] = [
    `24-hour total: ${summary.totalMoved} movements recorded across ${summary.totalSamples} samples. Personal baseline: ${summary.baseline} movements.`,
    '',
    'Hourly breakdown (oldest to most recent):',
  ];

  for (const bucket of summary.hourly) {
    // An hour the band did not report is simply not listed. Printing
    // "moved in 0 of 0 samples" would file "we have nothing" under the same
    // heading as "she did not move".
    if (bucket.samples === 0) {
      continue;
    }
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
    // After the activity summary rather than instead of it: the two are
    // different measurements over different spans, not one at two
    // resolutions. See ReportData.dailyKicks.
    kicks: {
      heading: 'Kick counts (one tally per day)',
      paragraphs: buildKickParagraphs(report),
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

// -- Kick line graph, in points on an A4 page --------------------------------
// Monochrome, like the rest of this document: greys are jsPDF's 0-255 channel
// values, never colour literals (there is no hex anywhere outside
// src/styles/tokens.css — src/test/invariants.test.ts enforces it).

/** Height of the plot band itself, excluding its labels. */
const CHART_HEIGHT = 96;
/** Room reserved at the left for the two y-axis figures (0 and the maximum). */
const CHART_Y_AXIS_WIDTH = 34;
/** Baseline offset of the date row below the plot band. */
const CHART_DATE_ROW_GAP = 11;
const CHART_LABEL_FONT_SIZE = 7.5;
/** Total vertical space one chart occupies, for the page-break reservation. */
const CHART_TOTAL_HEIGHT = CHART_HEIGHT + CHART_DATE_ROW_GAP + 6;
const CHART_DOT_RADIUS = 2;

/**
 * Draws the kick line graph into the rectangle whose top-left is (x, y).
 *
 * PURE DRAWING. Every decision about what is honest to plot was already made
 * in `buildKickChart` / `buildKickParagraphs`; this places it on the page and
 * restores every piece of jsPDF graphics state it touches (dash pattern, draw
 * colour, line width, font size) so a later section cannot inherit a dashed
 * pen from here.
 */
function drawKickChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  chart: KickChart
): void {
  const { samples, settledIndex, axisMax } = chart;
  const plotX = x + CHART_Y_AXIS_WIDTH;
  const plotWidth = width - CHART_Y_AXIS_WIDTH;
  const floorY = y + CHART_HEIGHT;

  // The frame. Light enough to read as a reference rectangle rather than as a
  // second line competing with the data.
  doc.setDrawColor(190);
  doc.setLineWidth(0.5);
  doc.rect(plotX, y, plotWidth, CHART_HEIGHT);

  // The two axis figures, right-aligned into the reserved gutter: zero at the
  // floor and the window's headroomed maximum at the top. Two labels, not a
  // gridded scale — enough to read a value off the line, not enough to imply
  // bands within it.
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(CHART_LABEL_FONT_SIZE);
  doc.setTextColor(90);
  // `axisMax` is a whole number by construction (niceAxisMax), so this prints
  // the value the line is actually scaled against — no rounding in between.
  doc.text('0', plotX - 4, floorY, { align: 'right' });
  doc.text(String(axisMax), plotX - 4, y + CHART_LABEL_FONT_SIZE, { align: 'right' });

  // A single sample sits at the "now" end, which is where a single sample
  // honestly is — the same rule KickTrace follows.
  const pointX = (index: number): number =>
    samples.length < 2 ? plotX + plotWidth : plotX + (index / (samples.length - 1)) * plotWidth;
  const pointY = (kicks: number): number =>
    axisMax <= 0 ? floorY : floorY - (kicks / axisMax) * CHART_HEIGHT;

  // Segment by segment, so the settled run and the in-progress tail can carry
  // different pens without redrawing either.
  doc.setDrawColor(40);
  doc.setLineWidth(1);
  for (let index = 1; index < samples.length; index += 1) {
    // A segment is "still in progress" as soon as either of its ends is, so
    // the break starts at the last complete tally rather than after it.
    const unsettled = index > settledIndex;
    doc.setLineDashPattern(unsettled ? [2, 2] : [], 0);
    doc.line(
      pointX(index - 1),
      pointY(samples[index - 1].kicks),
      pointX(index),
      pointY(samples[index].kicks)
    );
  }
  doc.setLineDashPattern([], 0);

  // The last COMPLETE tally, marked where the pen changes — the figure the
  // section quotes as the headline, so the reader can see which point it is.
  // Withheld entirely when nothing has settled: there is no such point.
  if (settledIndex >= 0) {
    // Three channels rather than one: jsPDF's single-argument setFillColor
    // overload takes a CSS string, so a bare grey level has to be spelled out.
    doc.setFillColor(40, 40, 40);
    doc.circle(pointX(settledIndex), pointY(samples[settledIndex].kicks), CHART_DOT_RADIUS, 'F');
  }

  // Oldest date under the left edge, newest under the right. Real dates, not
  // "7 days ago" — this document is read later than it is generated.
  doc.setTextColor(90);
  doc.text(formatDayMonth(samples[0].timestamp), plotX, floorY + CHART_DATE_ROW_GAP);
  if (samples.length > 1) {
    doc.text(
      formatDayMonth(samples[samples.length - 1].timestamp),
      plotX + plotWidth,
      floorY + CHART_DATE_ROW_GAP,
      { align: 'right' }
    );
  }

  // Restore the document's defaults for whatever is drawn next.
  doc.setTextColor(0);
  doc.setDrawColor(0);
  doc.setFillColor(0, 0, 0);
  doc.setLineWidth(0.75);
  doc.setFontSize(BODY_FONT_SIZE);
}

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

  /** `reserveBelow` keeps a heading from being orphaned at the foot of a page
   * above something tall that will then break onto the next one — the kick
   * graph is the only such thing today. */
  function drawHeading(text: string, reserveBelow = 0): void {
    ensureSpace(LINE_HEIGHT * 2 + 10 + reserveBelow);
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(HEADING_FONT_SIZE);
    doc.text(text, PAGE_MARGIN, y);
    y += 4;
    doc.setLineWidth(0.75);
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
    y += LINE_HEIGHT;
  }

  /**
   * `drawAfterHeading` runs between the heading's rule and the section's first
   * paragraph — the hook the kick graph mounts into. `reserveBelow` is passed
   * through to `drawHeading` so whatever that hook draws is accounted for
   * before the heading commits to a page.
   */
  function drawSection(
    section: ReportSection,
    drawAfterHeading?: () => void,
    reserveBelow = 0
  ): void {
    drawHeading(section.heading, reserveBelow);
    drawAfterHeading?.();
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

  // Kicks: the heading, then the graph, then the section's own figures under
  // it. The graph goes ABOVE the numbers because the shape is what this
  // section adds — the numbers were always printable as text.
  //
  // `buildKickChart` returning null is the absence case: the section prints
  // KICKS_NO_DATA and NOTHING is drawn. An empty frame with a zero axis would
  // be a claim about a week of no kicks.
  const kickChart = buildKickChart(report);
  drawSection(
    sections.kicks,
    kickChart
      ? () => {
          ensureSpace(CHART_TOTAL_HEIGHT);
          drawKickChart(doc, PAGE_MARGIN, y, contentWidth, kickChart);
          y += CHART_TOTAL_HEIGHT + LINE_HEIGHT / 2;
        }
      : undefined,
    kickChart ? CHART_TOTAL_HEIGHT : 0
  );

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
