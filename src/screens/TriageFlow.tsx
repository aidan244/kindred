/**
 * The triage flow (/triage) — shared by both entry paths ("alert": she
 * tapped a push notification, and "adhoc": she pressed Check in herself).
 * Three phases, one route, internal step state so back navigation between
 * phases is trivial to preserve:
 *
 *  a. Red-flag questionnaire — one question per screen, driven entirely by
 *     src/data/clinicalContent.ts, with an optional inline detail field.
 *  b. Detail step — a short scripted chat capturing anything else in her
 *     own words (src/components/TriageChat.tsx).
 *  c. Review — everything that will be sent, in plain language, with the
 *     ability to jump back and edit any answer before sending.
 *
 * This screen does not get the global CheckInControl bar (see
 * src/components/Layout.tsx) — instead the emergency call control is
 * docked in the same position on every screen of this flow, because in
 * this flow "raise a concern" already means "call now", not "start a
 * check-in" (safety rule 3).
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { useAppState } from '../context/AppStateContext';
import { BLEEDING_EMERGENCY_NOTE, patientFixture, redFlagQuestions } from '../data/clinicalContent';
import { getTriageContact } from '../logic/triageContact';
import { EmergencyCall } from '../components/EmergencyCall';
import { TriageChat } from '../components/TriageChat';
import { RedFlagStep } from './triage/RedFlagStep';
import { ReviewStep } from './triage/ReviewStep';
import type { RedFlagAnswer } from '../types';

const QUESTION_COUNT = redFlagQuestions.length;
const DETAIL_STEP = QUESTION_COUNT;
const REVIEW_STEP = QUESTION_COUNT + 1;

/** Dock height is generous on purpose: it only has to comfortably clear the
 * two-control emergency stack (primary + 999) plus its fade, across every
 * step's content. Getting this exactly pixel-perfect matters less than
 * never letting content sit invisibly behind the dock. */
const CONTENT_BOTTOM_PADDING = 'calc(268px + env(safe-area-inset-bottom, 0px))';

export default function TriageFlow(): ReactElement {
  const {
    now,
    entryPath,
    setEntryPath,
    setAlertActive,
    redFlagAnswers,
    setRedFlagAnswers,
    triageDescription,
    setTriageDescription,
    reportSubmission,
    submitReport,
  } = useAppState();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [returnToReview, setReturnToReview] = useState(false);

  // A previous flow already reached a submitted report — this is a new
  // check-in, so start it with a clean slate rather than her old answers.
  // (Runs once, on mount, deliberately.)
  useEffect(() => {
    if (reportSubmission.status === 'submitted') {
      setRedFlagAnswers([]);
      setTriageDescription('');
    }
    if (entryPath === null) {
      setEntryPath('adhoc');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each step is a fresh screen in every sense but the URL — she should
  // never land part-way down a question because the previous step (e.g. a
  // long review list) left the page scrolled.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const contact = getTriageContact(now(), patientFixture);
  const bleedingFlagged = redFlagAnswers.some(
    (a) => a.questionId === 'bleeding-fluid' && a.answer === 'yes'
  );
  const secondaryNote = bleedingFlagged ? BLEEDING_EMERGENCY_NOTE : undefined;

  const findAnswer = (questionId: string): RedFlagAnswer | undefined =>
    redFlagAnswers.find((a) => a.questionId === questionId);

  const updateAnswer = (
    questionId: string,
    patch: { answer?: 'yes' | 'no'; detail?: string }
  ): void => {
    const existing = findAnswer(questionId);
    if (!existing && patch.answer === undefined) {
      // Detail can't be attached before an answer exists.
      return;
    }
    const next: RedFlagAnswer = {
      questionId,
      answer: patch.answer ?? existing?.answer ?? 'no',
      detail: patch.detail !== undefined ? patch.detail : existing?.detail,
    };
    setRedFlagAnswers([...redFlagAnswers.filter((a) => a.questionId !== questionId), next]);
  };

  const exitFlow = (): void => {
    setEntryPath(null);
    setAlertActive(false);
    setRedFlagAnswers([]);
    setTriageDescription('');
    navigate('/home');
  };

  const goBack = (): void => {
    if (returnToReview) {
      setReturnToReview(false);
      setStep(REVIEW_STEP);
      return;
    }
    if (step === 0) {
      exitFlow();
      return;
    }
    if (step === DETAIL_STEP) {
      setStep(QUESTION_COUNT - 1);
      return;
    }
    if (step === REVIEW_STEP) {
      setStep(DETAIL_STEP);
      return;
    }
    setStep((s) => s - 1);
  };

  const goNext = (): void => {
    if (returnToReview) {
      setReturnToReview(false);
      setStep(REVIEW_STEP);
      return;
    }
    setStep((s) => Math.min(s + 1, REVIEW_STEP));
  };

  const jumpTo = (target: number): void => {
    setReturnToReview(true);
    setStep(target);
  };

  const handleSend = (): void => {
    submitReport();
    navigate('/outcome');
  };

  const currentQuestion = step < QUESTION_COUNT ? redFlagQuestions[step] : undefined;
  const canContinueQuestion =
    currentQuestion !== undefined && findAnswer(currentQuestion.id)?.answer !== undefined;

  return (
    <div className="relative min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col px-6">
        <header className="flex items-center justify-between pt-8">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="tap -ml-4 flex items-center justify-center text-text-muted"
          >
            <CaretLeft size={24} weight="light" aria-hidden="true" />
          </button>

          {step < QUESTION_COUNT ? (
            <div
              className="flex items-center gap-2"
              role="status"
              aria-label={`Question ${step + 1} of ${QUESTION_COUNT}`}
            >
              {redFlagQuestions.map((question, index) => (
                <span
                  key={question.id}
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${index <= step ? 'bg-accent' : 'bg-line'}`}
                />
              ))}
            </div>
          ) : (
            <span />
          )}

          <span className="h-14 w-14" aria-hidden="true" />
        </header>

        <div className="flex-1 pt-8" style={{ paddingBottom: CONTENT_BOTTOM_PADDING }}>
          {currentQuestion && (
            <RedFlagStep
              key={currentQuestion.id}
              question={currentQuestion}
              answer={findAnswer(currentQuestion.id)}
              onSelect={(value) => updateAnswer(currentQuestion.id, { answer: value })}
              onDetailChange={(detail) => updateAnswer(currentQuestion.id, { detail })}
            />
          )}

          {step === DETAIL_STEP && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <h1 className="text-title">Check in</h1>
                <p className="text-lead">Anything else?</p>
              </div>
              <TriageChat
                description={triageDescription}
                onDescriptionChange={setTriageDescription}
                onContinue={goNext}
              />
            </div>
          )}

          {step === REVIEW_STEP && (
            <ReviewStep
              answers={redFlagAnswers}
              description={triageDescription}
              onEditQuestion={jumpTo}
              onEditDescription={() => jumpTo(DETAIL_STEP)}
              onSend={handleSend}
            />
          )}

          {currentQuestion && (
            <div className="mt-8">
              <button
                type="button"
                onClick={goNext}
                disabled={!canContinueQuestion}
                className="tap w-full rounded-pill bg-accent px-6 text-label text-on-accent disabled:opacity-55"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-6">
        <div className="pointer-events-auto w-full max-w-[372px]">
          <div
            aria-hidden="true"
            className="h-6"
            style={{ background: 'linear-gradient(to top, transparent, var(--bg))' }}
          />
          <div
            className="bg-bg pt-2"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
          >
            <EmergencyCall contact={contact} secondaryNote={secondaryNote} />
          </div>
        </div>
      </div>
    </div>
  );
}
