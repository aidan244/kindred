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
import { redFlagCategories, REPORT_DISCLAIMER } from '../../data/clinicalContent';
import type {
  ActivitySample,
  ClinicHours,
  KickSample,
  KickWindow,
  OnboardingAnswers,
  Patient,
  CategoryAnswer,
  ReportData,
} from '../../types';
import type { Baseline, DetectorFiring, MovementBin } from '../movement/types.ts';
import { buildCanonicalReportPdfBlob } from '../report/pdf.ts';
import type {
  CanonicalReportData,
  PriorEpisode,
  RedFlagEntry,
  StructuredDescription,
} from '../report/types.ts';
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
  date_of_birth: string;
  clinic_reference: string | null;
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

interface KickIntervalRow {
  interval_start: string;
  kicks: number;
}

interface RedFlagAnswerFullRow {
  question_id: string;
  question_text: string;
  answer: boolean;
  detail: string | null;
}

interface SelfReportFullRow {
  raw_text: string;
  structured: unknown;
}

interface PriorSessionRow {
  started_at: string;
  entry_path: 'alert' | 'adhoc';
  disposition: 'escalate' | 'routine' | null;
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

/** Maps up to 7 daily kick_intervals rows (queried newest-first, per
 * kick_intervals_recent's own index order) into a KickWindow, oldest-first —
 * the same contract src/sensors/MovementStream.ts's kickWindow() helper
 * uses: the last bucket is always the still-forming one, so settledIndex is
 * one behind it, never the true last index. Empty input means no rows exist
 * yet for this patient, not an error — the report prints an absence
 * statement in place of the graph rather than a flat line at zero. */
export function dailyKickRowsToWindow(rows: KickIntervalRow[]): KickWindow {
  if (rows.length === 0) {
    return { samples: [], settledIndex: -1 };
  }
  const samples: KickSample[] = rows
    .slice()
    .reverse()
    .map((row) => ({ timestamp: new Date(row.interval_start), kicks: row.kicks }));
  return { samples, settledIndex: Math.max(0, samples.length - 2) };
}

/** The denormalised question_text is used here, not a fresh lookup against
 * redFlagQuestions — accurate even after the live question set changes,
 * per the same reasoning saveRedFlagAnswers denormalises it at write time. */
export function redFlagAnswerRowsToEntries(rows: RedFlagAnswerFullRow[]): RedFlagEntry[] {
  return rows.map((row) => ({
    question: row.question_text,
    answer: row.answer ? 'yes' : 'no',
    detail: row.detail ?? undefined,
  }));
}

/** Maps the structure-free-text edge function's stored JSON output
 * (self_reports.structured) into the report's StructuredDescription —
 * returns null for anything that isn't shaped as expected, rather than
 * throwing, since a real session may predate this feature or the call may
 * have failed silently to the scripted fallback. */
export function structuredFromRow(raw: unknown): StructuredDescription | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Partial<{
    perceivedMovement: StructuredDescription['perceivedMovement'];
    character: string[];
    timeWindow: { start: string; end: string; confidence: 'stated' | 'inferred' } | null;
    additionalSymptoms: string[];
    verbatimHighlights: string[];
  }>;
  return {
    perceivedMovement: value.perceivedMovement ?? null,
    character: value.character ?? [],
    timeWindow: value.timeWindow
      ? {
          start: new Date(value.timeWindow.start),
          end: new Date(value.timeWindow.end),
          confidence: value.timeWindow.confidence,
        }
      : null,
    additionalSymptoms: value.additionalSymptoms ?? [],
    verbatimHighlights: value.verbatimHighlights ?? [],
  };
}

export function priorSessionRowsToEpisodes(rows: PriorSessionRow[]): PriorEpisode[] {
  return rows.map((row) => ({
    date: new Date(row.started_at),
    entryPath: row.entry_path,
    disposition: row.disposition,
  }));
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
    // The `red_flag_answers` table stores ONE BOOLEAN PER QUESTION, which is
    // the flat model the frontend has since replaced with categories and
    // their follow-ups. A row therefore maps to a CategoryAnswer with its
    // gate set and `followUpAnswers` empty.
    //
    // THAT IS LOSSY, AND THE SCHEMA IS WHY. Nothing about the mapping loses
    // information the database holds — it holds no follow-ups to lose. But a
    // report rebuilt from Supabase will be thinner than the one assembled in
    // the app, and the fix is a schema change, not a mapper change. Flagged
    // rather than papered over.
    redFlagAnswers: answerRows.map((a): CategoryAnswer => ({
      categoryId: a.question_id,
      gateAnswer: a.answer ? 'yes' : 'no',
      followUpAnswers: [],
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

  async saveRedFlagAnswers(sessionId: SessionId, answers: CategoryAnswer[]): Promise<Session> {
    const rows = answers.map((answer) => {
      const category = redFlagCategories.find((c) => c.id === answer.categoryId);
      return {
        session_id: sessionId,
        question_id: answer.categoryId,
        // Denormalised at write time so the stored row stays accurate even
        // after the live question set changes.
        question_text: category?.gateQuestion ?? answer.categoryId,
        answer: answer.gateAnswer === 'yes',
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

  /** Exists so this class satisfies the same HeldBackend interface as
   * MockBackend's demo-driven fireDetectorAlert() — real firings for this
   * rule are written by a service-role job (a future kick-aware sibling of
   * supabase/functions/run-detector), not this method. See fireAlert()'s
   * own doc comment for the identical reasoning. */
  async fireDetectorAlert(firing: DetectorFiring): Promise<Alert> {
    const { data, error } = await this.client
      .from('alerts')
      .insert({
        patient_id: this.patientId,
        detector_version: firing.detectorVersion,
        rule: firing.rule,
        window_from: firing.windowFrom.toISOString(),
        window_to: firing.windowTo.toISOString(),
        coverage_fraction: firing.coverageFraction,
        observed: firing.observed,
        expected: firing.expected,
        threshold: firing.threshold,
      })
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `fireDetectorAlert failed (${error?.message ?? 'no row returned'}). This is expected under ` +
          "RLS for a patient-role client — see this method's doc comment."
      );
    }
    await this.audit('alert_fired', { alertId: data.id, rule: firing.rule });
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

    // kick_intervals (004_kick_intervals.sql) — the 7 most recent daily
    // tallies, same table src/lib/backend/supabaseMovementStream.ts reads
    // for the live screens, queried independently here rather than through
    // that class, matching how recentActivity/activityBaseline above are
    // also raw queries rather than a MovementStream round trip.
    const { data: kickRows, error: kickError } = await this.client
      .from('kick_intervals')
      .select('interval_start, kicks')
      .eq('patient_id', this.patientId)
      .eq('interval_kind', 'day')
      .order('interval_start', { ascending: false })
      .limit(7);
    if (kickError) {
      throw new Error(`buildReportData failed loading kick_intervals: ${kickError.message}`);
    }

    return {
      patientName: patientRow.full_name,
      gestationWeeks: gestationWeeksAt(new Date(patientRow.edd), now),
      entryPath: session.entryPath,
      submittedAt: now,
      categoryAnswers: session.redFlagAnswers,
      endedBeforeAllCategories: redFlagCategories.some(
        (category) => !session.redFlagAnswers.some((a) => a.categoryId === category.id)
      ),
      freeTextVoiceNote: null,
      freeTextDescription: session.freeTextDescription,
      onboardingHistory: patientRow.onboarding_history ?? EMPTY_ONBOARDING_ANSWERS,
      recentActivity: binsToActivitySamples((binRows as MovementBinRow[] | null) ?? []),
      activityBaseline: baselineToOverallFraction((baselineRow as BaselineRow | null) ?? null),
      dailyKicks: dailyKickRowsToWindow((kickRows as KickIntervalRow[] | null) ?? []),
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

  async buildCanonicalReportPdf(sessionId: SessionId): Promise<Blob> {
    const { data: sessionRow, error: sessionError } = await this.client
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (sessionError || !sessionRow) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    const session = sessionRow as SessionRow;
    const now = session.completed_at ? new Date(session.completed_at) : new Date();

    const { data: answerRows } = await this.client
      .from('red_flag_answers')
      .select('question_id, question_text, answer, detail')
      .eq('session_id', sessionId);
    const redFlags = redFlagAnswerRowsToEntries((answerRows as RedFlagAnswerFullRow[] | null) ?? []);

    const { data: selfReportRows } = await this.client
      .from('self_reports')
      .select('raw_text, structured')
      .eq('session_id', sessionId)
      .order('captured_at', { ascending: false })
      .limit(1);
    const latestSelfReport = (selfReportRows as SelfReportFullRow[] | null)?.[0] ?? null;

    const { patientRow, clinicRow } = await this.loadPatientAndClinic();

    // 8 days of history: baseline needs a rolling 7 days, plus the
    // preceding 24h the band actually renders.
    const since = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const { data: binRows, error: binError } = await this.client
      .from('movement_bins')
      .select('t, active_windows, covered_windows')
      .eq('patient_id', this.patientId)
      .gte('t', since.toISOString())
      .lt('t', now.toISOString())
      .order('t', { ascending: true });
    if (binError) {
      throw new Error(`buildCanonicalReportPdf failed loading movement_bins: ${binError.message}`);
    }
    const allBins: MovementBin[] = ((binRows as MovementBinRow[] | null) ?? []).map((row) => ({
      t: new Date(row.t),
      activeWindows: row.active_windows,
      coveredWindows: row.covered_windows,
    }));
    const recentCutoffMs = now.getTime() - 24 * 60 * 60 * 1000;
    const recentBins = allBins.filter((bin) => bin.t.getTime() >= recentCutoffMs);

    const { data: baselineRow } = await this.client
      .from('baselines')
      .select('by_hour')
      .eq('patient_id', this.patientId)
      .maybeSingle();
    const baseline: Baseline | null = baselineRow
      ? {
          computedAt: now,
          daysUsed: 0,
          sufficient: true,
          byHour: (baselineRow as BaselineRow).by_hour,
        }
      : null;

    const { data: priorRows } = await this.client
      .from('sessions')
      .select('started_at, entry_path, disposition')
      .eq('patient_id', this.patientId)
      .not('completed_at', 'is', null)
      .neq('id', sessionId)
      .order('started_at', { ascending: true });
    const priorEpisodes = priorSessionRowsToEpisodes((priorRows as PriorSessionRow[] | null) ?? []);

    const patient = toFrontendPatient(patientRow, clinicRow, now);
    const triageContact = session.triage_contact_shown ?? getTriageContact(now, patient);
    const answersForDisposition: CategoryAnswer[] = ((answerRows as RedFlagAnswerFullRow[] | null) ?? []).map(
      (row) => ({
        categoryId: row.question_id,
        gateAnswer: row.answer ? 'yes' : 'no',
        followUpAnswers: [],
        detail: row.detail ?? undefined,
      })
    );
    const dispositionValue: 'escalate' | 'routine' =
      session.disposition ?? disposition(session.entry_path, answersForDisposition);

    const data: CanonicalReportData = {
      patientName: patientRow.full_name,
      dateOfBirth: new Date(patientRow.date_of_birth),
      clinicReference: patientRow.clinic_reference,
      edd: new Date(patientRow.edd),
      bookedUnitName: patientRow.booked_maternity_unit,
      clinicName: clinicRow.name,
      contactedAt: now,
      entryPath: session.entry_path,
      disposition: dispositionValue,
      triageContact,
      redFlags,
      freeTextRaw: latestSelfReport?.raw_text ?? '',
      structured: structuredFromRow(latestSelfReport?.structured),
      movementBins: recentBins,
      baseline,
      onboardingHistory: patientRow.onboarding_history ?? EMPTY_ONBOARDING_ANSWERS,
      priorEpisodes,
      reportGeneratedAt: new Date(),
    };

    await this.audit('canonical_report_built', { sessionId });
    return buildCanonicalReportPdfBlob(data);
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
