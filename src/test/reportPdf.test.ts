import { describe, expect, it } from 'vitest';
import {
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
import type { ActivitySample, CategoryAnswer, ReportData, VoiceNote } from '../types';

const submittedAt = new Date(2026, 6, 25, 14, 32, 0, 0);

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

  it('never mentions the bleeding-how-much followUpId as a raw string anywhere', () => {
    // Guards against a lookup-by-id bug silently printing the id instead of
    // the follow-up's prompt/label.
    const sections = buildReportSections(fullReport);
    expect(JSON.stringify(sections)).not.toContain(BLEEDING_HOW_MUCH_FOLLOWUP_ID);
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
});
