import { describe, expect, it } from 'vitest';
import {
  buildReportPdf,
  buildReportSections,
  type ReportSections,
} from '../logic/reportPdf';
import { redFlagQuestions, REPORT_DISCLAIMER } from '../data/clinicalContent';
import type { ActivitySample, ReportData } from '../types';

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

const fullReport: ReportData = {
  patientName: 'Amara Whitfield',
  gestationWeeks: 34,
  entryPath: 'alert',
  submittedAt,
  redFlagAnswers: redFlagQuestions.map((question, index) => ({
    questionId: question.id,
    answer: index === 0 ? 'no' : 'yes',
    detail: index === 1 ? 'Small amount, pinkish' : undefined,
  })),
  freeTextDescription:
    'I noticed less movement than usual this afternoon and felt a bit dizzy.',
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
  redFlagAnswers: [],
  freeTextDescription: '',
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
    expect(text).not.toContain('A&E');
    expect(text).not.toContain('detected');
  });

  it('never contains "A&E" or "detected" on a minimal/empty report', () => {
    const text = flatten(buildReportSections(minimalReport));
    expect(text).not.toContain('A&E');
    expect(text).not.toContain('detected');
  });

  it('does not crash on missing/empty detail fields, and does not fabricate content', () => {
    expect(() => buildReportSections(minimalReport)).not.toThrow();
    const sections = buildReportSections(minimalReport);
    expect(sections.description.paragraphs[0]).toContain(
      'No description provided'
    );
    expect(sections.history.paragraphs[0]).toContain('not recorded');
  });

  it('joins every red-flag question with her answer, by questionId', () => {
    const sections = buildReportSections(fullReport);
    const text = sections.redFlags.paragraphs.join('\n');
    for (const question of redFlagQuestions) {
      expect(text).toContain(question.question);
    }
    // The movement question (index 0) was answered "no".
    expect(sections.redFlags.paragraphs[0]).toContain('No');
    // Whichever question is at index 1 carried a detail string.
    expect(sections.redFlags.paragraphs[1]).toContain('Small amount, pinkish');
  });

  it('renders an unanswered red-flag question as "not answered"', () => {
    const sections = buildReportSections(minimalReport);
    for (const paragraph of sections.redFlags.paragraphs) {
      expect(paragraph).toContain('not answered');
    }
  });

  it('includes the free-text description verbatim', () => {
    const sections = buildReportSections(fullReport);
    expect(sections.description.paragraphs).toContain(
      fullReport.freeTextDescription
    );
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

  it('handles an empty activity array without crashing, all-zero rows', () => {
    const sections = buildReportSections(minimalReport);
    expect(sections.activity.paragraphs[0]).toContain('0 movements recorded');
    const hourlyLines = sections.activity.paragraphs.slice(3);
    expect(hourlyLines).toHaveLength(24);
    for (const line of hourlyLines) {
      expect(line).toContain('moved in 0 of 0 samples');
    }
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
    expect(sections.entry.paragraphs.join(' ')).not.toContain('detected');
    expect(sections.entry.paragraphs.join(' ').toLowerCase()).toContain('alert');
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
