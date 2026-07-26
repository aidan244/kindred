/**
 * The outcome screen (/outcome) — handoff README, "07 Outcome — emergency
 * tier". One screen, three renderings of one shape, chosen by two pure
 * functions that this screen only reads, never second-guesses:
 *
 *  - `disposition(entryPath, categoryAnswers)` → escalate | routine.
 *  - `getEscalationTier(categoryAnswers)` → emergency | triage, but only
 *    once the disposition is already 'escalate'.
 *
 * The README draws the EMERGENCY tier only. The other two states are the
 * same composition with different content, deliberately — one type rhythm
 * (title → lead 12px → surface card 24px), one card treatment (radius 22,
 * padding 22, 8px gaps), one dock shape. Nothing here has its own styling
 * language, because "which state am I in" must never be something she has to
 * re-learn the layout to answer:
 *
 *  - emergency tier: 999 is the primary route (EMERGENCY_TIER_CONTACT
 *    below), the resolved maternity/clinic triage line moves below the fold
 *    as EmergencyCall's own quiet secondary row, and the card carries the
 *    while-you-wait advice.
 *  - triage tier: exactly the previous behaviour — `getTriageContact()` is
 *    primary and 999 is the quiet secondary route. Only the number and the
 *    framing change between tiers, nothing else (the brief's words).
 *  - routine: states ONLY what this app witnessed — that she pressed Send,
 *    at what time, and when her clinic is open. Its "call your clinic"
 *    affordance in the CONTENT is a plain non-emergency control rendered
 *    here, never EmergencyCall — the content column carries no red. The red
 *    on this state lives only in the dock, where the call control is now
 *    permanent on every screen; the emergency token still belongs to the one
 *    component that owns it.
 *
 * WHAT THE ROUTINE STATE USED TO CLAIM, AND WHY IT NO LONGER DOES. It drew a
 * three-row timeline — "Sent", "Received by your clinic" (hardcoded
 * `complete`) and "Clinician reviewing" (`active` whenever the clinic was
 * open) — plus the line "Your report is in their queue." Receipt is never
 * confirmed by anything; no clinician is known to be reading anything; and
 * `submitReport()` (src/context/AppStateContext.tsx) writes local React state
 * with no transport of any kind behind it. Three assertions about a third
 * party's system, none of them observable from here. They are gone rather
 * than softened — a gentler wording would still be a claim — leaving the one
 * fact the app actually holds: she pressed Send, and when.
 *
 * The same reasoning removes the invented clock. `/outcome` is a real route
 * and `disposition('adhoc', [])` is 'routine', so arriving here having
 * submitted nothing used to print "Sent to … at 14:32." from `now()`. When
 * `reportSubmission.submittedAt` is null this screen now renders nothing in
 * its place — no lead, no time, and a title that claims nothing.
 *
 * Both escalate states offer the same report download, and a report has
 * already gone to the clinic in the background in every case (rule 4e) —
 * this screen never makes her wait for that.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT RENDER (all hoisted; duplicating
 * any of them breaks the invariant it exists to protect):
 *  - the aura backdrop — mounted once in App (src/components/Aura.tsx);
 *  - the docked controls AND the fade behind them — owned by the shared dock
 *    rectangle (src/components/Dock.tsx). This screen used to draw its own
 *    fixed bottom gradient and to render EmergencyCall inline in the content
 *    column; both are gone. The emergency control now lives in `<Dock
 *    variant="tall">` like every other screen's, so it occupies the same
 *    rectangle in the same position and does not move when she arrives here;
 *  - its own entrance animation — RouteTransition wraps the router.
 *
 * DOCK CLEARANCE. Both states carry `dock-safe-tall` (268px) — routine moved
 * to it when its dock gained the call control under Speak to Kindred, so both
 * docks now stack two pills. The emergency tier's dock measures taller than 268px
 * only because of the `48px` of top padding the tall dock uses to run its
 * `to top, bg 66%, transparent` fade — the controls themselves start below
 * that, so no content ever sits underneath something tappable.
 */

import { useEffect, useState, type ReactElement } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { useAppState } from '../context/AppStateContext';
import {
  OUTCOME_DOWNLOAD_ESCALATE_LABEL,
  OUTCOME_DOWNLOAD_ROUTINE_LABEL,
  OUTCOME_EMERGENCY_ADVICE,
  OUTCOME_EMERGENCY_TITLE,
  OUTCOME_ESCALATE_REPORT_HANDOVER,
  OUTCOME_ESCALATE_TRIAGE_LEAD,
  OUTCOME_ESCALATE_TRIAGE_TITLE,
  OUTCOME_ROUTINE_LEAD,
  OUTCOME_ROUTINE_NO_SUBMISSION_TITLE,
  OUTCOME_ROUTINE_TITLE,
  OUTCOME_ROUTINE_WORRIED_NOTE,
  emergencyHandoverLead,
  outcomeReportSentNote,
  patientFixture,
} from '../data/clinicalContent';
import { disposition } from '../logic/disposition';
import { getEscalationTier } from '../logic/escalationTier';
import { downloadReportPdf } from '../logic/reportPdf';
import { CheckInControl } from '../components/CheckInControl';
import { Dock } from '../components/Dock';
import { EmergencyCall } from '../components/EmergencyCall';
import { assembleReportData } from './reportAssembly';
import type { CategoryAnswer, VoiceNote } from '../types';

interface OutcomeSnapshot {
  entryPath: 'alert' | 'adhoc';
  categoryAnswers: CategoryAnswer[];
  triageDescription: string;
  triageVoiceNote: VoiceNote | null;
}

/* Every patient-facing string on this screen — both escalate tiers and the
 * routine state, the two download labels and the call row — now comes from
 * src/data/clinicalContent.ts. This file used to hold the largest single
 * concentration of misplaced copy in the codebase, on the screen that follows
 * an escalation decision, with a header comment conceding it and deferring. */

/** README §07: `padding: 32px 24px 0`, content max-width 420, centred. The
 * top inset is added to the 32px rather than replacing it, so the title keeps
 * its designed distance from the notch on hardware that has one. */
const CONTENT_CLASSES =
  'mx-auto w-full max-w-[var(--content-max)] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)]';

/** The bar treatment (README, "CheckInControl" → bar), minus the float
 * shadow, which the README reserves for the docked control. Used for both
 * in-content controls on this screen — the report download and the routine
 * state's plain call affordance — so neither competes with the dock and
 * neither invents a weight of its own. `press` because both are ordinary
 * controls; the emergency and operator routes are the only two that never
 * animate, and neither of these is one of them. */
const CONTENT_CONTROL_CLASSES =
  'tap press flex w-full items-center justify-center gap-2 rounded-pill border border-line bg-surface px-6 py-3 text-label text-text';

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

  // What this outcome is about, captured once on arrival. entryPath and
  // alertActive are cleared right below so a fresh Check-in press is
  // correct the instant she's back on a resting screen — but this screen
  // still needs the values that produced it for as long as she's on it.
  const [snapshot] = useState<OutcomeSnapshot>(() => ({
    entryPath: entryPath ?? 'adhoc',
    categoryAnswers,
    triageDescription,
    triageVoiceNote,
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
  // No `getTriageContact` / `isClinicOpenAt` here any more: the routine state
  // stopped naming a resolved contact and its opening hours when it was cut
  // back to "nothing was flagged" plus the call route. `getTriageContact` is
  // still the single implementation of that rule and is still called where the
  // rule is actually needed — this screen simply no longer needs it.
  const clinic = patientFixture.clinic;
  // NULLABLE ON PURPOSE. `null` means nothing was ever submitted, which is
  // reachable: /outcome is a real route and disposition('adhoc', []) is
  // 'routine'. The routine state renders nothing in place of the time rather
  // than substituting `now()` — see this file's header.
  const submittedAt = reportSubmission.submittedAt;

  const report = assembleReportData({
    patientName: patientFixture.name,
    gestationWeeks: patientFixture.gestationWeeks,
    entryPath: snapshot.entryPath,
    // The PDF needs a Date. With no submission this falls back to the moment
    // the document is being produced, which is what its "Generated …" line
    // says anyway — the fallback stays inside the report, never on screen.
    submittedAt: submittedAt ?? now(),
    categoryAnswers: snapshot.categoryAnswers,
    freeTextDescription: snapshot.triageDescription,
    freeTextVoiceNote: snapshot.triageVoiceNote,
    onboardingHistory: onboardingAnswers,
    activityVariant,
  });

  const handleDownload = (): void => downloadReportPdf(report);


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

  if (result === 'escalate') {
    // The tier → content mapping is spelled out here, in one place, rather
    // than branched on inside the presentational component: EscalateOutcome
    // renders one shape and is told what goes in it, so the two tiers can
    // never drift into two different layouts.
    return tier === 'emergency' ? (
      <EscalateOutcome
        title={OUTCOME_EMERGENCY_TITLE}
        lead={emergencyHandoverLead(patientFixture.gestationWeeks, snapshot.categoryAnswers)}
        advice={OUTCOME_EMERGENCY_ADVICE}
        reportSentNote={outcomeReportSentNote(clinic.name)}
        prominence="lead"
        onDownload={handleDownload}
      />
    ) : (
      // `lead` prominence on this tier too, so BOTH escalating outcomes put
      // the number itself at title size in the dock. The tiers still differ in
      // what they say — only the emergency tier carries the handover line and
      // the while-you-wait advice — but neither now presents "call now" over a
      // compact pill.
      <EscalateOutcome
        title={OUTCOME_ESCALATE_TRIAGE_TITLE}
        lead={OUTCOME_ESCALATE_TRIAGE_LEAD}
        reportSentNote={outcomeReportSentNote(clinic.name)}
        prominence="lead"
        onDownload={handleDownload}
      />
    );
  }

  return (
    <RoutineOutcome submittedAt={submittedAt} onDownload={handleDownload} />
  );
}

interface EscalateOutcomeProps {
  title: string;
  /** The one sentence under the title, at `lead` role. */
  lead: string;
  /** Emergency tier only: what to do while the ambulance is coming. Omitted
   * for the triage tier, where none of it applies. */
  advice?: string;
  /** Names where the report has already gone, muted, inside the same card. */
  reportSentNote: string;
  prominence: 'standard' | 'lead';
  onDownload: () => void;
}

function EscalateOutcome({
  title,
  lead,
  advice,
  reportSentNote,
  prominence,
  onDownload,
}: EscalateOutcomeProps): ReactElement {
  return (
    <>
      <div className={`${CONTENT_CLASSES} dock-safe-tall`}>
        {/* README §07's rhythm: title, lead 12px below, card 24px below.
            The stack continues at 24px for the two quiet controls under the
            card, so nothing below the fold introduces a new spacing. */}
        <div className="flex flex-col gap-6">
          {/* `display` rather than `title` on both escalating tiers. The
              README allows one display line per screen and this is it: when
              the answer is "call now", the instruction should be the largest
              thing on the screen above the control that carries it out. The
              routine state keeps `title`, so the two outcomes no longer read
              at the same weight — which is the point. Urgency here is SIZE
              and ORDER, never a new colour: red is still EmergencyCall's
              alone, and nothing was tinted to make this feel louder. */}
          <div className="flex flex-col gap-3">
            <h1 className="text-display text-text">{title}</h1>
            <p className="text-lead text-text">{lead}</p>
          </div>

          {/* Radius 22, padding 22, 8px gaps. The handover instruction leads
              the card at full `text` weight — it is the thing she has to
              actually do with the document, so it must not sit below the
              muted line. Both other lines keep their roles. */}
          <div className="flex flex-col gap-2 rounded-card bg-surface p-[22px]">
            {advice ? <p className="text-body text-text">{advice}</p> : null}
            <p className="text-body text-text">{OUTCOME_ESCALATE_REPORT_HANDOVER}</p>
            <p className="text-body text-text-muted">{reportSentNote}</p>
          </div>

          <button type="button" onClick={onDownload} className={CONTENT_CONTROL_CLASSES}>
            {/* shrink-0: at 200% text the label wraps and the glyph must keep
                its drawn size rather than being squeezed by the flex row. */}
            <DownloadSimple size={20} weight="light" className="shrink-0" aria-hidden="true" />
            {OUTCOME_DOWNLOAD_ESCALATE_LABEL}
          </button>

        </div>
      </div>

      {/* README §07's dock, reduced to its one control. There is no
          secondary row and no operator route any more — one number, at full
          weight, and nothing beside it to compare it against. */}
      <Dock variant="tall">
        <EmergencyCall prominence={prominence} />
      </Dock>
    </>
  );
}

interface RoutineOutcomeProps {
  /** Null when nothing was ever submitted — see this file's header. The only
   * thing this state still branches on: with no check-in behind it there is
   * no flag to report either way. */
  submittedAt: Date | null;
  onDownload: () => void;
}

function RoutineOutcome({ submittedAt, onDownload }: RoutineOutcomeProps): ReactElement {
  return (
    <>
      <div className={`${CONTENT_CLASSES} dock-safe-tall`}>
        <div className="flex flex-col gap-6">
          {/* TWO THINGS, AND THE QUALIFIER THAT MAKES THE FIRST ONE SAFE.
              This state used to report the send, the clinic's hours and a
              wait note. It now says only that nothing was flagged, and that
              she can still call — with the second sentence of the lead
              scoping "flagged" to her ANSWERS rather than to the baby. See
              the note on OUTCOME_ROUTINE_LEAD in clinicalContent.ts: without
              that sentence this screen is the false reassurance the product
              exists to avoid, and it is the first thing to check if this copy
              is ever edited.

              With nothing submitted the title claims nothing at all — there
              was no check-in, so there is no flag to report either way. */}
          <div className="flex flex-col gap-3">
            <h1 className="text-title text-text">
              {submittedAt ? OUTCOME_ROUTINE_TITLE : OUTCOME_ROUTINE_NO_SUBMISSION_TITLE}
            </h1>
            {submittedAt && <p className="text-lead text-text">{OUTCOME_ROUTINE_LEAD}</p>}
          </div>

          {/* Rule 2, at the moment it matters most: her perception wins, and
              she does not need this screen's agreement to act on it. */}
          <p className="text-body text-text">{OUTCOME_ROUTINE_WORRIED_NOTE}</p>

          <button type="button" onClick={onDownload} className={CONTENT_CONTROL_CLASSES}>
            <DownloadSimple size={20} weight="light" className="shrink-0" aria-hidden="true" />
            {OUTCOME_DOWNLOAD_ROUTINE_LABEL}
          </button>
        </div>
      </div>

      {/* In this state "raise a concern" means start another check-in, not
          call — so this is the one outcome that carries the ordinary
          Speak-to-Kindred bar, in the same rectangle it occupies on Home and
          the live view. The call control sits under it here too: a routine
          disposition is a statement about this check-in, not a promise about
          the next hour, and the escalate state's own dock already leads with
          the same control. */}
      <Dock variant="tall">
        <CheckInControl variant="bar" />
        <EmergencyCall prominence="standard" />
      </Dock>
    </>
  );
}
