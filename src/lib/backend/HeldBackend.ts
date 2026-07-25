/**
 * The backend interface. Two implementations: `mockBackend.ts` (in-memory,
 * deterministic, used for the demo) and a future `supabaseBackend.ts`
 * (Phase 3). Callers import this interface and `getHeldBackend()` from
 * `factory.ts` — never an implementation directly.
 *
 * This is new surface: nothing in the existing frontend calls it yet (see
 * the Phase 1 plan's "No frontend files touched" note). It exists so the
 * persistence, disposition, and report-delivery concerns the backend brief
 * asks for have somewhere to live and can be tested in isolation, ahead of
 * any decision about wiring them into a live screen.
 *
 * `completeSession` deliberately takes no disposition or contact argument.
 * Both are computed inside the implementation by calling the existing,
 * already-tested pure functions (`src/logic/disposition.ts`,
 * `src/logic/triageContact.ts`) against the session's own stored entry path
 * and answers — so there is exactly one place the routing rule is
 * evaluated, and a caller can never pass in a disposition that disagrees
 * with it.
 */

import type { RedFlagAnswer } from '../../types';
import type {
  Alert,
  AlertId,
  AlertOutcome,
  ReportData,
  ReportId,
  ReportRecord,
  Session,
  SessionEntryPath,
  SessionId,
} from './types';

export interface HeldBackend {
  // -- sessions -------------------------------------------------------
  createSession(entryPath: SessionEntryPath, alertId?: AlertId): Promise<Session>;
  saveRedFlagAnswers(sessionId: SessionId, answers: RedFlagAnswer[]): Promise<Session>;
  saveSelfReport(sessionId: SessionId, freeTextDescription: string): Promise<Session>;
  /** Computes disposition and the triage contact she's shown, persists
   * both on the session, and returns it. */
  completeSession(sessionId: SessionId): Promise<Session>;
  getSession(sessionId: SessionId): Promise<Session>;

  // -- alerts -----------------------------------------------------------
  /** Fires a new alert (the mock's equivalent of the wearable's detector
   * firing / the demo panel's "fire push notification"). */
  fireAlert(): Promise<Alert>;
  getPendingAlert(): Promise<Alert | null>;
  acknowledgeAlert(alertId: AlertId, outcome: AlertOutcome): Promise<void>;

  // -- reports ------------------------------------------------------------
  /** Assembles the same ReportData shape the frontend's own
   * src/screens/reportAssembly.ts produces, from a persisted session
   * rather than live app state. */
  buildReportData(sessionId: SessionId): Promise<ReportData>;
  storeReport(sessionId: SessionId, pdf: Blob): Promise<ReportRecord>;
  getReport(reportId: ReportId): Promise<ReportRecord>;
  /** Builds the richer, SBAR-structured clinical PDF (src/lib/report/*) —
   * the clinic's canonical copy, not the frontend's own instant local
   * download (src/logic/reportPdf.ts, unchanged). See the Phase 4 plan for
   * why those are deliberately two different documents. Not wired into
   * `storeReport` — a new, additional capability, not a replacement. */
  buildCanonicalReportPdf(sessionId: SessionId): Promise<Blob>;

  // -- audit ------------------------------------------------------------
  audit(event: string, detail?: Record<string, unknown>): Promise<void>;
  getAuditLog(): Promise<ReadonlyArray<{ at: Date; event: string; detail: Record<string, unknown> }>>;
}
