/**
 * The outcome screen (/outcome) — one screen, two states, chosen by
 * `disposition(entryPath, redFlagAnswers)`:
 *
 *  - escalate: leads with a single instruction to call, the number as the
 *    largest interactive element on the screen, the emergency call control
 *    (the only other place `EmergencyCall` — and red — appears, besides the
 *    triage flow).
 *  - routine: states what was sent, to which clinic, when, and sets an
 *    honest expectation for a response based on the clinic's actual hours,
 *    never implying someone is reading it if the clinic is closed.
 *
 * Both states offer the same report download and carry the same triage
 * number from `getTriageContact`, and a report has already gone to the
 * clinic in the background in both cases (rule 7) — this screen never makes
 * her wait for that.
 */

import { useEffect, useState, type ReactElement } from 'react';
import { DownloadSimple, PhoneCall } from '@phosphor-icons/react';
import { useAppState } from '../context/AppStateContext';
import { BLEEDING_EMERGENCY_NOTE, patientFixture } from '../data/clinicalContent';
import { disposition } from '../logic/disposition';
import { getTriageContact } from '../logic/triageContact';
import { downloadReportPdf } from '../logic/reportPdf';
import { EmergencyCall } from '../components/EmergencyCall';
import { assembleReportData, formatClock, isClinicOpenAt } from './reportAssembly';
import type { RedFlagAnswer, TriageContact } from '../types';

interface OutcomeSnapshot {
  entryPath: 'alert' | 'adhoc';
  redFlagAnswers: RedFlagAnswer[];
  triageDescription: string;
}

function bleedingSecondaryNote(answers: RedFlagAnswer[]): string | undefined {
  const flagged = answers.some((a) => a.questionId === 'bleeding-fluid' && a.answer === 'yes');
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
    redFlagAnswers,
    triageDescription,
    setRedFlagAnswers,
    setTriageDescription,
    onboardingAnswers,
    activityVariant,
    reportSubmission,
  } = useAppState();

  // What this outcome is about, captured once on arrival. entryPath and
  // alertActive are cleared right below so a fresh Check-in press is
  // correct the instant she's back on a resting screen — but this screen
  // still needs the values that produced it for as long as she's on it.
  const [snapshot] = useState<OutcomeSnapshot>(() => ({
    entryPath: entryPath ?? 'adhoc',
    redFlagAnswers,
    triageDescription,
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

  // Her answers and description stay available for the report download for
  // as long as she's looking at this screen, and are cleared the moment she
  // leaves it — a fresh check-in should never inherit a previous one's
  // answers.
  useEffect(
    () => () => {
      setRedFlagAnswers([]);
      setTriageDescription('');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const result = disposition(snapshot.entryPath, snapshot.redFlagAnswers);
  const contact = getTriageContact(now(), patientFixture);
  const clinic = patientFixture.clinic;
  const clinicOpen = isClinicOpenAt(now(), clinic.hours);
  const submittedAt = reportSubmission.submittedAt ?? now();

  const report = assembleReportData({
    patientName: patientFixture.name,
    gestationWeeks: patientFixture.gestationWeeks,
    entryPath: snapshot.entryPath,
    submittedAt,
    redFlagAnswers: snapshot.redFlagAnswers,
    freeTextDescription: snapshot.triageDescription,
    onboardingHistory: onboardingAnswers,
    activityVariant,
  });

  const handleDownload = (): void => downloadReportPdf(report);

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-[420px] px-6">
      <div className="dock-safe pt-8">
        {result === 'escalate' ? (
          <EscalateOutcome
            contact={contact}
            secondaryNote={bleedingSecondaryNote(snapshot.redFlagAnswers)}
            onDownload={handleDownload}
          />
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
  secondaryNote: string | undefined;
  onDownload: () => void;
}

function EscalateOutcome({
  contact,
  secondaryNote,
  onDownload,
}: EscalateOutcomeProps): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title">Call now</h1>
        <p className="text-body text-text-muted">{contact.reason}</p>
      </div>

      <EmergencyCall contact={contact} prominence="lead" secondaryNote={secondaryNote} />

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
        If anything changes while you wait, check in again or call {contact.label}.
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
