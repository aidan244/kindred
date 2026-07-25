import { describe, expect, it } from 'vitest';
import { buildCanonicalReportPdf, buildCanonicalReportPdfBlob } from '../lib/report/pdf';
import type { CanonicalReportData, PriorEpisode } from '../lib/report/types';
import type { MovementBin } from '../lib/movement/types';

const BASE_NOW = new Date('2026-01-15T21:30:00');

function fiveMinBins(hours: number, coveredWindows: number, activeWindows: number, now: Date): MovementBin[] {
  const bins: MovementBin[] = [];
  const totalBins = (hours * 60) / 5;
  for (let i = 0; i < totalBins; i += 1) {
    bins.push({
      t: new Date(now.getTime() - (totalBins - i) * 5 * 60 * 1000),
      activeWindows,
      coveredWindows,
    });
  }
  return bins;
}

function makeReportData(overrides: Partial<CanonicalReportData> = {}): CanonicalReportData {
  return {
    patientName: 'Amara Whitfield',
    dateOfBirth: new Date('1996-04-12T00:00:00'),
    clinicReference: 'TH-2291',
    edd: new Date('2026-03-01T00:00:00'),
    bookedUnitName: "St. Augustine's Maternity Unit",
    clinicName: 'Thornfield Private Maternity Clinic',
    contactedAt: BASE_NOW,
    entryPath: 'adhoc',
    disposition: 'routine',
    triageContact: {
      label: 'Thornfield Private Maternity Clinic',
      number: '020 7946 0523',
      reason: 'Your clinic is open now, call this number.',
      kind: 'clinic',
    },
    redFlags: [
      { question: 'Are you bleeding?', answer: 'no' },
      {
        question: 'Has the baby moved less, stopped, or changed from normal?',
        answer: 'yes',
        followUps: [
          { question: 'When was the last movement?', answer: 'About 6 hours ago' },
          { question: 'Did movement return after rest or food?', answer: 'No' },
        ],
      },
    ],
    freeTextRaw: "I've felt a lot less movement since this afternoon and it's worrying me.",
    structured: {
      perceivedMovement: 'less',
      character: ['fewer kicks than usual'],
      timeWindow: { start: BASE_NOW, end: BASE_NOW, confidence: 'inferred' },
      additionalSymptoms: [],
      verbatimHighlights: ["it's worrying me"],
    },
    movementBins: fiveMinBins(24, 75, 10, BASE_NOW),
    baseline: {
      computedAt: BASE_NOW,
      daysUsed: 7,
      sufficient: true,
      byHour: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        expectedActiveFraction: 0.3,
        coverageFraction: 1,
      })),
    },
    onboardingHistory: {
      weeksPregnant: 34,
      extraMonitoring: { answer: 'no', detail: '' },
      history: { selected: [], detail: '' },
    },
    priorEpisodes: [
      { date: new Date('2026-01-06T10:00:00'), entryPath: 'adhoc', disposition: 'routine' },
      { date: new Date('2026-01-12T02:00:00'), entryPath: 'alert', disposition: 'escalate' },
    ],
    reportGeneratedAt: BASE_NOW,
    ...overrides,
  };
}

describe('buildCanonicalReportPdf', () => {
  it('renders without throwing and sets Times as the document font', () => {
    const doc = buildCanonicalReportPdf(makeReportData());
    expect(doc.getFont().fontName).toBe('times');
  });

  it('produces at least one page, and more when there is enough content to force a break', () => {
    const shortReport = buildCanonicalReportPdf(makeReportData({ priorEpisodes: [], redFlags: [] }));
    expect(shortReport.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const manyPriorEpisodes: PriorEpisode[] = Array.from({ length: 40 }, (_, i) => ({
      date: new Date(BASE_NOW.getTime() - (i + 1) * 24 * 60 * 60 * 1000),
      entryPath: i % 2 === 0 ? 'adhoc' : 'alert',
      disposition: i % 3 === 0 ? 'escalate' : 'routine',
    }));
    const longReport = buildCanonicalReportPdf(makeReportData({ priorEpisodes: manyPriorEpisodes }));
    expect(longReport.getNumberOfPages()).toBeGreaterThan(1);
  });

  it('never contains "detected" or "A&E" in the rendered document text', () => {
    const doc = buildCanonicalReportPdf(makeReportData());
    const totalPages = doc.getNumberOfPages();
    let allText = '';
    for (let page = 1; page <= totalPages; page += 1) {
      // jsPDF doesn't expose a text-extraction API on the document object
      // itself; the internal page content stream is the practical way to
      // assert on rendered text without a separate PDF-parsing dependency.
      const pageContent = (doc as unknown as { internal: { pages: string[][] } }).internal.pages[page];
      allText += (pageContent ?? []).join(' ');
    }
    expect(allText.toLowerCase()).not.toContain('detected');
    expect(allText.toUpperCase()).not.toContain('A&E');
  });

  it('applies a running header/footer identical in structure on every page', () => {
    const manyPriorEpisodes: PriorEpisode[] = Array.from({ length: 40 }, (_, i) => ({
      date: new Date(BASE_NOW.getTime() - (i + 1) * 24 * 60 * 60 * 1000),
      entryPath: 'adhoc',
      disposition: 'routine',
    }));
    const doc = buildCanonicalReportPdf(makeReportData({ priorEpisodes: manyPriorEpisodes }));
    const totalPages = doc.getNumberOfPages();
    expect(totalPages).toBeGreaterThan(1);

    for (let page = 1; page <= totalPages; page += 1) {
      const pageContent = (doc as unknown as { internal: { pages: string[][] } }).internal.pages[page].join(' ');
      expect(pageContent).toContain('HELD');
      expect(pageContent).toContain(`Page ${page} of ${totalPages}`);
    }
  });

  it('buildCanonicalReportPdfBlob returns a non-empty PDF blob', () => {
    const blob = buildCanonicalReportPdfBlob(makeReportData());
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });

  it('renders cleanly with no red flags, no structured extraction, and no prior episodes', () => {
    const doc = buildCanonicalReportPdf(
      makeReportData({ redFlags: [], structured: null, freeTextRaw: '', priorEpisodes: [] })
    );
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
