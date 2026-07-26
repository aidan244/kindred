/**
 * In-memory implementation of HeldBackend. Deterministic (sequential ids,
 * an injectable clock), resolves every promise immediately — this is what
 * the demo runs on, and it must never depend on a network round trip.
 *
 * Seeded from the frontend's own existing fixtures rather than new ones:
 * `patientFixture` (src/data/clinicalContent.ts) for patient/clinic/unit
 * details, and the existing binary 'quiet' | 'active' seed activity
 * variants (src/data/seedActivity.ts) via `getMovementStream`. No new
 * fixture or ActivityVariant is introduced in this phase.
 */

import type { ActivityVariant, CategoryAnswer, OnboardingAnswers } from '../../types';
import {
  patientFixture,
  REPORT_DISCLAIMER,
  // Aliased: `../report/clinicalRedFlags.ts` exports an unrelated type under
  // the same name, for the PDF's own table. These are not interchangeable.
  redFlagCategories as questionnaireCategories,
} from '../../data/clinicalContent';
import { disposition } from '../../logic/disposition';
import { getTriageContact } from '../../logic/triageContact';
import { getMovementStream } from '../../sensors/MovementStream';
import { aggregateToBins } from '../movement/aggregate.ts';
import { computeBaseline } from '../movement/baseline.ts';
import { generateMovement } from '../movement/generator.ts';
import { demoRedFlagAnswers, redFlagCategories, toRedFlagEntries } from '../report/clinicalRedFlags.ts';
import { buildCanonicalReportPdfBlob } from '../report/pdf.ts';
import type { CanonicalReportData, PriorEpisode } from '../report/types.ts';
import type { HeldBackend } from './HeldBackend';
import type {
  Alert,
  AlertId,
  AlertOutcome,
  AuditEvent,
  ReportData,
  ReportId,
  ReportRecord,
  Session,
  SessionEntryPath,
  SessionId,
} from './types';

// Fixture-only fields the canonical report needs that the frontend's own
// Patient type (src/types.ts) doesn't carry — patientFixture has no DOB,
// EDD, or clinic reference, since the live app derives gestation from a
// single weeks number rather than an EDD. These exist only so the mock
// path can demonstrate the canonical PDF's section 1; they are not read
// anywhere else.
const MOCK_PATIENT_DOB = new Date('1996-04-12T00:00:00');
const MOCK_CLINIC_REFERENCE = 'TH-2291';

/** Back-derives a plausible EDD from patientFixture's fixed gestationWeeks
 * relative to whatever `now` is at call time, so the demo stays internally
 * consistent (weeks-at-contact matches patientFixture.gestationWeeks)
 * regardless of when it's run. */
function eddForGestationWeeks(gestationWeeks: number, now: Date): Date {
  const daysRemaining = 280 - gestationWeeks * 7;
  return new Date(now.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
}

// A separate seed from src/data/seedActivity.ts's own — this drives Phase
// 2's richer, coverage-aware generator (src/lib/movement/generator.ts),
// used only for the canonical PDF's movement band, which needs coverage
// data the frontend's boolean-only ActivitySample can't provide.
const CANONICAL_REPORT_GENERATOR_SEED = 0x48454c44; // 'HELD'

// Onboarding isn't captured through this backend in Phase 1 (no frontend
// file wires it in yet — see the plan's "No frontend files touched" note).
// Reports built here carry this empty-but-shaped placeholder rather than
// inventing fixture answers, so a future phase's wiring point is obvious:
// whatever calls createSession is where real onboarding data would be
// threaded through too.
const EMPTY_ONBOARDING_ANSWERS: OnboardingAnswers = {
  weeksPregnant: null,
  extraMonitoring: { answer: null, detail: '' },
  history: { selected: [], detail: '' },
};

const DEFAULT_ACTIVITY_VARIANT: ActivityVariant = 'active';

function nextIdFactory(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${counter}`;
  };
}

export class MockBackend implements HeldBackend {
  private readonly now: () => Date;
  private readonly sessions = new Map<SessionId, Session>();
  private readonly alerts = new Map<AlertId, Alert>();
  private readonly reports = new Map<ReportId, ReportRecord>();
  private readonly auditLog: AuditEvent[] = [];

  private readonly nextSessionId = nextIdFactory('session');
  private readonly nextAlertId = nextIdFactory('alert');
  private readonly nextReportId = nextIdFactory('report');

  /** `activityVariant` selects which seeded stream buildReportData reads
   * from — the mock's stand-in for "this patient's real stream", since
   * there is no per-patient identity in this phase. */
  constructor(options: { now?: () => Date; activityVariant?: ActivityVariant } = {}) {
    this.now = options.now ?? (() => new Date());
    this.activityVariant = options.activityVariant ?? DEFAULT_ACTIVITY_VARIANT;
  }

  private activityVariant: ActivityVariant;

  private requireSession(sessionId: SessionId): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    return session;
  }

  async createSession(entryPath: SessionEntryPath, alertId?: AlertId): Promise<Session> {
    if (alertId !== undefined && !this.alerts.has(alertId)) {
      throw new Error(`Unknown alert: ${alertId}`);
    }
    const session: Session = {
      id: this.nextSessionId(),
      entryPath,
      alertId: alertId ?? null,
      startedAt: this.now(),
      completedAt: null,
      redFlagAnswers: [],
      freeTextDescription: '',
      disposition: null,
      triageContactShown: null,
    };
    this.sessions.set(session.id, session);
    if (alertId !== undefined) {
      const alert = this.alerts.get(alertId);
      if (alert) {
        this.alerts.set(alertId, { ...alert, outcome: 'session_started' });
      }
    }
    await this.audit('session_created', { sessionId: session.id, entryPath });
    return session;
  }

  async saveRedFlagAnswers(sessionId: SessionId, answers: CategoryAnswer[]): Promise<Session> {
    const session = this.requireSession(sessionId);
    const updated: Session = { ...session, redFlagAnswers: answers };
    this.sessions.set(sessionId, updated);
    await this.audit('red_flag_answers_saved', { sessionId, count: answers.length });
    return updated;
  }

  async saveSelfReport(sessionId: SessionId, freeTextDescription: string): Promise<Session> {
    const session = this.requireSession(sessionId);
    const updated: Session = { ...session, freeTextDescription };
    this.sessions.set(sessionId, updated);
    await this.audit('self_report_saved', { sessionId });
    return updated;
  }

  async completeSession(sessionId: SessionId): Promise<Session> {
    const session = this.requireSession(sessionId);
    // The one and only place disposition is evaluated: the pure, tested
    // rule from src/logic/disposition.ts, applied to exactly what's stored
    // on this session — never movement data (clinical safety rule 5).
    const outcome = disposition(session.entryPath, session.redFlagAnswers);
    const triageContactShown = getTriageContact(this.now(), patientFixture);
    const updated: Session = {
      ...session,
      completedAt: this.now(),
      disposition: outcome,
      triageContactShown,
    };
    this.sessions.set(sessionId, updated);
    await this.audit('session_completed', { sessionId, disposition: outcome });
    return updated;
  }

  async getSession(sessionId: SessionId): Promise<Session> {
    return this.requireSession(sessionId);
  }

  async fireAlert(): Promise<Alert> {
    const alert: Alert = { id: this.nextAlertId(), firedAt: this.now(), outcome: null };
    this.alerts.set(alert.id, alert);
    await this.audit('alert_fired', { alertId: alert.id });
    return alert;
  }

  async getPendingAlert(): Promise<Alert | null> {
    for (const alert of this.alerts.values()) {
      if (alert.outcome === null) {
        return alert;
      }
    }
    return null;
  }

  async acknowledgeAlert(alertId: AlertId, outcome: AlertOutcome): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Unknown alert: ${alertId}`);
    }
    this.alerts.set(alertId, { ...alert, outcome });
    await this.audit('alert_acknowledged', { alertId, outcome });
  }

  async buildReportData(sessionId: SessionId): Promise<ReportData> {
    const session = this.requireSession(sessionId);
    const stream = getMovementStream(this.activityVariant);
    const submittedAt = session.completedAt ?? this.now();
    const report: ReportData = {
      patientName: patientFixture.name,
      gestationWeeks: patientFixture.gestationWeeks,
      entryPath: session.entryPath,
      submittedAt,
      categoryAnswers: session.redFlagAnswers,
      // Derived, never asserted — see ReportData.endedBeforeAllCategories.
      endedBeforeAllCategories: questionnaireCategories.some(
        (category) => !session.redFlagAnswers.some((a) => a.categoryId === category.id)
      ),
      freeTextDescription: session.freeTextDescription,
      freeTextVoiceNote: null,
      onboardingHistory: EMPTY_ONBOARDING_ANSWERS,
      recentActivity: stream.getWindow(24),
      activityBaseline: stream.getBaseline(),
      // Same seeded stream as the movement window above, so the mock's report
      // and the mock's screens agree about this patient's kicks.
      dailyKicks: stream.getDailyKickWindow(),
      disclaimer: REPORT_DISCLAIMER,
    };
    await this.audit('report_data_built', { sessionId });
    return report;
  }

  async storeReport(sessionId: SessionId, pdf: Blob): Promise<ReportRecord> {
    this.requireSession(sessionId);
    const record: ReportRecord = {
      id: this.nextReportId(),
      sessionId,
      generatedAt: this.now(),
      // The mock resolves delivery immediately and optimistically — there
      // is no real transport in this phase. A SupabaseBackend (Phase 3)
      // must not default to 'sent' the same way; it has to reflect a real
      // delivery attempt, since a silently-failed report is the worst
      // failure mode in the whole system.
      deliveryStatus: 'sent',
      deliveryAttempts: 1,
      deliveredAt: this.now(),
    };
    this.reports.set(record.id, record);
    await this.audit('report_stored', { sessionId, reportId: record.id, sizeBytes: pdf.size });
    return record;
  }

  async getReport(reportId: ReportId): Promise<ReportRecord> {
    const record = this.reports.get(reportId);
    if (!record) {
      throw new Error(`Unknown report: ${reportId}`);
    }
    return record;
  }

  async buildCanonicalReportPdf(sessionId: SessionId): Promise<Blob> {
    const session = this.requireSession(sessionId);
    const now = session.completedAt ?? this.now();

    // Phase 2's own generator, not src/data/seedActivity.ts — the
    // canonical PDF's movement band needs coverage (covered_windows), and
    // the frontend's boolean-only ActivitySample has no such field.
    const generated = generateMovement({
      seed: CANONICAL_REPORT_GENERATOR_SEED,
      from: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      to: now,
    });
    const bins = aggregateToBins(generated.sensorWindows);
    const baseline = computeBaseline(bins, now);
    const cutoffMs = now.getTime() - 24 * 60 * 60 * 1000;
    const recentBins = bins.filter((bin) => bin.t.getTime() >= cutoffMs);

    // Fixture prior episodes, purely to demonstrate the recurrence table —
    // documented as fixture data the same way patientFixture itself is.
    const priorEpisodes: PriorEpisode[] = [
      { date: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000), entryPath: 'adhoc', disposition: 'routine' },
      { date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), entryPath: 'alert', disposition: 'escalate' },
    ];

    const data: CanonicalReportData = {
      patientName: patientFixture.name,
      dateOfBirth: MOCK_PATIENT_DOB,
      clinicReference: MOCK_CLINIC_REFERENCE,
      edd: eddForGestationWeeks(patientFixture.gestationWeeks, now),
      bookedUnitName: patientFixture.bookedUnit.name,
      clinicName: patientFixture.clinic.name,
      contactedAt: now,
      entryPath: session.entryPath,
      disposition: session.disposition ?? disposition(session.entryPath, session.redFlagAnswers),
      triageContact: session.triageContactShown ?? getTriageContact(now, patientFixture),
      // Category/follow-up fixture content (clinicalRedFlags.ts) — the
      // real answers she'd have actually given to the flat questionnaire
      // (session.redFlagAnswers) are a different shape and not what this
      // demo path renders; see the Phase 4 plan for why.
      redFlags: toRedFlagEntries(redFlagCategories, demoRedFlagAnswers),
      freeTextRaw: session.freeTextDescription,
      // No live extraction call here — honestly null rather than faking
      // structured output the mock never actually produced.
      structured: null,
      movementBins: recentBins,
      baseline,
      onboardingHistory: EMPTY_ONBOARDING_ANSWERS,
      priorEpisodes,
      reportGeneratedAt: this.now(),
    };

    await this.audit('canonical_report_built', { sessionId });
    return buildCanonicalReportPdfBlob(data);
  }

  async audit(event: string, detail: Record<string, unknown> = {}): Promise<void> {
    this.auditLog.push({ at: this.now(), event, detail });
  }

  async getAuditLog(): Promise<ReadonlyArray<AuditEvent>> {
    return this.auditLog;
  }
}
