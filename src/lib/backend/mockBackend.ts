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

import type { ActivityVariant, OnboardingAnswers, RedFlagAnswer } from '../../types';
import { patientFixture, REPORT_DISCLAIMER } from '../../data/clinicalContent';
import { disposition } from '../../logic/disposition';
import { getTriageContact } from '../../logic/triageContact';
import { getMovementStream } from '../../sensors/MovementStream';
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

  async saveRedFlagAnswers(sessionId: SessionId, answers: RedFlagAnswer[]): Promise<Session> {
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
      redFlagAnswers: session.redFlagAnswers,
      freeTextDescription: session.freeTextDescription,
      onboardingHistory: EMPTY_ONBOARDING_ANSWERS,
      recentActivity: stream.getWindow(24),
      activityBaseline: stream.getBaseline(),
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

  async audit(event: string, detail: Record<string, unknown> = {}): Promise<void> {
    this.auditLog.push({ at: this.now(), event, detail });
  }

  async getAuditLog(): Promise<ReadonlyArray<AuditEvent>> {
    return this.auditLog;
  }
}
