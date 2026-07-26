import { describe, expect, it } from 'vitest';
import {
  buildKickChart,
  buildReportPdf,
  buildReportSections,
  type ReportSections,
} from '../logic/reportPdf';
import {
  BLEEDING_HOW_MUCH_FOLLOWUP_ID,
  COLLAPSE_CATEGORY_ID,
  redFlagCategories,
  REPORT_DISCLAIMER,
  REPORT_VOICE_NOTE_NOTE,
} from '../data/clinicalContent';
import type {
  ActivitySample,
  CategoryAnswer,
  KickWindow,
  ReportData,
  VoiceNote,
} from '../types';

const submittedAt = new Date(2026, 6, 25, 14, 32, 0, 0);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seven daily tallies ending on the day of submission, oldest first, with the
 * final one deliberately the LOWEST — that is the shape a real window always
 * has (today is still counting), and it is the shape the report must not print
 * as a decline. `settledIndex` is 5: the last COMPLETE day.
 */
const KICK_COUNTS = [284, 301, 262, 318, 295, 333, 176];

function buildDailyKicks(): KickWindow {
  return {
    samples: KICK_COUNTS.map((kicks, index) => ({
      timestamp: new Date(submittedAt.getTime() - (KICK_COUNTS.length - 1 - index) * DAY_MS),
      kicks,
    })),
    settledIndex: KICK_COUNTS.length - 2,
  };
}

/** What an offline band, or a backend with no kicks table, actually returns. */
const EMPTY_KICKS: KickWindow = { samples: [], settledIndex: -1 };

function buildRecentActivity(): ActivitySample[] {
  const samples: ActivitySample[] = [];
  // 288 samples, 5 minutes apart, spanning the 24h preceding submittedAt.
  for (let i = 0; i < 24 * 12; i += 1) {
    samples.push({
      timestamp: new Date(submittedAt.getTime() - i * 5 * 60 * 1000),
      moved: i % 3 === 0,
    });
  }
  return samples;
}

// Every category gated yes, with a mix of follow-up types answered, so the
// report exercises text/number/select/multiselect/yesno formatting.
const fullCategoryAnswers: CategoryAnswer[] = redFlagCategories.map((category, index) => {
  if (category.hardStop) {
    return {
      categoryId: category.id,
      gateAnswer: 'no',
      additionalGateAnswers: category.additionalGateQuestions?.map(() => 'no'),
      followUpAnswers: [],
    };
  }
  const followUpAnswers = category.followUps.map((followUp) => {
    switch (followUp.type) {
      case 'yesno':
        return { followUpId: followUp.id, value: { type: 'yesno' as const, value: 'yes' as const } };
      case 'text':
        return { followUpId: followUp.id, value: { type: 'text' as const, value: 'Some detail text' } };
      case 'number':
        return { followUpId: followUp.id, value: { type: 'number' as const, value: 4 } };
      case 'select':
        return {
          followUpId: followUp.id,
          value: { type: 'select' as const, value: followUp.options?.[0]?.value ?? '' },
        };
      case 'multiselect':
        return {
          followUpId: followUp.id,
          value: { type: 'multiselect' as const, value: followUp.options ? [followUp.options[0].value] : [] },
        };
      default:
        throw new Error(`Unhandled follow-up type: ${followUp.type}`);
    }
  });
  return {
    categoryId: category.id,
    gateAnswer: 'yes',
    followUpAnswers,
    detail: index === 0 ? 'Small amount, pinkish' : undefined,
  };
});

const fullReport: ReportData = {
  patientName: 'Amara Whitfield',
  gestationWeeks: 34,
  entryPath: 'alert',
  submittedAt,
  categoryAnswers: fullCategoryAnswers,
  endedBeforeAllCategories: false,
  freeTextDescription:
    'I noticed less movement than usual this afternoon and felt a bit dizzy.',
  freeTextVoiceNote: null,
  onboardingHistory: {
    weeksPregnant: 12,
    extraMonitoring: {
      answer: 'yes',
      detail: 'Consultant-led due to previous pre-eclampsia',
    },
    history: {
      selected: ['bleeding', 'high-blood-pressure'],
      detail: 'Bleeding at 8 weeks, resolved on its own',
    },
  },
  recentActivity: buildRecentActivity(),
  activityBaseline: 150,
  dailyKicks: buildDailyKicks(),
  disclaimer: REPORT_DISCLAIMER,
};

const minimalReport: ReportData = {
  patientName: 'Jane Doe',
  gestationWeeks: 28,
  entryPath: null,
  submittedAt,
  categoryAnswers: [],
  endedBeforeAllCategories: false,
  freeTextDescription: '',
  freeTextVoiceNote: null,
  onboardingHistory: {
    weeksPregnant: null,
    extraMonitoring: { answer: null, detail: '' },
    history: { selected: [], detail: '' },
  },
  recentActivity: [],
  activityBaseline: 0,
  dailyKicks: EMPTY_KICKS,
  disclaimer: '',
};

function flatten(sections: ReportSections): string {
  return JSON.stringify(sections);
}

describe('buildReportSections', () => {
  it('never contains "A&E" or "detected", fully populated', () => {
    const text = flatten(buildReportSections(fullReport));
    // Case-INSENSITIVE: 'Detected' at the start of a sentence and 'DETECTED'
    // both passed the old exact-match assertions.
    expect(text).not.toMatch(/a&e/i);
    expect(text).not.toMatch(/detected/i);
  });

  it('never contains "A&E" or "detected" on a minimal/empty report', () => {
    const text = flatten(buildReportSections(minimalReport));
    expect(text).not.toMatch(/a&e/i);
    expect(text).not.toMatch(/detected/i);
  });

  it('does not crash on missing/empty detail fields, and does not fabricate content', () => {
    expect(() => buildReportSections(minimalReport)).not.toThrow();
    const sections = buildReportSections(minimalReport);
    expect(sections.description.paragraphs[0]).toContain(
      'No description provided'
    );
    expect(sections.history.paragraphs[0]).toContain('not recorded');
  });

  it('joins every category with its gate answer, by categoryId, in schema order', () => {
    const sections = buildReportSections(fullReport);
    const text = sections.redFlags.paragraphs.join('\n');
    for (const category of redFlagCategories) {
      expect(text).toContain(category.gateQuestion);
    }
  });

  it('renders every answered follow-up with its formatted value', () => {
    const sections = buildReportSections(fullReport);
    const text = sections.redFlags.paragraphs.join('\n');
    for (const category of redFlagCategories.filter((c) => !c.hardStop)) {
      for (const followUp of category.followUps) {
        expect(text).toContain(followUp.prompt);
      }
    }
  });

  it('renders a select follow-up by its option LABEL, not its raw value', () => {
    const sections = buildReportSections(fullReport);
    const text = sections.redFlags.paragraphs.join('\n');
    // fullCategoryAnswers picks options[0] for every select follow-up —
    // Bleeding's "How much?" first option is 'spotting' / 'Spotting'.
    expect(text).toContain(`How much? - Spotting`);
    expect(text).not.toContain('- spotting');
  });

  it('renders an unanswered category as "not asked" when every category was reached', () => {
    const sections = buildReportSections(minimalReport);
    for (const paragraph of sections.redFlags.paragraphs) {
      expect(paragraph).toContain('not asked');
      expect(paragraph).not.toContain('did not reach');
    }
  });

  it('says plainly that a category was never reached, rather than implying it was answered', () => {
    const collapseIndex = redFlagCategories.findIndex((c) => c.id === COLLAPSE_CATEGORY_ID);
    const report: ReportData = {
      ...fullReport,
      endedBeforeAllCategories: true,
      categoryAnswers: [
        { categoryId: COLLAPSE_CATEGORY_ID, gateAnswer: 'yes', followUpAnswers: [] },
      ],
    };
    const sections = buildReportSections(report);
    const text = sections.redFlags.paragraphs.join('\n');
    // The categories after Collapse in schema order were never reached.
    const afterCollapse = redFlagCategories.slice(collapseIndex + 1);
    expect(afterCollapse.length).toBeGreaterThan(0);
    for (const category of afterCollapse) {
      expect(text).toContain(`${category.gateQuestion} - not asked — the check-in did not reach this question`);
    }
    // Never claims a category that was never reached was "answered no".
    expect(text).not.toMatch(/not asked - No/);
  });

  it('includes the free-text description verbatim', () => {
    const sections = buildReportSections(fullReport);
    expect(sections.description.paragraphs).toContain(
      fullReport.freeTextDescription
    );
  });

  it('never mentions a voice note when none was recorded', () => {
    const sections = buildReportSections(fullReport);
    const text = sections.redFlags.paragraphs.join('\n') + sections.description.paragraphs.join('\n');
    expect(text).not.toContain(REPORT_VOICE_NOTE_NOTE);
  });

  it('appends REPORT_VOICE_NOTE_NOTE as its own paragraph after a category with a voice note', () => {
    const voiceNote: VoiceNote = { url: 'blob:demo', durationSeconds: 12, mimeType: 'audio/webm' };
    const report: ReportData = {
      ...fullReport,
      categoryAnswers: fullReport.categoryAnswers.map((answer, index) =>
        index === 1 ? { ...answer, voiceNote } : answer
      ),
    };
    const sections = buildReportSections(report);
    const text = sections.redFlags.paragraphs.join('\n');
    expect(text).toContain(REPORT_VOICE_NOTE_NOTE);
    // Never contains the forbidden words even with a voice note attached.
    const fullText = JSON.stringify(sections);
    expect(fullText).not.toMatch(/a&e/i);
    expect(fullText).not.toMatch(/detected/i);
  });

  it('appends REPORT_VOICE_NOTE_NOTE after the description when a closing voice note is attached', () => {
    const voiceNote: VoiceNote = { url: 'data:audio/wav;base64,AAAA', durationSeconds: 12, mimeType: 'audio/wav' };
    const report: ReportData = { ...fullReport, freeTextVoiceNote: voiceNote };
    const sections = buildReportSections(report);
    expect(sections.description.paragraphs).toEqual([
      fullReport.freeTextDescription,
      REPORT_VOICE_NOTE_NOTE,
    ]);
  });

  it('joins onboarding history option labels, not raw HistoryFlag values', () => {
    const sections = buildReportSections(fullReport);
    const text = sections.history.paragraphs.join('\n');
    expect(text).toContain('Bleeding');
    expect(text).toContain('High blood pressure');
    expect(text).not.toContain('high-blood-pressure');
  });

  it('computes a 24-hour activity total and compares it against the baseline', () => {
    const sections = buildReportSections(fullReport);
    const summaryLine = sections.activity.paragraphs[0];
    expect(summaryLine).toContain('288 samples');
    expect(summaryLine).toContain('150');
    // Factual, not interpretive.
    for (const word of ['low', 'concerning', 'normal', 'reassuring']) {
      expect(summaryLine.toLowerCase()).not.toContain(word);
    }
  });

  it('states absence, never a zeroed table, when no activity was recorded', () => {
    // An empty window must not print as a confirmed 24 hours of no movement.
    // This test previously asserted the opposite (24 rows of "moved in 0 of 0
    // samples" under a "0 movements recorded" total) — a positive clinical
    // claim manufactured out of no data, on the document the clinic reads.
    const sections = buildReportSections(minimalReport);
    expect(() => buildReportSections(minimalReport)).not.toThrow();
    expect(sections.activity.paragraphs).toHaveLength(1);
    expect(sections.activity.paragraphs[0]).toMatch(/no movement data was recorded/i);
    const all = sections.activity.paragraphs.join('\n');
    expect(all).not.toContain('0 of 0');
    expect(all).not.toContain('movements recorded across');
    expect(all).not.toContain('Hourly breakdown');
  });

  it('omits an hour the band did not report, rather than listing it as zero movement', () => {
    // 12 samples in one hour only. The other 23 hours have no data — and an
    // hour with no data is not an hour of stillness.
    const oneHourOnly: ActivitySample[] = Array.from({ length: 12 }, (_, i) => ({
      timestamp: new Date(submittedAt.getTime() - i * 5 * 60 * 1000),
      moved: i % 2 === 0,
    }));
    const sections = buildReportSections({ ...fullReport, recentActivity: oneHourOnly });
    const hourlyLines = sections.activity.paragraphs.slice(3);
    expect(hourlyLines).toHaveLength(1);
    expect(hourlyLines[0]).toContain('moved in 6 of 12 samples');
    expect(sections.activity.paragraphs.join('\n')).not.toContain('0 of 0');
  });

  it('includes the wearable-data disclaimer', () => {
    const sections = buildReportSections(fullReport);
    expect(sections.disclaimer.paragraphs[0]).toBe(REPORT_DISCLAIMER);
  });

  it('falls back to REPORT_DISCLAIMER if report.disclaimer is empty', () => {
    const sections = buildReportSections(minimalReport);
    expect(sections.disclaimer.paragraphs[0]).toBe(REPORT_DISCLAIMER);
  });

  it('does not use the word "detected" for an alert-path entry', () => {
    const sections = buildReportSections(fullReport);
    expect(sections.entry.paragraphs.join(' ')).not.toMatch(/detected/i);
    expect(sections.entry.paragraphs.join(' ').toLowerCase()).toContain('alert');
  });

  it('prints a follow-up voice note as its own paragraph, right after that follow-up', () => {
    const voiceNote: VoiceNote = { url: 'blob:fu', durationSeconds: 9, mimeType: 'audio/webm' };
    // The first non-hard-stop category's first text follow-up: the one input
    // type whose composer carries a mic.
    const category = redFlagCategories.find(
      (c) => !c.hardStop && c.followUps.some((f) => f.type === 'text')
    );
    expect(category, 'no text follow-up in the schema to test against').toBeDefined();
    const textFollowUp = category!.followUps.find((f) => f.type === 'text')!;

    const report: ReportData = {
      ...fullReport,
      categoryAnswers: fullReport.categoryAnswers.map((answer) =>
        answer.categoryId === category!.id
          ? {
              ...answer,
              followUpAnswers: answer.followUpAnswers.map((f) =>
                f.followUpId === textFollowUp.id ? { ...f, voiceNote } : f
              ),
            }
          : answer
      ),
    };
    const paragraphs = buildReportSections(report).redFlags.paragraphs;
    const promptIndex = paragraphs.findIndex((p) => p.startsWith(textFollowUp.prompt));
    expect(promptIndex).toBeGreaterThan(-1);
    // Its OWN paragraph, immediately after — never parenthesised into the
    // answer line, and never floated to the end of the category.
    expect(paragraphs[promptIndex + 1]).toBe(REPORT_VOICE_NOTE_NOTE);
    expect(paragraphs[promptIndex]).not.toContain(REPORT_VOICE_NOTE_NOTE);
  });

  it('states that a voice-only follow-up has no written answer, rather than trailing a bare dash', () => {
    const voiceNote: VoiceNote = { url: 'blob:fu', durationSeconds: 4, mimeType: 'audio/webm' };
    const category = redFlagCategories.find(
      (c) => !c.hardStop && c.followUps.some((f) => f.type === 'text')
    )!;
    const textFollowUp = category.followUps.find((f) => f.type === 'text')!;
    const report: ReportData = {
      ...fullReport,
      categoryAnswers: fullReport.categoryAnswers.map((answer) =>
        answer.categoryId === category.id
          ? {
              ...answer,
              followUpAnswers: answer.followUpAnswers.map((f) =>
                f.followUpId === textFollowUp.id
                  ? { followUpId: f.followUpId, value: { type: 'text' as const, value: '' }, voiceNote }
                  : f
              ),
            }
          : answer
      ),
    };
    const paragraphs = buildReportSections(report).redFlags.paragraphs;
    const line = paragraphs.find((p) => p.startsWith(textFollowUp.prompt));
    expect(line).toBe(`${textFollowUp.prompt} - no written answer`);
    // The recording is still announced — "nothing written" is not "nothing said".
    expect(paragraphs).toContain(REPORT_VOICE_NOTE_NOTE);
  });

  it('announces a voice note attached to either onboarding detail box', () => {
    const voiceNote: VoiceNote = { url: 'blob:onb', durationSeconds: 6, mimeType: 'audio/webm' };
    const monitoringOnly = buildReportSections({
      ...fullReport,
      onboardingHistory: {
        ...fullReport.onboardingHistory,
        extraMonitoring: { ...fullReport.onboardingHistory.extraMonitoring, detailVoiceNote: voiceNote },
      },
    });
    expect(monitoringOnly.history.paragraphs).toContain(REPORT_VOICE_NOTE_NOTE);

    const historyOnly = buildReportSections({
      ...fullReport,
      onboardingHistory: {
        ...fullReport.onboardingHistory,
        history: { ...fullReport.onboardingHistory.history, detailVoiceNote: voiceNote },
      },
    });
    expect(historyOnly.history.paragraphs).toContain(REPORT_VOICE_NOTE_NOTE);

    // And says nothing about a recording when there isn't one.
    expect(buildReportSections(fullReport).history.paragraphs).not.toContain(REPORT_VOICE_NOTE_NOTE);
  });

  it('never mentions the bleeding-how-much followUpId as a raw string anywhere', () => {
    // Guards against a lookup-by-id bug silently printing the id instead of
    // the follow-up's prompt/label.
    const sections = buildReportSections(fullReport);
    expect(JSON.stringify(sections)).not.toContain(BLEEDING_HOW_MUCH_FOLLOWUP_ID);
  });
});

describe('buildKickChart — the line graph the clinician reads', () => {
  it('starts the y axis at zero, never at the window minimum', () => {
    const chart = buildKickChart(fullReport)!;
    expect(chart).not.toBeNull();
    // The whole point: 262..333 must not be zoomed onto the full plot height,
    // which would render a 21% spread as a floor-to-ceiling swing on a
    // document someone uses to decide whether to bring a woman in.
    const max = Math.max(...KICK_COUNTS);
    expect(chart.axisMax).toBeGreaterThan(max);
    expect(chart.axisMax).toBeLessThan(max * 1.5);
  });

  it('labels the axis with a whole number that reads as a scale', () => {
    // 333 kicks + 12% headroom is 373 — a figure corresponding to nothing.
    expect(buildKickChart(fullReport)!.axisMax).toBe(400);
  });

  it('keeps the axis top a strictly-greater integer at every magnitude', () => {
    // A fractional top would be printed rounded while the line was scaled
    // against the unrounded value, putting every point off the printed scale.
    for (const max of [1, 2, 3, 7, 9, 12, 22, 48, 96, 137, 333, 1204]) {
      const chart = buildKickChart({
        ...fullReport,
        dailyKicks: { samples: [{ timestamp: submittedAt, kicks: max }], settledIndex: 0 },
      })!;
      expect(Number.isInteger(chart.axisMax), `axisMax for ${max}`).toBe(true);
      expect(chart.axisMax, `axisMax for ${max}`).toBeGreaterThan(max);
      // And not so generous that ordinary variation is squashed into the floor.
      expect(chart.axisMax, `axisMax for ${max}`).toBeLessThanOrEqual(Math.max(2, max * 2));
    }
  });

  it('returns null for an empty window, so nothing is drawn', () => {
    // An empty frame with a zero axis is a confirmed week of no kicks,
    // manufactured out of no data. There must be no chart at all.
    expect(buildKickChart(minimalReport)).toBeNull();
  });

  it('clamps a settledIndex the sensor boundary reported out of range', () => {
    const beyond = buildKickChart({
      ...fullReport,
      dailyKicks: { samples: buildDailyKicks().samples, settledIndex: 99 },
    })!;
    expect(beyond.settledIndex).toBe(KICK_COUNTS.length - 1);
    const below = buildKickChart({
      ...fullReport,
      dailyKicks: { samples: buildDailyKicks().samples, settledIndex: -7 },
    })!;
    expect(below.settledIndex).toBe(-1);
  });

  it('keeps an all-zero window on the floor rather than dividing by zero', () => {
    const chart = buildKickChart({
      ...fullReport,
      dailyKicks: {
        samples: [
          { timestamp: new Date(submittedAt.getTime() - DAY_MS), kicks: 0 },
          { timestamp: submittedAt, kicks: 0 },
        ],
        settledIndex: 0,
      },
    })!;
    expect(chart.axisMax).toBe(0);
  });
});

describe('the kicks section', () => {
  it('quotes the last COMPLETE day as the headline, never the day still counting', () => {
    const text = buildReportSections(fullReport).kicks.paragraphs.join('\n');
    // 333 is the last settled tally; 176 is today, still in progress. Printing
    // 176 as the figure would show every patient a decline every single day.
    expect(text).toContain('Most recent complete day (24 Jul): 333 kicks.');
    expect(text).not.toContain('Most recent complete day (25 Jul)');
  });

  it('excludes the in-progress day from the quoted range', () => {
    const text = buildReportSections(fullReport).kicks.paragraphs.join('\n');
    // Complete days are 284..333. 176 is today and must not set the floor.
    expect(text).toContain('Range across the complete days: 262 to 333 kicks.');
    expect(text).not.toContain('176 to 333');
  });

  it('marks the in-progress tally in the per-day list, and explains the broken segment', () => {
    const paragraphs = buildReportSections(fullReport).kicks.paragraphs;
    expect(paragraphs).toContain('25 Jul: 176 kicks (interval still in progress)');
    expect(paragraphs).toContain('24 Jul: 333 kicks');
    expect(paragraphs.join('\n')).toContain('is not a fall');
  });

  it('prints every plotted figure as text, so the numbers do not live only in the drawing', () => {
    const text = buildReportSections(fullReport).kicks.paragraphs.join('\n');
    for (const kicks of KICK_COUNTS) {
      expect(text).toContain(`${kicks} kicks`);
    }
  });

  it('states absence, and no figures at all, when the band reported no kicks', () => {
    const paragraphs = buildReportSections(minimalReport).kicks.paragraphs;
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toMatch(/no kick counts were recorded/i);
    // No zeroed table, no "0 kicks", no range, no window line.
    const text = paragraphs.join('\n');
    expect(text).not.toContain('0 kicks');
    expect(text).not.toContain('Range');
    expect(text).not.toContain('Daily tallies');
  });

  it('says so plainly when no interval has completed yet', () => {
    const paragraphs = buildReportSections({
      ...fullReport,
      dailyKicks: { samples: buildDailyKicks().samples, settledIndex: -1 },
    }).kicks.paragraphs;
    const text = paragraphs.join('\n');
    expect(text).toContain('No day in this window has completed yet.');
    expect(text).not.toContain('Most recent complete day');
    expect(text).not.toContain('Range across the complete days');
  });

  it('carries no verdict, threshold or adjective about the numbers', () => {
    const text = buildReportSections(fullReport).kicks.paragraphs.join('\n');
    // WORD-BOUNDARY, not substring. A bare `toContain('low')` fired on
    // "always lower than a full one" — a comparison between a partial tally
    // and a complete one, which is the opposite of a verdict about the baby
    // and is the one sentence stopping a reader misreading the broken segment.
    for (const word of [
      'low',
      'high',
      'normal',
      'abnormal',
      'concerning',
      'reassuring',
      'healthy',
      'expected',
      'threshold',
      'average',
    ]) {
      expect(text, `"${word}" would be a verdict`).not.toMatch(new RegExp(`\\b${word}\\b`, 'i'));
    }
    expect(text).not.toMatch(/a&e/i);
    expect(text).not.toMatch(/detected/i);
  });
});

describe('buildReportPdf', () => {
  it('runs headless and produces non-empty PDF output for a fully-populated report', () => {
    const doc = buildReportPdf(fullReport);
    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('runs headless and produces non-empty PDF output for a minimal/empty report', () => {
    expect(() => buildReportPdf(minimalReport)).not.toThrow();
    const doc = buildReportPdf(minimalReport);
    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('produces multiple pages when content overflows a single page', () => {
    const doc = buildReportPdf(fullReport);
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('draws the kick graph, so the report with a window is larger than the same one without', () => {
    // The only difference between these two documents is the chart's vector
    // output plus the kick figures; if drawKickChart were skipped or drew
    // nothing, the two would be much closer in size.
    const withChart = buildReportPdf(fullReport).output('arraybuffer').byteLength;
    const withoutChart = buildReportPdf({ ...fullReport, dailyKicks: EMPTY_KICKS })
      .output('arraybuffer').byteLength;
    expect(withChart).toBeGreaterThan(withoutChart);
  });

  it('draws the in-progress interval broken, and hands the pen back solid', () => {
    // READ FROM THE CONTENT STREAM, not from a getter. jsPDF has no
    // `getLineDashPattern`, so an assertion phrased against the doc object
    // silently passes whatever the state is. These documents are uncompressed
    // (buildReportPdf passes no `compress` option), so the operators are
    // literal text: `[2. 2.] 0. d` sets a dash, `[] 0. d` clears it.
    const dashOperators = (report: ReportData): string[] => {
      const bytes = new Uint8Array(buildReportPdf(report).output('arraybuffer'));
      const stream = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
      return stream.match(/\[[^\]]*\]\s*[\d.]+\s+d\b/g) ?? [];
    };

    const withChart = dashOperators(fullReport);
    // At least one broken segment: the tail past `settledIndex`.
    expect(withChart.some((op) => /\[\s*[\d.]+/.test(op))).toBe(true);
    // And the LAST thing it does with the dash pattern is clear it — otherwise
    // the disclaimer that follows would render dashed, which no other
    // assertion in this file could see.
    expect(withChart[withChart.length - 1]).toMatch(/\[\s*\]/);

    // Proof the dash came from the chart and nothing else: with no kick window
    // there is no chart, and nothing in this document dashes anything.
    expect(dashOperators({ ...fullReport, dailyKicks: EMPTY_KICKS })).toEqual([]);
  });

  it('restores the body font size after the graph, so the next section is not tiny', () => {
    // drawKickChart drops to 7.5pt for its axis labels. jsPDF does expose
    // getFontSize, so this one can be read off the document directly.
    const doc = buildReportPdf(fullReport);
    expect((doc as unknown as { getFontSize: () => number }).getFontSize()).toBe(10);
  });

  it('renders headlessly with a window whose final interval has not settled', () => {
    expect(() =>
      buildReportPdf({
        ...fullReport,
        dailyKicks: { samples: buildDailyKicks().samples, settledIndex: -1 },
      })
    ).not.toThrow();
  });

  it('renders headlessly with a single-sample kick window', () => {
    // The one-point case has no segments to stroke and no right-hand date.
    expect(() =>
      buildReportPdf({
        ...fullReport,
        dailyKicks: { samples: [{ timestamp: submittedAt, kicks: 12 }], settledIndex: 0 },
      })
    ).not.toThrow();
  });
});
