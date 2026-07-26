/**
 * Backend-only types — new persistence concepts (Session, Alert, stored
 * reports, audit events) that don't exist anywhere in the frontend today.
 *
 * These import and reuse the frontend's existing shapes (src/types.ts)
 * rather than redefining them. If a shape already exists there, it is
 * imported here, never forked.
 */

import type {
  ActivityVariant,
  EntryPath,
  CategoryAnswer,
  ReportData,
  TriageContact,
} from '../../types';

export type SessionId = string;
export type AlertId = string;
export type ReportId = string;

/**
 * A session's entry path is fixed at creation and, unlike the frontend's
 * `EntryPath`, is never null — a session only exists once she has actually
 * started one, via either path.
 */
export type SessionEntryPath = Exclude<EntryPath, null>;

export type Disposition = 'escalate' | 'routine';

export type AlertOutcome =
  | 'session_started'
  | 'dismissed'
  | 'unacknowledged'
  | 'unacknowledged_out_of_hours';

export interface Alert {
  id: AlertId;
  firedAt: Date;
  /** Null until the alert is acted on one way or another. */
  outcome: AlertOutcome | null;
}

export interface Session {
  id: SessionId;
  entryPath: SessionEntryPath;
  /** Which alert (if any) this session was entered from. The path can only
   * escalate, never de-escalate, so this is set once at creation and never
   * cleared. */
  alertId: AlertId | null;
  startedAt: Date;
  completedAt: Date | null;
  /**
   * Her red-flag answers, in the frontend's own shape.
   *
   * This was `RedFlagAnswer[]` — a flat {questionId, answer} model the
   * frontend replaced with the six-category one (`CategoryAnswer`, a gate
   * answer plus its follow-ups) before this backend was written. The two
   * drifted apart silently: `disposition()` already took `CategoryAnswer[]`,
   * so the old type could not have been passed to it without a cast.
   * CLAUDE.md's rule applies — reuse `src/types.ts` rather than keep a
   * parallel shape.
   */
  redFlagAnswers: CategoryAnswer[];
  freeTextDescription: string;
  /** Set by completeSession(), computed from disposition() — never provided
   * by a caller, so there is exactly one place the rule is evaluated. */
  disposition: Disposition | null;
  /** Exactly what she was shown, resolved by getTriageContact() at
   * completion time — the audit record of which number she actually saw. */
  triageContactShown: TriageContact | null;
}

export interface ReportRecord {
  id: ReportId;
  sessionId: SessionId;
  generatedAt: Date;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'acknowledged';
  deliveryAttempts: number;
  deliveredAt: Date | null;
}

export interface AuditEvent {
  at: Date;
  event: string;
  detail: Record<string, unknown>;
}

/** Re-exported for convenience so backend modules have one import surface. */
export type { ActivityVariant, ReportData };
