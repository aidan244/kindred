import { describe, expect, it } from 'vitest';
import {
  buildCanonicalReportSections,
  buildHourlyBuckets,
  formatGestation,
  gestationWeeksAndDaysAt,
  reportFilename,
  surnameOf,
  type ReportSections,
} from '../lib/report/sections';
import type { CanonicalReportData } from '../lib/report/types';
import type { MovementBin } from '../lib/movement/types';

const BASE_NOW = new Date('2026-01-15T21:30:00');

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
    redFlags: [],
    freeTextRaw: '',
    structured: null,
    movementBins: [],
    baseline: null,
    onboardingHistory: {
      weeksPregnant: 34,
      extraMonitoring: { answer: 'no', detail: '' },
      history: { selected: [], detail: '' },
    },
    priorEpisodes: [],
    reportGeneratedAt: BASE_NOW,
    ...overrides,
  };
}

function flattenSectionsToText(sections: ReportSections): string {
  return [
    sections.documentTitle,
    sections.clinicName,
    sections.generatedLine,
    ...sections.patientIdentification,
    ...sections.reasonForContact,
    ...sections.redFlagEntries.flatMap((entry) => [
      entry.question,
      entry.detail ?? '',
      ...(entry.followUps ?? []).flatMap((f) => [f.question, f.answer]),
    ]),
    ...sections.description.structuredParagraphs,
    ...sections.description.verbatimHighlights,
    sections.description.rawFallback ?? '',
    sections.perceptionContext.sensorParagraph,
    sections.perceptionContext.selfReportParagraph,
    ...sections.onboardingParagraphs,
    ...sections.disclaimerParagraphs,
  ].join(' ');
}

describe('buildCanonicalReportSections — forbidden words', () => {
  const scenarios: Array<[string, Partial<CanonicalReportData>]> = [
    ['default routine, no red flags, no history', {}],
    [
      'escalate with a positive red flag and a follow-up',
      {
        disposition: 'escalate',
        entryPath: 'alert',
        redFlags: [
          {
            question: 'Has the baby moved less, stopped, or changed from normal?',
            answer: 'yes',
            followUps: [{ question: 'When was the last movement?', answer: 'About 6 hours ago' }],
          },
        ],
      },
    ],
    [
      'with a structured extraction and verbatim highlights',
      {
        structured: {
          perceivedMovement: 'less',
          character: ['fewer kicks'],
          timeWindow: { start: BASE_NOW, end: BASE_NOW, confidence: 'inferred' },
          additionalSymptoms: ['tiredness'],
          verbatimHighlights: ['it just feels different today'],
        },
      },
    ],
    [
      'with several prior episodes',
      {
        priorEpisodes: [
          { date: new Date('2026-01-06T10:00:00'), entryPath: 'adhoc', disposition: 'routine' },
          { date: new Date('2026-01-12T02:00:00'), entryPath: 'alert', disposition: 'escalate' },
        ],
      },
    ],
  ];

  it.each(scenarios)('never contains "detected" or "A&E" — %s', (_label, overrides) => {
    const sections = buildCanonicalReportSections(makeReportData(overrides));
    const text = flattenSectionsToText(sections).toLowerCase();
    expect(text).not.toContain('detected');
    expect(text.toUpperCase()).not.toContain('A&E');
  });
});

describe('buildCanonicalReportSections — recurrence count', () => {
  it('counts this contact plus every prior episode', () => {
    const sections = buildCanonicalReportSections(
      makeReportData({
        priorEpisodes: [
          { date: new Date('2026-01-06T10:00:00'), entryPath: 'adhoc', disposition: 'routine' },
          { date: new Date('2026-01-12T02:00:00'), entryPath: 'alert', disposition: 'escalate' },
        ],
      })
    );
    expect(sections.recurrenceCount).toBe(3);
  });

  it('is 1 when there are no prior episodes', () => {
    const sections = buildCanonicalReportSections(makeReportData());
    expect(sections.recurrenceCount).toBe(1);
  });
});

describe('buildCanonicalReportSections — perception context is two modalities, never a merged rate', () => {
  it('renders sensor activity and her own report as separate paragraphs with no shared number', () => {
    const sections = buildCanonicalReportSections(
      makeReportData({
        redFlags: [{ question: 'Are you bleeding?', answer: 'yes', detail: 'a little' }],
        freeTextRaw: 'Feeling a bit different today',
      })
    );
    expect(sections.perceptionContext.sensorParagraph).toMatch(/Sensor-observed activity/);
    expect(sections.perceptionContext.selfReportParagraph).toMatch(/What she reported/);
    expect(sections.perceptionContext.selfReportParagraph).toContain('Are you bleeding?');
    expect(sections.perceptionContext.selfReportParagraph).toContain('Feeling a bit different today');
    // No paragraph computes a rate from the other — "perception rate" language
    // would indicate the two modalities were merged into a number.
    expect(sections.perceptionContext.sensorParagraph).not.toMatch(/perception rate/i);
    expect(sections.perceptionContext.selfReportParagraph).not.toMatch(/perception rate/i);
  });
});

describe('buildHourlyBuckets — coverage honesty', () => {
  it('marks an hour with zero covered windows as uncovered, never as a quiet (zero-activity) hour', () => {
    const now = new Date('2026-01-15T12:00:00');
    const coveredQuietHourStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const uncoveredHourStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);

    const bins: MovementBin[] = [
      { t: coveredQuietHourStart, activeWindows: 0, coveredWindows: 75 },
      { t: uncoveredHourStart, activeWindows: 0, coveredWindows: 0 },
    ];

    const buckets = buildHourlyBuckets(bins, now);
    const coveredQuietBucket = buckets.find(
      (b) => b.hourLabel === `${coveredQuietHourStart.getHours().toString().padStart(2, '0')}:00`
    );
    const uncoveredBucket = buckets.find(
      (b) => b.hourLabel === `${uncoveredHourStart.getHours().toString().padStart(2, '0')}:00`
    );

    expect(coveredQuietBucket).toMatchObject({ covered: true, activeFraction: 0 });
    expect(uncoveredBucket?.covered).toBe(false);
  });
});

describe('gestation formatting', () => {
  it('computes whole weeks and remainder days', () => {
    const edd = new Date('2026-06-01T00:00:00');
    const now = new Date('2026-03-02T00:00:00'); // 91 days before EDD -> 189 gestation days
    expect(gestationWeeksAndDaysAt(edd, now)).toEqual({ weeks: 27, days: 0 });
  });

  it('formatGestation omits the days clause when it is zero', () => {
    const edd = new Date('2026-06-01T00:00:00');
    const now = new Date('2026-03-02T00:00:00');
    expect(formatGestation(edd, now)).toBe('27 weeks');
  });

  it('formatGestation includes the days clause when non-zero, with correct singular/plural', () => {
    const edd = new Date('2026-06-01T00:00:00');
    // One day later than the zero-remainder case above -> one more
    // gestation day elapsed -> 27 weeks 1 day.
    const oneDayIn = new Date('2026-03-03T00:00:00');
    expect(formatGestation(edd, oneDayIn)).toBe('27 weeks 1 day');

    const twoDaysIn = new Date('2026-03-04T00:00:00');
    expect(formatGestation(edd, twoDaysIn)).toBe('27 weeks 2 days');
  });
});

describe('surnameOf / reportFilename', () => {
  it('takes the last word as the surname', () => {
    expect(surnameOf('Amara Whitfield')).toBe('Whitfield');
    expect(surnameOf('Cher')).toBe('Cher');
  });

  it('builds a filename matching Held_Report_<Surname>_<YYYYMMDD-HHMM>.pdf', () => {
    const filename = reportFilename('Amara Whitfield', new Date('2026-01-15T21:05:00'));
    expect(filename).toBe('Held_Report_Whitfield_20260115-2105.pdf');
  });
});
