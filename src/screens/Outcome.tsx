/**
 * The outcome screen (/outcome) — one screen, two states, chosen by
 * `disposition(entryPath, categoryAnswers)`:
 *
 *  - escalate: leads with a single instruction to call. Which number is
 *    primary now further depends on `getEscalationTier` (held-build-brief.md
 *    placeholder_content, "Escalation tier"):
 *      - emergency tier: 999 is primary (EMERGENCY_TIER_CONTACT below), the
 *        maternity/clinic triage contact moves below the fold as the quiet
 *        secondary route.
 *      - triage tier: exactly today's behaviour — `getTriageContact()` is
 *        primary, 999 is the quiet secondary route.
 *    Only the number and framing change between tiers, nothing else (the
 *    brief's words) — same screen, same layout, same copy elsewhere.
 *  - routine: states what was sent, to which clinic, when, and sets an
 *    honest expectation for a response based on the clinic's actual hours,
 *    never implying someone is reading it if the clinic is closed.
 *
 * Both states offer the same report download, and a report has already gone
 * to the clinic in the background in both cases (rule 4e) — this screen
 * never makes her wait for that.
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { DownloadSimple, PhoneCall } from '@phosphor-icons/react';
import { useAppState } from '../context/AppStateContext';
import {
  BLEEDING_CATEGORY_ID,
  BLEEDING_EMERGENCY_NOTE,
  EMERGENCY_ADD_MORE_LABEL,
  patientFixture,
} from '../data/clinicalContent';
import { disposition } from '../logic/disposition';
import { getEscalationTier } from '../logic/escalationTier';
import { getTriageContact } from '../logic/triageContact';
import { downloadReportPdf } from '../logic/reportPdf';
import { EmergencyCall } from '../components/EmergencyCall';
import { assembleReportData, formatClock, isClinicOpenAt } from './reportAssembly';
import type { CategoryAnswer, TriageContact, VoiceNote } from '../types';

interface OutcomeSnapshot {
  entryPath: 'alert' | 'adhoc';
  categoryAnswers: CategoryAnswer[];
  triageDescription: string;
  triageVoiceNote: VoiceNote | null;
  hardStopEndedEarly: boolean;
}

/** The emergency tier's primary contact — 999, framed as a call, never
 * "attend" and never "A&E" (rules 4b/4d). This is the one place in the
 * product a `TriageContact` is built by hand rather than resolved by
 * `getTriageContact()`, which never returns 999 by design (see that
 * function's header comment). */
const EMERGENCY_TIER_CONTACT: TriageContact = {
  label: 'emergency services',
  number: '999',
  reason: 'Call 999 now.',
  kind: 'emergency',
};

function bleedingSecondaryNote(answers: CategoryAnswer[]): string | undefined {
  const flagged = answers.some((a) => a.categoryId === BLEEDING_CATEGORY_ID && a.gateAnswer === 'yes');
  return flagged ? BLEEDING_EMERGENCY_NOTE : undefined;
}

function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

export default function Outcome(): ReactElement {
  const {
    now,
    entryPath,
    setEntryPath,
    setAlertActive,
    categoryAnswers,
    triageDescription,
    triageVoiceNote,
    onboardingAnswers,
    activityVariant,
    reportSubmission,
  } = useAppState();
  const navigate = useNavigate();

  // What this outcome is about, captured once on arrival. entryPath and
  // alertActive are cleared right below so a fresh Check-in press is
  // correct the instant she's back on a resting screen — but this screen
  // still needs the values that produced it for as long as she's on it.
  const [snapshot] = useState<OutcomeSnapshot>(() => ({
    entryPath: entryPath ?? 'adhoc',
    categoryAnswers,
    triageDescription,
    triageVoiceNote,
    hardStopEndedEarly: reportSubmission.hardStopEndedEarly,
  }));

  useEffect(() => {
    setEntryPath(null);
    setAlertActive(false);
    // Client-side navigation doesn't reset scroll position on its own, and
    // this screen's escalate state leads with a single call instruction —
    // it must be the first thing she sees, never something she has to
    // scroll up to find because the previous screen left off part-way down.
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const result = disposition(snapshot.entryPath, snapshot.categoryAnswers);
  const tier = result === 'escalate' ? getEscalationTier(snapshot.categoryAnswers) : null;
  const contact = getTriageContact(now(), patientFixture);
  const clinic = patientFixture.clinic;
  const clinicOpen = isClinicOpenAt(now(), clinic.hours);
  const submittedAt = reportSubmission.submittedAt ?? now();

  const report = assembleReportData({
    patientName: patientFixture.name,
    gestationWeeks: patientFixture.gestationWeeks,
    entryPath: snapshot.entryPath,
    submittedAt,
    categoryAnswers: snapshot.categoryAnswers,
    hardStopEndedEarly: snapshot.hardStopEndedEarly,
    freeTextDescription: snapshot.triageDescription,
    freeTextVoiceNote: snapshot.triageVoiceNote,
    onboardingHistory: onboardingAnswers,
    activityVariant,
  });

  const handleDownload = (): void => downloadReportPdf(report);

  const handleAddMore = (): void => {
    navigate('/triage', { state: { continueAfterHardStop: true } });
  };

  // NOTE ON WHAT USED TO BE HERE: this screen previously cleared
  // categoryAnswers/triageDescription/triageVoiceNote (and revoked their
  // voice-note URLs) in a mount-effect cleanup, on the theory that "a fresh
  // check-in should never inherit a previous one's answers". That cleanup
  // fires on unmount — including the extra, synthetic mount+cleanup+remount
  // React's StrictMode performs immediately after every component's FIRST
  // real mount in development, specifically to surface exactly this kind of
  // bug. Because that synthetic cleanup runs before she has done anything
  // at all, it was silently clearing the live context state — invisibly,
  // because this screen only ever renders from the `snapshot` captured at
  // mount, never from the live values — until "Add more detail for your
  // clinic" needed those live values to still be there after navigating
  // back to /triage, which is what surfaced it. TriageFlow.tsx's own
  // fresh-entry reset (in its mount effect) already guards against
  // inheriting a previous submission's answers, unconditionally, so this
  // screen no longer needs to do it too — see that effect for where the
  // voice-note revocation now happens instead.

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] px-6">
      <div className="dock-safe pt-8">
        {result === 'escalate' ? (
          tier === 'emergency' ? (
            <EscalateOutcome
              contact={EMERGENCY_TIER_CONTACT}
              secondaryContact={contact}
              onDownload={handleDownload}
              onAddMore={handleAddMore}
            />
          ) : (
            <EscalateOutcome
              contact={contact}
              secondaryNote={bleedingSecondaryNote(snapshot.categoryAnswers)}
              onDownload={handleDownload}
            />
          )
        ) : (
          <RoutineOutcome
            contact={contact}
            clinicName={clinic.name}
            clinicOpen={clinicOpen}
            clinicOpensAt={clinic.hours.opens}
            submittedAt={submittedAt}
            onDownload={handleDownload}
          />
        )}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-24"
        style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }}
      />
    </div>
  );
}

interface EscalateOutcomeProps {
  contact: TriageContact;
  secondaryNote?: string;
  secondaryContact?: TriageContact;
  onDownload: () => void;
  /** Only present for the emergency tier — the quiet, non-blocking way back
   * into the conversation (design brief: "she can keep adding detail
   * afterward if she wants"). Never gates the number above it, and never
   * changes it: no-downgrade means nothing she adds can move her out of the
   * emergency tier. */
  onAddMore?: () => void;
}

function EscalateOutcome({
  contact,
  secondaryNote,
  secondaryContact,
  onDownload,
  onAddMore,
}: EscalateOutcomeProps): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title">Call now</h1>
        <p className="text-body text-text-muted">{contact.reason}</p>
      </div>

      <EmergencyCall
        contact={contact}
        prominence="lead"
        secondaryNote={secondaryNote}
        secondaryContact={secondaryContact}
      />

      <button
        type="button"
        onClick={onDownload}
        className="tap flex w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface px-6 text-label text-text"
      >
        <DownloadSimple size={22} weight="light" aria-hidden="true" />
        Download your report to bring with you
      </button>

      <p className="text-caption text-text-muted">
        Your clinic has also received a copy of this report.
      </p>

      {onAddMore && (
        <button
          type="button"
          onClick={onAddMore}
          className="tap self-start px-2 text-caption text-accent"
        >
          {EMERGENCY_ADD_MORE_LABEL}
        </button>
      )}
    </div>
  );
}

interface RoutineOutcomeProps {
  contact: TriageContact;
  clinicName: string;
  clinicOpen: boolean;
  clinicOpensAt: string;
  submittedAt: Date;
  onDownload: () => void;
}

interface TimelineStep {
  label: string;
  state: 'complete' | 'active' | 'pending';
  note?: string;
}

function RoutineOutcome({
  contact,
  clinicName,
  clinicOpen,
  clinicOpensAt,
  submittedAt,
  onDownload,
}: RoutineOutcomeProps): ReactElement {
  const expectation = clinicOpen
    ? `${clinicName} is open now. Your report is in their queue.`
    : `${clinicName} opens at ${clinicOpensAt}. They'll review it when they're next open.`;

  const timeline: TimelineStep[] = [
    { label: 'Sent', state: 'complete', note: formatClock(submittedAt) },
    { label: 'Received by your clinic', state: 'complete' },
    {
      label: 'Clinician reviewing',
      state: clinicOpen ? 'active' : 'pending',
      note: clinicOpen ? undefined : `From ${clinicOpensAt}`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title">Sent to your clinic</h1>
        <p className="text-lead">
          Sent to {clinicName} at {formatClock(submittedAt)}.
        </p>
      </div>

      <p className="text-body text-text">{expectation}</p>

      <div className="flex flex-col gap-4 rounded-card bg-surface p-[22px]">
        {timeline.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-4">
            <span
              className={`text-label ${item.state === 'pending' ? 'text-text-muted' : 'text-text'}`}
            >
              {item.label}
            </span>
            {item.note && <span className="text-caption text-text-muted">{item.note}</span>}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onDownload}
        className="tap flex w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface px-6 text-label text-text"
      >
        <DownloadSimple size={22} weight="light" aria-hidden="true" />
        Download your report
      </button>

      <p className="text-body text-text">
        If anything changes while you wait, speak to Kindred again or call {contact.label}.
      </p>

      <a
        href={telHref(contact.number)}
        className="tap flex w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface px-6 text-label text-text"
      >
        <PhoneCall size={22} weight="light" aria-hidden="true" />
        Call {contact.label}
      </a>
    </div>
  );
}
