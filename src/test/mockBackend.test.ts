import { describe, expect, it } from 'vitest';
import { MockBackend } from '../lib/backend/mockBackend';
import { disposition } from '../logic/disposition';
import { getTriageContact } from '../logic/triageContact';
import {
  BLEEDING_CATEGORY_ID,
  patientFixture,
  redFlagCategories,
} from '../data/clinicalContent';
import type { DetectorFiring } from '../lib/movement/types';
import type { CategoryAnswer } from '../types';

/**
 * Fixtures rebuilt against the six-category questionnaire.
 *
 * They used to be built from `redFlagQuestions` and a per-question `flagWhen`
 * — the flat model the frontend replaced before this backend was written, and
 * which the old fixture still keyed by the retired id 'bleeding-fluid'.
 * `disposition()` reads `gateAnswer` and nothing else, so these express the
 * same two cases the test always meant: nothing flagged, and one thing
 * flagged.
 */
const NO_ANSWERS: CategoryAnswer[] = redFlagCategories.map((category) => ({
  categoryId: category.id,
  gateAnswer: 'no',
  followUpAnswers: [],
}));

const ONE_POSITIVE_FLAG: CategoryAnswer[] = NO_ANSWERS.map((answer) =>
  answer.categoryId === BLEEDING_CATEGORY_ID ? { ...answer, gateAnswer: 'yes' } : answer
);

describe('MockBackend session lifecycle / disposition', () => {
  it('alert path with no positive flags still escalates, through the backend seam', async () => {
    const backend = new MockBackend();
    const session = await backend.createSession('alert');
    await backend.saveRedFlagAnswers(session.id, []);
    const completed = await backend.completeSession(session.id);

    expect(completed.disposition).toBe('escalate');
    expect(completed.disposition).toBe(disposition('alert', []));
  });

  it('ad hoc with one positive flag escalates, through the backend seam', async () => {
    const backend = new MockBackend();
    const session = await backend.createSession('adhoc');
    await backend.saveRedFlagAnswers(session.id, ONE_POSITIVE_FLAG);
    const completed = await backend.completeSession(session.id);

    expect(completed.disposition).toBe('escalate');
    expect(completed.disposition).toBe(disposition('adhoc', ONE_POSITIVE_FLAG));
  });

  it('ad hoc with zero positive flags is routine — the only combination that is', async () => {
    const backend = new MockBackend();
    const session = await backend.createSession('adhoc');
    await backend.saveRedFlagAnswers(session.id, NO_ANSWERS);
    const completed = await backend.completeSession(session.id);

    expect(completed.disposition).toBe('routine');
    expect(completed.disposition).toBe(disposition('adhoc', NO_ANSWERS));
  });

  it('never returns routine for an alert-path entry, even with zero answers saved', async () => {
    const backend = new MockBackend();
    const session = await backend.createSession('alert');
    const completed = await backend.completeSession(session.id);

    expect(completed.disposition).toBe('escalate');
  });

  it('rejects unknown session ids rather than silently returning something', async () => {
    const backend = new MockBackend();
    await expect(backend.getSession('not-a-real-id')).rejects.toThrow();
  });
});

describe('MockBackend triage contact', () => {
  it('completeSession stores exactly what getTriageContact(now, patient) resolves to', async () => {
    const fixedNow = new Date('2024-01-01T14:00:00');
    const backend = new MockBackend({ now: () => fixedNow });
    const session = await backend.createSession('adhoc');
    await backend.saveRedFlagAnswers(session.id, NO_ANSWERS);
    const completed = await backend.completeSession(session.id);

    expect(completed.triageContactShown).toEqual(getTriageContact(fixedNow, patientFixture));
  });

  it('resolves the out-of-hours maternity unit at 3am and the clinic at 2pm', async () => {
    const night = new Date('2024-01-01T03:00:00');
    const day = new Date('2024-01-01T14:00:00');

    const nightBackend = new MockBackend({ now: () => night });
    const nightSession = await nightBackend.createSession('adhoc');
    const nightCompleted = await nightBackend.completeSession(nightSession.id);
    expect(nightCompleted.triageContactShown?.kind).toBe('unit');

    const dayBackend = new MockBackend({ now: () => day });
    const daySession = await dayBackend.createSession('adhoc');
    const dayCompleted = await dayBackend.completeSession(daySession.id);
    expect(dayCompleted.triageContactShown?.kind).toBe('clinic');
  });
});

describe('MockBackend alerts', () => {
  it('fireAlert creates a pending alert, and creating a session from it marks it session_started', async () => {
    const backend = new MockBackend();
    const alert = await backend.fireAlert();
    expect(await backend.getPendingAlert()).toEqual(alert);

    await backend.createSession('alert', alert.id);
    expect(await backend.getPendingAlert()).toBeNull();
  });

  it('acknowledgeAlert records the given outcome', async () => {
    const backend = new MockBackend();
    const alert = await backend.fireAlert();
    await backend.acknowledgeAlert(alert.id, 'dismissed');
    expect(await backend.getPendingAlert()).toBeNull();
  });

  it('createSession rejects an unknown alertId', async () => {
    const backend = new MockBackend();
    await expect(backend.createSession('alert', 'not-a-real-alert')).rejects.toThrow();
  });

  it('fireDetectorAlert creates a pending alert sharing the exact same lifecycle as fireAlert', async () => {
    const backend = new MockBackend();
    const firing: DetectorFiring = {
      detectorVersion: 'kick-detector-v1',
      rule: 'reduced_kick_rate',
      windowFrom: new Date('2026-01-12T00:00:00'),
      windowTo: new Date('2026-01-15T00:00:00'),
      coverageFraction: 1,
      observed: 65,
      expected: 186,
      threshold: 93,
    };
    const alert = await backend.fireDetectorAlert(firing);
    expect(await backend.getPendingAlert()).toEqual(alert);

    await backend.createSession('alert', alert.id);
    expect(await backend.getPendingAlert()).toBeNull();
  });

  it('fireDetectorAlert audits the rule and measurements', async () => {
    const backend = new MockBackend();
    const firing: DetectorFiring = {
      detectorVersion: 'kick-detector-v1',
      rule: 'reduced_kick_rate',
      windowFrom: new Date('2026-01-12T00:00:00'),
      windowTo: new Date('2026-01-15T00:00:00'),
      coverageFraction: 1,
      observed: 65,
      expected: 186,
      threshold: 93,
    };
    await backend.fireDetectorAlert(firing);

    const log = await backend.getAuditLog();
    const entry = log.find((e) => e.event === 'alert_fired');
    expect(entry?.detail).toMatchObject({
      rule: 'reduced_kick_rate',
      observed: 65,
      expected: 186,
      threshold: 93,
    });
  });
});

describe('MockBackend reports', () => {
  it('buildReportData assembles the same ReportData shape the frontend expects', async () => {
    const backend = new MockBackend();
    const session = await backend.createSession('adhoc');
    await backend.saveRedFlagAnswers(session.id, NO_ANSWERS);
    await backend.saveSelfReport(session.id, 'Feeling a bit less movement today.');
    await backend.completeSession(session.id);

    const report = await backend.buildReportData(session.id);

    expect(report.patientName).toBe(patientFixture.name);
    expect(report.gestationWeeks).toBe(patientFixture.gestationWeeks);
    expect(report.entryPath).toBe('adhoc');
    expect(report.freeTextDescription).toBe('Feeling a bit less movement today.');
    expect(Array.isArray(report.recentActivity)).toBe(true);
    expect(typeof report.activityBaseline).toBe('number');
  });

  it('storeReport records a delivery status and audit entry, even for dismissal-only sessions', async () => {
    const backend = new MockBackend();
    const alert = await backend.fireAlert();
    const session = await backend.createSession('alert', alert.id);
    await backend.acknowledgeAlert(alert.id, 'dismissed');
    const completed = await backend.completeSession(session.id);
    // A dismissed alert still generates a report — the clinic holds
    // continuity and a dismissal is information.
    const pdfBlob = new Blob(['stand-in pdf bytes']);
    const record = await backend.storeReport(completed.id, pdfBlob);

    expect(record.deliveryStatus).toBe('sent');
    expect(record.sessionId).toBe(completed.id);
    expect((await backend.getReport(record.id))).toEqual(record);
  });

  it('storeReport rejects an unknown session id', async () => {
    const backend = new MockBackend();
    await expect(backend.storeReport('not-a-real-id', new Blob(['x']))).rejects.toThrow();
  });
});

describe('MockBackend audit log', () => {
  it('accumulates an entry per lifecycle event', async () => {
    const backend = new MockBackend();
    const session = await backend.createSession('adhoc');
    await backend.saveRedFlagAnswers(session.id, NO_ANSWERS);
    await backend.completeSession(session.id);

    const log = await backend.getAuditLog();
    const events = log.map((entry) => entry.event);

    expect(events).toContain('session_created');
    expect(events).toContain('red_flag_answers_saved');
    expect(events).toContain('session_completed');
  });
});
