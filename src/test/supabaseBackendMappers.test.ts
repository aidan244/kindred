import { describe, expect, it } from 'vitest';
import {
  alertFromRow,
  baselineToOverallFraction,
  binsToActivitySamples,
  clinicHoursForDay,
  gestationWeeksAt,
  reportFromRow,
  sessionFromRow,
} from '../lib/backend/supabaseBackend';

describe('gestationWeeksAt', () => {
  it('computes whole weeks from EDD, never storing gestation stale', () => {
    const edd = new Date('2026-06-01T00:00:00Z');
    const now = new Date('2026-03-02T00:00:00Z'); // 91 days before EDD
    // 280 - 91 = 189 days -> 27 whole weeks
    expect(gestationWeeksAt(edd, now)).toBe(27);
  });

  it('never returns negative weeks past the EDD', () => {
    const edd = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-03-01T00:00:00Z'); // well past due
    expect(gestationWeeksAt(edd, now)).toBeGreaterThanOrEqual(0);
  });
});

describe('clinicHoursForDay', () => {
  it('picks the entry for the matching day of week', () => {
    const openingHours = {
      sun: null,
      mon: ['08:00', '18:00'] as [string, string],
      tue: ['08:00', '18:00'] as [string, string],
      wed: ['08:00', '18:00'] as [string, string],
      thu: ['08:00', '18:00'] as [string, string],
      fri: ['08:00', '18:00'] as [string, string],
      sat: null,
    };
    const monday = new Date('2026-01-05T12:00:00'); // a Monday
    expect(clinicHoursForDay(openingHours, monday)).toEqual({
      opens: '08:00',
      closes: '18:00',
      daysDescription: 'mon',
    });
  });

  it('maps a closed (null) day to an opens=closes window, matching the fail-safe in triageContact.ts', () => {
    const openingHours = { sun: null } as Record<string, [string, string] | null>;
    const sunday = new Date('2026-01-04T12:00:00'); // a Sunday
    const hours = clinicHoursForDay(openingHours, sunday);
    expect(hours.opens).toBe(hours.closes);
  });
});

describe('binsToActivitySamples', () => {
  it('drops uncovered bins entirely rather than reporting moved:false', () => {
    const rows = [
      { t: '2026-01-01T00:00:00Z', active_windows: 10, covered_windows: 75 },
      { t: '2026-01-01T00:05:00Z', active_windows: 0, covered_windows: 0 }, // uncovered
      { t: '2026-01-01T00:10:00Z', active_windows: 0, covered_windows: 75 },
    ];
    const samples = binsToActivitySamples(rows);
    expect(samples).toHaveLength(2);
    expect(samples[0]).toEqual({ timestamp: new Date('2026-01-01T00:00:00Z'), moved: true });
    expect(samples[1]).toEqual({ timestamp: new Date('2026-01-01T00:10:00Z'), moved: false });
  });
});

describe('baselineToOverallFraction', () => {
  it('returns 0 when there is no baseline row', () => {
    expect(baselineToOverallFraction(null)).toBe(0);
  });

  it('averages only hours with any coverage', () => {
    const baseline = {
      by_hour: [
        { hour: 0, expectedActiveFraction: 0.2, coverageFraction: 1 },
        { hour: 1, expectedActiveFraction: 0.6, coverageFraction: 1 },
        { hour: 2, expectedActiveFraction: 0, coverageFraction: 0 }, // no coverage -> excluded
      ],
    };
    expect(baselineToOverallFraction(baseline)).toBeCloseTo(0.4, 5);
  });
});

describe('sessionFromRow', () => {
  it('maps a session row plus answers and a self-report into a Session', () => {
    const row = {
      id: 'session-1',
      entry_path: 'adhoc' as const,
      alert_id: null,
      started_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T00:10:00Z',
      disposition: 'routine' as const,
      triage_contact_shown: { label: 'Clinic', number: '123', reason: 'open', kind: 'clinic' as const },
    };
    const answers = [{ question_id: 'movement', answer: false, detail: 'a bit less' }];
    const selfReport = { raw_text: 'Feeling tired' };

    const session = sessionFromRow(row, answers, selfReport);

    expect(session.id).toBe('session-1');
    expect(session.entryPath).toBe('adhoc');
    expect(session.completedAt).toEqual(new Date('2026-01-01T00:10:00Z'));
    // A stored row is one boolean per question, so it maps to a category's
    // GATE answer with no follow-ups — the table holds none to map. See
    // sessionFromRow for why that is a schema gap rather than a mapper one.
    expect(session.redFlagAnswers).toEqual([
      { categoryId: 'movement', gateAnswer: 'no', followUpAnswers: [], detail: 'a bit less' },
    ]);
    expect(session.freeTextDescription).toBe('Feeling tired');
    expect(session.disposition).toBe('routine');
  });

  it('defaults to no answers and empty free text when none are given', () => {
    const row = {
      id: 'session-2',
      entry_path: 'alert' as const,
      alert_id: 'alert-1',
      started_at: '2026-01-01T00:00:00Z',
      completed_at: null,
      disposition: null,
      triage_contact_shown: null,
    };
    const session = sessionFromRow(row);
    expect(session.redFlagAnswers).toEqual([]);
    expect(session.freeTextDescription).toBe('');
    expect(session.completedAt).toBeNull();
  });
});

describe('alertFromRow / reportFromRow', () => {
  it('maps an alert row', () => {
    const alert = alertFromRow({ id: 'alert-1', fired_at: '2026-01-01T00:00:00Z', outcome: null });
    expect(alert).toEqual({ id: 'alert-1', firedAt: new Date('2026-01-01T00:00:00Z'), outcome: null });
  });

  it('maps a report row, including a null delivered_at', () => {
    const report = reportFromRow({
      id: 'report-1',
      session_id: 'session-1',
      generated_at: '2026-01-01T00:00:00Z',
      delivery_status: 'pending',
      delivery_attempts: 0,
      delivered_at: null,
    });
    expect(report.deliveredAt).toBeNull();
    expect(report.deliveryStatus).toBe('pending');
  });
});
