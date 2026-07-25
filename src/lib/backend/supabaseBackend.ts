/**
 * HeldBackend implementation over Supabase. Selected by factory.ts when
 * VITE_BACKEND=supabase.
 *
 * Two reconciliations worth reading before touching this file:
 *
 * 1. `getTriageContact` (src/logic/triageContact.ts) takes the frontend's
 *    `Patient` shape, whose `ClinicHours` is a single opens/closes pair —
 *    the DB's `clinics.opening_hours` is a richer per-day-of-week jsonb
 *    map. `clinicHoursForDay` collapses today's entry down to that single
 *    pair rather than changing the pure function's signature.
 *
 * 2. `ActivitySample` (src/types.ts) is `{ timestamp, moved }` with no
 *    coverage field. `binsToActivitySamples` drops uncovered
 *    (`covered_windows = 0`) bins entirely rather than reporting them as
 *    `moved: false` — an absent sample is honest; a false negative is not
 *    (clinical safety rule 4).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { disposition } from '../../logic/disposition';
import { getTriageContact } from '../../logic/triageContact';
import { redFlagQuestions, REPORT_DISCLAIMER } from '../../data/clinicalContent';
import type {
  ActivitySample,
  ClinicHours,
  OnboardingAnswers,
  Patient,
  RedFlagAnswer,
  ReportData,
} from '../../types';
import type { HeldBackend } from './HeldBackend';
import type {
  Alert,
  AlertId,
  AlertOutcome,
  ReportId,
  ReportRecord,
  Session,
  SessionEntryPath,
  SessionId,
} from './types';

const EMPTY_ONBOARDING_ANSWERS: OnboardingAnswers = {
  weeksPregnant: null,
  extraMonitoring: { answer: null, detail: '' },
  history: { selected: [], detail: '' },
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const CLOSED_ALL_DAY: [string, string] = ['00:00', '00:00'];

// ---------------------------------------------------------------------------
// Row shapes (loose — this file has no generated Supabase types to lean on)
// ---------------------------------------------------------------------------

interface PatientRow {
  id: string;
  full_name: string;
  edd: string;
  clinic_id: string;
  booked_maternity_unit: string;
  booked_unit_phone: string;
  onboarding_history: OnboardingAnswers | null;
}

interface ClinicRow {
  id: string;
  name: string;
  triage_phone: string;
  opening_hours: Record<string, [string, string] | null>;
}

interface SessionRow {
  id: string;
  entry_path: 'alert' | 'adhoc';
  alert_id: string | null;
  started_at: string;
  completed_at: string | null;
  disposition: 'escalate' | 'routine' | null;
  triage_contact_shown: Session['triageContactShown'] | null;
}

interface RedFlagAnswerRow {
  question_id: string;
  answer: boolean;
  detail: string | null;
}

interface SelfReportRow {
  raw_text: string;
}

interface AlertRow {
  id: string;
  fired_at: string;
  outcome: AlertOutcome | null;
}

interface ReportRow {
  id: string;
  session_id: string;
  generated_at: string;
  delivery_status: ReportRecord['deliveryStatus'];
  delivery_attempts: number;
  delivered_at: string | null;
}

interface MovementBinRow {
  t: string;
  active_windows: number;
  covered_windows: number;
}

interface BaselineRow {
  by_hour: Array<{ hour: number; expectedActiveFraction: number; coverageFraction: number }>;
}

// ---------------------------------------------------------------------------
// Pure helpers — unit-testable without a Supabase connection
// ---------------------------------------------------------------------------

/** Gestation in whole weeks at `now`, derived from her EDD rather than
 * stored (a stored figure would go stale the moment it's written). Full
 * term is treated as 40 weeks. */
export function gestationWeeksAt(edd: Date, now: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.round((edd.getTime() - now.getTime()) / msPerDay);
  const gestationDays = 280 - daysUntilDue;
  return Math.max(0, Math.floor(gestationDays / 7));
}

/** Collapses the DB's per-day opening_hours map down to the single
 * opens/closes pair getTriageContact() expects, for whichever day `now`
 * falls on. A null day entry (closed all day) maps to opens=closes=00:00,
 * which src/logic/triageContact.ts's isWithinClinicHours already treats as
 * "never open" — its own documented fail-safe for a degenerate window. */
export function clinicHoursForDay(
  openingHours: Record<string, [string, string] | null>,
  now: Date
): ClinicHours {
  const dayKey = DAY_KEYS[now.getDay()];
  const [opens, closes] = openingHours[dayKey] ?? CLOSED_ALL_DAY;
  return { opens, closes, daysDescription: dayKey };
}

/** Drops uncovered bins entirely rather than reporting them as
 * moved:false — see file header, reconciliation 2. */
export function binsToActivitySamples(bins: MovementBinRow[]): ActivitySample[] {
  return bins
    .filter((bin) => bin.covered_windows > 0)
    .map((bin) => ({ timestamp: new Date(bin.t), moved: bin.active_windows > 0 }));
}

/** Collapses a Baseline's 24 hourly entries into the single number
 * ReportData.activityBaseline expects, weighting only hours with any
 * coverage. Returns 0 when nothing is covered rather than throwing. */
export function baselineToOverallFraction(baseline: BaselineRow | null): number {
  if (!baseline) {
    return 0;
  }
  const usable = baseline.by_hour.filter((entry) => entry.coverageFraction > 0);
  if (usable.length === 0) {
    return 0;
  }
  const sum = usable.reduce((total, entry) => total + entry.expectedActiveFraction, 0);
  return sum / usable.length;
}

export function sessionFromRow(
  row: SessionRow,
  answerRows: RedFlagAnswerRow[] = [],
  selfReportRow: SelfReportRow | null = null
): Session {
  return {
    id: row.id,
    entryPath: row.entry_path,
    alertId: row.alert_id,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    redFlagAnswers: answerRows.map((a): RedFlagAnswer => ({
      questionId: a.question_id,
      answer: a.answer ? 'yes' : 'no',
      detail: a.detail ?? undefined,
    })),
    freeTextDescription: selfReportRow?.raw_text ?? '',
    disposition: row.disposition,
    triageContactShown: row.triage_contact_shown,
  };
}

export function alertFromRow(row: AlertRow): Alert {
  return { id: row.id, firedAt: new Date(row.fired_at), outcome: row.outcome };
}

export function reportFromRow(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    generatedAt: new Date(row.generated_at),
    deliveryStatus: row.delivery_status,
    deliveryAttempts: row.delivery_attempts,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : null,
  };
}

function toFrontendPatient(patientRow: PatientRow, clinicRow: ClinicRow, now: Date): Patient {
  return {
    name: patientRow.full_name,
    gestationWeeks: gestationWeeksAt(new Date(patientRow.edd), now),
    clinic: {
      name: clinicRow.name,
      triagePhoneNumber: clinicRow.triage_phone,
      hours: clinicHoursForDay(clinicRow.opening_hours, now),
    },
    bookedUnit: {
      name: patientRow.booked_maternity_unit,
      triagePhoneNumber: patientRow.booked_unit_phone,
    },
  };
}

// ---------------------------------------------------------------------------
// SupabaseBackend
// ---------------------------------------------------------------------------

export class SupabaseBackend implements HeldBackend {
  private constructor(
    private readonly client: SupabaseClient,
    private readonly patientId: string
  ) {}

  /**
   * Resolves the current patient from the authenticated Supabase session.
   * Throws if there is no session, or no `patients` row for it — this
   * frontend has no login screen yet, so that's a real gap, not an edge
   * case to paper over.
   */
  static async create(client: SupabaseClient): Promise<SupabaseBackend> {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      throw new Error(
        'SupabaseBackend requires an authenticated Supabase session, and none was found. ' +
          'The frontend does not have a login flow yet — see the Phase 3 plan\'s "auth gap" note.'
      );
    }

    const { data: patientRow, error: patientError } = await client
      .from('patients')
      .select('id')
      .eq('auth_user_id', userData.user.id)
      .single();
    if (patientError || !patientRow) {
      throw new Error(`No patients row found for authenticated user ${userData.user.id}.`);
    }

    return new SupabaseBackend(client, (patientRow as { id: string }).id);
  }

  private async loadPatientAndClinic(): Promise<{ patientRow: PatientRow; clinicRow: ClinicRow }> {
    const { data, error } = await this.client
      .from('patients')
      .select('*, clinics(*)')
      .eq('id', this.patientId)
      .single();
    if (error || !data) {
      throw new Error(`Failed to load patient ${this.patientId}: ${error?.message}`);
    }
    const { clinics, ...patientRow } = data as PatientRow & { clinics: ClinicRow };
    return { patientRow: patientRow as PatientRow, clinicRow: clinics };
  }

  async createSession(entryPath: SessionEntryPath, alertId?: AlertId): Promise<Session> {
    const { data, error } = await this.client
      .from('sessions')
      .insert({ patient_id: this.patientId, entry_path: entryPath, alert_id: alertId ?? null })
      .select()
      .single();
    if (error || !data) {
      throw new Error(`createSession failed: ${error?.message}`);
    }
    if (alertId) {
      await this.client.from('alerts').update({ outcome: 'session_started' }).eq('id', alertId);
    }
    await this.audit('session_created', { sessionId: data.id, entryPath });
    return sessionFromRow(data as SessionRow);
  }

  async saveRedFlagAnswers(sessionId: SessionId, answers: RedFlagAnswer[]): Promise<Session> {
    const rows = answers.map((answer) => {
      const question = redFlagQuestions.find((q) => q.id === answer.questionId);
      return {
        session_id: sessionId,
        question_id: answer.questionId,
        question_text: question?.question ?? answer.questionId,
        answer: answer.answer === 'yes',
        detail: answer.detail ?? null,
      };
    });
    const { error } = await this.client
      .from('red_flag_answers')
      .upsert(rows, { onConflict: 'session_id,question_id' });
    if (error) {
      throw new Error(`saveRedFlagAnswers failed: ${error.message}`);
    }
    await this.audit('red_flag_answers_saved', { sessionId, count: answers.length });
    return this.getSession(sessionId);
  }

  async saveSelfReport(sessionId: SessionId, freeTextDescription: string): Promise<Session> {
    const { error } = await this.client
      .from('self_reports')
      .insert({ session_id: sessionId, raw_text: freeTextDescription, input_mode: 'text' });
    if (error) {
      throw new Error(`saveSelfReport failed: ${error.message}`);
    }
    await this.audit('self_report_saved', { sessionId });
    return this.getSession(sessionId);
  }

  async completeSession(sessionId: SessionId): Promise<Session> {
    const session = await this.getSession(sessionId);
    const outcome = disposition(session.entryPath, session.redFlagAnswers);

    const now = new Date();
    const { patientRow, clinicRow } = await this.loadPatientAndClinic();
    const patient = toFrontendPatient(patientRow, clinicRow, now);
    const triageContactShown = getTriageContact(now, patient);

    const { data, error } = await this.client
      .from('sessions')
      .update({
        completed_at: now.toISOString(),
        disposition: outcome,
        triage_contact_shown: triageContactShown,
      })
      .eq('id', sessionId)
      .select()
      .single();
    if (error || !data) {
      throw new Error(`completeSession failed: ${error?.message}`);
    }
    await this.audit('session_completed', { sessionId, disposition: outcome });
    return sessionFromRow(data as SessionRow, [], null);
  }

  async getSession(sessionId: SessionId): Promise<Session> {
    const { data: sessionRow, error } = await this.client
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (error || !sessionRow) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    const { data: answerRows } = await this.client
      .from('red_flag_answers')
      .select('*')
      .eq('session_id', sessionId);
    const { data: selfReportRows } = await this.client
      .from('self_reports')
      .select('raw_text')
      .eq('session_id', sessionId)
      .order('captured_at', { ascending: false })
      .limit(1);
    return sessionFromRow(
      sessionRow as SessionRow,
      (answerRows as RedFlagAnswerRow[] | null) ?? [],
      (selfReportRows as SelfReportRow[] | null)?.[0] ?? null
    );
  }

  /**
   * Expected to fail under RLS for a patient-role client — 003_rls.sql
   * grants the patient role no insert policy on `alerts`. A real alert is
   * only ever inserted by supabase/functions/run-detector using the
   * service role key. This method exists so SupabaseBackend satisfies the
   * same interface as MockBackend's demo-panel-triggered fireAlert(); it
   * is not a real production entry point.
   */
  async fireAlert(): Promise<Alert> {
    const { data, error } = await this.client
      .from('alerts')
      .insert({ patient_id: this.patientId, detector_version: 'manual-demo', rule: 'manual_demo' })
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `fireAlert failed (${error?.message ?? 'no row returned'}). This is expected under RLS for ` +
          'a patient-role client — see this method\'s doc comment.'
      );
    }
    await this.audit('alert_fired', { alertId: data.id });
    return alertFromRow(data as AlertRow);
  }

  async getPendingAlert(): Promise<Alert | null> {
    const { data, error } = await this.client
      .from('alerts')
      .select('*')
      .eq('patient_id', this.patientId)
      .is('outcome', null)
      .order('fired_at', { ascending: false })
      .limit(1);
    if (error) {
      throw new Error(`getPendingAlert failed: ${error.message}`);
    }
    const rows = (data as AlertRow[] | null) ?? [];
    return rows.length > 0 ? alertFromRow(rows[0]) : null;
  }

  async acknowledgeAlert(alertId: AlertId, outcome: AlertOutcome): Promise<void> {
    const { error } = await this.client
      .from('alerts')
      .update({ outcome, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) {
      throw new Error(`acknowledgeAlert failed: ${error.message}`);
    }
    await this.audit('alert_acknowledged', { alertId, outcome });
  }

  async buildReportData(sessionId: SessionId): Promise<ReportData> {
    const session = await this.getSession(sessionId);
    const now = session.completedAt ?? new Date();
    const { patientRow } = await this.loadPatientAndClinic();

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: binRows, error: binError } = await this.client
      .from('movement_bins')
      .select('*')
      .eq('patient_id', this.patientId)
      .gte('t', since.toISOString())
      .lt('t', now.toISOString())
      .order('t', { ascending: true });
    if (binError) {
      throw new Error(`buildReportData failed loading movement_bins: ${binError.message}`);
    }

    const { data: baselineRow } = await this.client
      .from('baselines')
      .select('by_hour')
      .eq('patient_id', this.patientId)
      .maybeSingle();

    return {
      patientName: patientRow.full_name,
      gestationWeeks: gestationWeeksAt(new Date(patientRow.edd), now),
      entryPath: session.entryPath,
      submittedAt: now,
      redFlagAnswers: session.redFlagAnswers,
      freeTextDescription: session.freeTextDescription,
      onboardingHistory: patientRow.onboarding_history ?? EMPTY_ONBOARDING_ANSWERS,
      recentActivity: binsToActivitySamples((binRows as MovementBinRow[] | null) ?? []),
      activityBaseline: baselineToOverallFraction((baselineRow as BaselineRow | null) ?? null),
      disclaimer: REPORT_DISCLAIMER,
    };
  }

  async storeReport(sessionId: SessionId, pdf: Blob): Promise<ReportRecord> {
    const reportId = crypto.randomUUID();
    const storagePath = `reports/${this.patientId}/${reportId}.pdf`;

    const { error: uploadError } = await this.client.storage
      .from('reports')
      .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true });
    if (uploadError) {
      throw new Error(`storeReport upload failed: ${uploadError.message}`);
    }

    // delivery_status stays 'pending' rather than 'sent' — no delivery
    // transport (transactional email / PMS write, Tier 1 #4 in
    // held-backend-integrations.md) exists yet. A silently-failed report is
    // the worst failure mode in the whole system; a truthfully 'pending'
    // one is at least visible and queryable.
    const { data, error } = await this.client
      .from('reports')
      .upsert(
        { id: reportId, session_id: sessionId, storage_path: storagePath, delivery_status: 'pending', delivery_attempts: 0 },
        { onConflict: 'session_id' }
      )
      .select()
      .single();
    if (error || !data) {
      throw new Error(`storeReport insert failed: ${error?.message}`);
    }

    await this.audit('report_stored', { sessionId, reportId: data.id, sizeBytes: pdf.size });
    return reportFromRow(data as ReportRow);
  }

  async getReport(reportId: ReportId): Promise<ReportRecord> {
    const { data, error } = await this.client.from('reports').select('*').eq('id', reportId).single();
    if (error || !data) {
      throw new Error(`Unknown report: ${reportId}`);
    }
    return reportFromRow(data as ReportRow);
  }

  async audit(event: string, detail: Record<string, unknown> = {}): Promise<void> {
    const { error } = await this.client
      .from('audit_log')
      .insert({ patient_id: this.patientId, event, detail });
    if (error) {
      // Audit logging must never break the primary flow it's observing —
      // fail open (log, don't throw), the same posture as best-effort
      // telemetry rather than a transactional guarantee.
      console.error('audit() insert failed', error);
    }
  }

  async getAuditLog(): Promise<
    ReadonlyArray<{ at: Date; event: string; detail: Record<string, unknown> }>
  > {
    // No select policy is granted on audit_log for the patient role, by
    // design (003_rls.sql) — audit logs aren't user-facing. This will
    // always return empty under real RLS; it exists for interface parity
    // with MockBackend, not as a real read path.
    const { data, error } = await this.client
      .from('audit_log')
      .select('*')
      .eq('patient_id', this.patientId)
      .order('at', { ascending: true });
    if (error) {
      return [];
    }
    return ((data as Array<{ at: string; event: string; detail: Record<string, unknown> }> | null) ?? []).map(
      (row) => ({ at: new Date(row.at), event: row.event, detail: row.detail ?? {} })
    );
  }
}
