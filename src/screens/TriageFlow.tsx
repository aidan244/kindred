/**
 * The triage flow (/triage) — shared by both entry paths ("alert": she
 * tapped a push notification, and "adhoc": she pressed Speak to Kindred
 * herself). Two phases, one route, internal phase state:
 *
 *  a. The conversational check-in (handoff README screens 03/04/05;
 *     design-plan.md §14, amended for the six-category schema —
 *     held-build-brief.md placeholder_content) — one continuous, scrolling
 *     exchange covering the red-flag categories and the closing free-text
 *     beat. src/screens/triage/CheckInConversation.tsx.
 *  b. Review (handoff README screen 06) — everything that will be sent, in
 *     plain language, with the ability to jump back and edit any category
 *     before sending. SKIPPED entirely when a hard stop has already routed
 *     her to the emergency outcome (see `handleHardStop` below) —
 *     placeholder_content's hard-stop rule.
 *
 * DOCK OWNERSHIP. Every screen renders into ONE shared fixed rectangle
 * (src/components/Dock.tsx), so the two call controls appear not to move
 * between screens. This screen owns that rectangle only while it is showing
 * the CONVERSATION: `ReviewStep` renders its own `<Dock variant="tall">`
 * (send + note + operator) for the review phase, and two docks portalled
 * into the same host at once would stack. Hence `phase === 'conversation'`
 * on the Dock below — not a styling nicety, it is the handover point
 * between the two owners.
 *
 * The conversation's dock is the EMERGENCY control, not Speak to Kindred:
 * inside this flow "raise a concern" already means "call now", not "start a
 * check-in" (safety rule 3). It is never disabled, never animated, never
 * shadowed, and `OperatorCall` is the last child of it, as of every dock in
 * the product.
 *
 * Arriving here with `location.state?.continueAfterHardStop` means she used
 * the quiet "Add more detail for your clinic" link on the emergency outcome
 * screen (src/screens/Outcome.tsx) — her existing categoryAnswers must NOT
 * be cleared in that case, unlike a genuinely fresh check-in.
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { revokeVoiceNoteUrl, useAppState } from '../context/AppStateContext';
import {
  BACK_LABEL,
  BLEEDING_CATEGORY_ID,
  BLEEDING_EMERGENCY_NOTE,
  CHECK_IN_PROGRESS_LABEL,
  CHECK_IN_SCREEN_TITLE,
  checkInProgressValueText,
  patientFixture,
  redFlagCategories,
} from '../data/clinicalContent';
import { getTriageContact } from '../logic/triageContact';
import { Dock } from '../components/Dock';
import { EmergencyCall } from '../components/EmergencyCall';
import { OperatorCall } from '../components/OperatorCall';
import { CheckInConversation, type BackRequest } from './triage/CheckInConversation';
import { ReviewStep } from './triage/ReviewStep';
import type { CategoryAnswer } from '../types';

const CATEGORY_COUNT = redFlagCategories.length;

type Phase = 'conversation' | 'review';
type EditTarget =
  | { type: 'gate'; categoryId: string }
  | { type: 'followUp'; categoryId: string; followUpId: string }
  | { type: 'closing' };

export default function TriageFlow(): ReactElement {
  const {
    now,
    entryPath,
    setEntryPath,
    setAlertActive,
    categoryAnswers,
    setCategoryAnswers,
    triageDescription,
    setTriageDescription,
    triageVoiceNote,
    setTriageVoiceNote,
    reportSubmission,
    submitReport,
    setTriagePhase,
  } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();

  // "Add more detail for your clinic" (the quiet link on the emergency
  // outcome screen) arrives with this flag so her existing answers are
  // preserved rather than reset as a fresh check-in would be.
  const continuingAfterHardStop = Boolean(
    (location.state as { continueAfterHardStop?: boolean } | null)?.continueAfterHardStop
  );

  const [phase, setPhase] = useState<Phase>('conversation');
  const [reaskCategoryId, setReaskCategoryId] = useState<string | null>(null);
  const [reaskFollowUpKey, setReaskFollowUpKey] = useState<string | null>(null);
  const [closingReask, setClosingReask] = useState(false);
  const [pendingReturnToReview, setPendingReturnToReview] = useState(false);
  const [skippedDetailFor, setSkippedDetailFor] = useState<Set<string>>(new Set());
  const [closingSkipped, setClosingSkipped] = useState(false);
  const [backRequest, setBackRequest] = useState<BackRequest | null>(null);

  // A previous flow already reached a submitted report — this is a new
  // check-in, so start it with a clean slate rather than her old answers.
  // Not when she's continuing after a hard stop: that IS the previous
  // flow, deliberately kept. (Runs once, on mount, deliberately.) Revokes
  // any live voice-note object URLs from the stale submission before
  // clearing it, so a long demo session spanning several check-ins can't
  // leak blobs — this used to be Outcome.tsx's job (on unmount), but a
  // mount-effect cleanup fires prematurely under React StrictMode's dev-only
  // double-invoke immediately after first mount, before she has done
  // anything at all, which silently wiped the very state "Add more detail
  // for your clinic" (§14.10) needs to still be there. Doing it here
  // instead, at the one point that's unambiguously "starting fresh", has no
  // such hazard.
  useEffect(() => {
    if (reportSubmission.status === 'submitted' && !continuingAfterHardStop) {
      categoryAnswers.forEach((answer) => revokeVoiceNoteUrl(answer.voiceNote));
      revokeVoiceNoteUrl(triageVoiceNote);
      setCategoryAnswers([]);
      setTriageDescription('');
      setTriageVoiceNote(null);
    }
    if (entryPath === null) {
      setEntryPath('adhoc');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // App state holds the phase too, because things mounted ABOVE the router
  // (the shared dock host) may need to know which half of this flow is on
  // screen without reaching into it. This screen stays the owner — the
  // context copy follows it, never the other way round.
  useEffect(() => {
    setTriagePhase(phase);
  }, [phase, setTriagePhase]);

  // Arriving at review is a normal route-level transition (§14.8) — it
  // should feel like arriving somewhere else, starting at the top. Leaving
  // review (back caret, or an "Edit" press) intentionally does NOT reset
  // scroll here: a plain back caret leaves the conversation wherever it
  // was, and an "Edit" press relies on the conversation's own scroll-into-
  // view for the re-asked category instead.
  useEffect(() => {
    if (phase === 'review') {
      window.scrollTo(0, 0);
    }
  }, [phase]);

  const contact = getTriageContact(now(), patientFixture);
  const bleedingFlagged = categoryAnswers.some(
    (a) => a.categoryId === BLEEDING_CATEGORY_ID && a.gateAnswer === 'yes'
  );
  const secondaryNote = bleedingFlagged ? BLEEDING_EMERGENCY_NOTE : undefined;

  // The rail counts CATEGORIES, not questions, and a category currently
  // being re-asked is not counted — which is why changing an answer can send
  // the rail backwards. That is correct and deliberately not special-cased
  // (handoff README 03: "may go down if she changes an answer").
  const answeredCount = redFlagCategories.filter(
    (c) => c.id !== reaskCategoryId && categoryAnswers.some((a) => a.categoryId === c.id)
  ).length;
  const showRail = phase === 'conversation' && answeredCount < CATEGORY_COUNT;

  const exitFlow = (): void => {
    setEntryPath(null);
    setAlertActive(false);
    categoryAnswers.forEach((a) => revokeVoiceNoteUrl(a.voiceNote));
    revokeVoiceNoteUrl(triageVoiceNote);
    setCategoryAnswers([]);
    setTriageDescription('');
    setTriageVoiceNote(null);
    navigate('/home');
  };

  const startEdit = (target: EditTarget): void => {
    setPendingReturnToReview(true);
    if (target.type === 'gate') {
      setReaskCategoryId(target.categoryId);
    } else if (target.type === 'followUp') {
      setReaskFollowUpKey(`${target.categoryId}::${target.followUpId}`);
    } else {
      setClosingReask(true);
    }
    setPhase('conversation');
  };

  const goBack = (): void => {
    if (phase === 'review') {
      setPhase('conversation');
      return;
    }
    if (reaskCategoryId !== null || reaskFollowUpKey !== null || closingReask) {
      // Abort the in-progress edit. If it was opened from review, return
      // there rather than leaving her stranded mid-conversation.
      setReaskCategoryId(null);
      setReaskFollowUpKey(null);
      setClosingReask(false);
      if (pendingReturnToReview) {
        setPendingReturnToReview(false);
        setPhase('review');
      }
      return;
    }
    if (categoryAnswers.length === 0) {
      exitFlow();
      return;
    }
    // Pops the most recently *answered* category (in walking order) back to
    // fully unanswered — detail and voice note included, so a fresh detail
    // beat can open again if she re-flags it. This undoes at category
    // granularity, not per follow-up (documented scope decision — see
    // CheckInConversation.tsx's header comment on edit granularity).
    const lastAnsweredIndex = redFlagCategories.reduce(
      (acc, category, index) => (categoryAnswers.some((a) => a.categoryId === category.id) ? index : acc),
      -1
    );
    if (lastAnsweredIndex === -1) {
      exitFlow();
      return;
    }
    const lastCategoryId = redFlagCategories[lastAnsweredIndex].id;
    const lastAnswer = categoryAnswers.find((a) => a.categoryId === lastCategoryId);
    revokeVoiceNoteUrl(lastAnswer?.voiceNote);
    setCategoryAnswers(categoryAnswers.filter((a) => a.categoryId !== lastCategoryId));
    setSkippedDetailFor((prev) => {
      if (!prev.has(lastCategoryId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(lastCategoryId);
      return next;
    });
    setBackRequest((prev) => ({ nonce: (prev?.nonce ?? 0) + 1, categoryId: lastCategoryId }));
  };

  const handleChangeThisGate = (categoryId: string): void => setReaskCategoryId(categoryId);
  const handleChangeThisFollowUp = (categoryId: string, followUpId: string): void =>
    setReaskFollowUpKey(`${categoryId}::${followUpId}`);

  const handleGateReaskResolved = (): void => {
    setReaskCategoryId(null);
    if (pendingReturnToReview) {
      setPendingReturnToReview(false);
      setPhase('review');
    }
  };

  const handleFollowUpReaskResolved = (): void => {
    setReaskFollowUpKey(null);
    if (pendingReturnToReview) {
      setPendingReturnToReview(false);
      setPhase('review');
    }
  };

  const handleClosingReaskResolved = (): void => {
    setClosingReask(false);
    if (pendingReturnToReview) {
      setPendingReturnToReview(false);
      setPhase('review');
    }
  };

  const handleSend = (): void => {
    submitReport();
    navigate('/outcome');
  };

  // Hard-stop rule (placeholder_content): the instant a collapse/trauma
  // question is answered yes, submit whatever exists and navigate
  // immediately to the emergency outcome — no remaining categories, review
  // skipped. `finalAnswer` has already been written into categoryAnswers by
  // CheckInConversation before this fires, so the report reflects it.
  const handleHardStop = (_finalAnswer: CategoryAnswer): void => {
    submitReport({ endedEarly: true });
    navigate('/outcome');
  };

  // The quiet way back in after a hard stop (design brief: "she can keep
  // adding detail afterward if she wants"). Review stays skipped — there is
  // nothing to review on this path — and the number already shown cannot
  // change (no-downgrade rule), so this just resubmits and returns.
  const handleReturnToEmergencyOutcome = (): void => {
    submitReport({ endedEarly: true });
    navigate('/outcome');
  };

  return (
    <>
      {/* README 03: `padding: 32px 24px 0`, content max-width 420, centred.
          The top inset is added to the 32px rather than replacing it, so the
          header keeps its designed distance from the notch. `dock-safe-tall`
          is the 268px this flow's three-control dock clears — no message,
          chip or composer may enter it. */}
      <div className="mx-auto w-full max-w-[var(--content-max)] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] dock-safe-tall">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={goBack}
            aria-label={BACK_LABEL}
            className="tap press -ml-4 flex shrink-0 items-center justify-center text-text-muted"
          >
            <CaretLeft size={24} weight="light" aria-hidden="true" />
          </button>

          {/* 3px, pill, accent on line. No numeral, no gradient, no glow, no
              colour change at 100% — and it is gone entirely once the last
              category is answered, because a full bar is not information.
              The numeral it withholds visually is given to screen readers
              through aria-valuetext. */}
          {showRail && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={CATEGORY_COUNT}
              aria-valuenow={answeredCount}
              aria-valuetext={checkInProgressValueText(answeredCount, CATEGORY_COUNT)}
              aria-label={CHECK_IN_PROGRESS_LABEL}
              className="h-[3px] flex-1 overflow-hidden rounded-pill bg-line"
            >
              <div
                className="h-full rounded-pill bg-accent"
                style={{
                  width: `${(answeredCount / CATEGORY_COUNT) * 100}%`,
                  transition: 'width var(--dur-enter) var(--ease-soft)',
                }}
              />
            </div>
          )}
        </header>

        <h1 className="sr-only">{CHECK_IN_SCREEN_TITLE}</h1>

        {/* The conversation starts 24px below the header (README 03). */}
        <div className="pt-6">
          {/* CheckInConversation stays mounted for the whole flow, even
              while review is showing (toggled with `hidden` rather than
              unmounted) — its beats must never re-animate on a round trip
              to review and back (§14.5), which only holds if it never
              remounts. */}
          <div
            className={phase === 'conversation' ? '' : 'hidden'}
            aria-live="polite"
            aria-relevant="additions"
          >
            <CheckInConversation
              reaskCategoryId={reaskCategoryId}
              onChangeThisGate={handleChangeThisGate}
              onGateReaskResolved={handleGateReaskResolved}
              reaskFollowUpKey={reaskFollowUpKey}
              onChangeThisFollowUp={handleChangeThisFollowUp}
              onFollowUpReaskResolved={handleFollowUpReaskResolved}
              closingReask={closingReask}
              onClosingReaskResolved={handleClosingReaskResolved}
              skippedDetailFor={skippedDetailFor}
              setSkippedDetailFor={setSkippedDetailFor}
              closingSkipped={closingSkipped}
              setClosingSkipped={setClosingSkipped}
              onReachedReview={() => setPhase('review')}
              onHardStop={handleHardStop}
              onReturnToEmergencyOutcome={handleReturnToEmergencyOutcome}
              backRequest={backRequest}
            />
          </div>

          {phase === 'review' && (
            <ReviewStep
              answers={categoryAnswers}
              description={triageDescription}
              voiceNote={triageVoiceNote}
              onEditCategory={(categoryId) => startEdit({ type: 'gate', categoryId })}
              onEditDescription={() => startEdit({ type: 'closing' })}
              onSend={handleSend}
            />
          )}
        </div>
      </div>

      {/* Conversation phase only — ReviewStep owns the same rectangle for
          the review phase (see this file's header). */}
      {phase === 'conversation' && (
        <Dock variant="tall">
          <EmergencyCall contact={contact} prominence="standard" secondaryNote={secondaryNote} />
          <OperatorCall />
        </Dock>
      )}
    </>
  );
}
