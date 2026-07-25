import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { useAppState } from '../context/AppStateContext';
import { onboardingQuestions } from '../data/clinicalContent';
import { OnboardingProgress } from './onboarding/OnboardingProgress';
import { QuestionStep, isQuestionAnswered } from './onboarding/QuestionStep';
import { PairingStep } from './onboarding/PairingStep';

// One step per question in src/data/clinicalContent.ts, plus one closing
// pairing step. Adding a question there — of an existing type — needs no
// change here or in QuestionStep.
const TOTAL_STEPS = onboardingQuestions.length + 1;

export default function Onboarding(): ReactElement {
  const { onboardingAnswers, setOnboardingAnswers } = useAppState();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);

  const stepRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the new step's content on every step change (but not on
  // first mount) so screen-reader users get the new question announced,
  // since this is one route with internal steps rather than a navigation.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    stepRef.current?.focus();
  }, [stepIndex]);

  const isPairingStep = stepIndex === onboardingQuestions.length;
  const currentQuestion = isPairingStep ? null : onboardingQuestions[stepIndex];
  const canContinue = currentQuestion ? isQuestionAnswered(currentQuestion, onboardingAnswers) : true;

  const handleBack = (): void => {
    setStepIndex((index) => Math.max(0, index - 1));
  };

  const handleNext = (): void => {
    if (stepIndex < TOTAL_STEPS - 1) {
      setStepIndex((index) => index + 1);
      return;
    }
    navigate('/home');
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[var(--content-max)] flex-col px-6 pt-8 dock-safe">
      <div className="flex items-center gap-4">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="tap -ml-4 flex items-center justify-center rounded-pill text-text-muted"
          >
            <CaretLeft size={24} weight="light" aria-hidden="true" />
          </button>
        ) : (
          <div className="tap" aria-hidden="true" />
        )}
        <OnboardingProgress currentStep={stepIndex} totalSteps={TOTAL_STEPS} />
      </div>

      <div ref={stepRef} tabIndex={-1} className="mt-8 flex flex-1 flex-col">
        {currentQuestion ? (
          <QuestionStep question={currentQuestion} answers={onboardingAnswers} onChange={setOnboardingAnswers} />
        ) : (
          <PairingStep onContinue={handleNext} />
        )}
      </div>

      {currentQuestion ? (
        <button
          type="button"
          onClick={handleNext}
          disabled={!canContinue}
          className="tap mt-12 flex w-full items-center justify-center rounded-pill bg-accent px-6 text-label text-on-accent disabled:opacity-55"
        >
          Continue
        </button>
      ) : null}
    </div>
  );
}
