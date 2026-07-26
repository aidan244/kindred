/**
 * Onboarding (/onboarding) — the setup flow: one step per question in
 * src/data/clinicalContent.ts, then a closing pairing step.
 *
 * NOT ONE OF THE EIGHT HANDOFF SCREENS, and deliberately built on the handoff's
 * grammar anyway. The brief's instruction is that the whole app follows one
 * system rather than leaving old styling beside the new, and this screen is
 * the first thing she ever sees: whatever it teaches her about how Kindred
 * behaves is what she will expect from the check-in later. So it borrows,
 * piece for piece, from the README:
 *  - the check-in's progress rail (src/screens/onboarding/OnboardingProgress.tsx)
 *    — 3px, pill, accent on line, no numeral, no glow;
 *  - the back caret at a 56px target with a -16px left margin, muted (§03);
 *  - the answer chips and the composer card (src/screens/onboarding/QuestionStep.tsx);
 *  - the 96px KindredMark in its breathing lamp glow (PairingStep.tsx);
 *  - a 60px accent pill for "Continue", the same rectangle Home's primary
 *    control and the review screen's send button use.
 *
 * ONE CONTINUE FOR EVERY STEP, owned here rather than by each step component.
 * The pairing step used to render its own, which meant the one control that
 * moves her forward changed hands halfway through the flow. It is now a single
 * element in a single position for all four steps — the same argument the
 * README makes for the Speak-to-Kindred control keeping one rectangle across
 * screens, applied inside this flow.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT RENDER: the aura (mounted once in
 * App), its own entrance animation (RouteTransition wraps the router), and any
 * docked control of its own — it renders `<Dock>` and its children are
 * portalled into the one shared rectangle, so Speak to Kindred is in the same
 * place here as everywhere else. The bar weight, not primary: this screen's
 * own forward action is Continue, and two filled accent pills would read as
 * two competing ways on.
 *
 * `dock-safe` carries the 112px the dock clears. Content never enters it —
 * which is also why the column flows at its natural height rather than being
 * stretched to the viewport with the Continue pill pinned to the bottom, where
 * it would have sat underneath the dock.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { CheckInControl } from '../components/CheckInControl';
import { Dock } from '../components/Dock';
import { useAppState } from '../context/AppStateContext';
import {
  BACK_LABEL,
  ONBOARDING_CONTINUE_LABEL,
  onboardingQuestions,
} from '../data/clinicalContent';
import { OnboardingProgress } from './onboarding/OnboardingProgress';
import { QuestionStep, isQuestionAnswered } from './onboarding/QuestionStep';
import { PairingStep } from './onboarding/PairingStep';

// One step per question, plus one closing pairing step. Adding a question in
// src/data/clinicalContent.ts — of an existing type — needs no change here or
// in QuestionStep.
const TOTAL_STEPS = onboardingQuestions.length + 1;

/* Copy is imported, not declared. Onboarding used to keep its own strings on
 * the argument that it sits outside the handoff's copy set — but the rule as
 * stated is "all patient-facing copy", with no carve-out, and
 * clinicalContent.ts already owned the onboarding QUESTIONS, so the questions
 * and the chrome presenting them were split across two locations. */

export default function Onboarding(): ReactElement {
  const { onboardingAnswers, setOnboardingAnswers } = useAppState();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);

  const stepRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the new step's content on every step change (but not on
  // first mount) so screen-reader users get the new question announced —
  // this is one route with internal steps, so no route change fires to
  // announce it for us.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    stepRef.current?.focus();
  }, [stepIndex]);

  const isPairingStep = stepIndex === onboardingQuestions.length;
  const currentQuestion = isPairingStep ? null : onboardingQuestions[stepIndex];
  const canContinue = currentQuestion
    ? isQuestionAnswered(currentQuestion, onboardingAnswers)
    : true;

  // What the rail states: questions she has answered and moved past. Computed
  // from the answers rather than from `stepIndex`, so that going back and
  // clearing an answer takes the rail down with it — the check-in's rail has
  // the same property and the README calls it correct rather than a case to
  // special-case.
  const answeredCount = onboardingQuestions
    .slice(0, stepIndex)
    .filter((question) => isQuestionAnswered(question, onboardingAnswers)).length;

  // Hidden on the pairing step, which asks her nothing — the same rule as the
  // README's "hidden once the last category is answered".
  const showRail = currentQuestion !== null;

  const handleBack = (): void => {
    setStepIndex((index) => Math.max(0, index - 1));
  };

  const handleContinue = (): void => {
    if (stepIndex < TOTAL_STEPS - 1) {
      setStepIndex((index) => index + 1);
      return;
    }
    navigate('/home');
  };

  return (
    <>
      {/* The README's screen geometry: 24px gutters, 32px above the header,
          content max-width 420, centred. The top inset is ADDED to the 32px
          rather than replacing it, so the header keeps its designed distance
          from the notch on hardware that has one. */}
      <div className="mx-auto w-full max-w-[var(--content-max)] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] dock-safe">
        <header className="flex items-center gap-4">
          {stepIndex > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              aria-label={BACK_LABEL}
              className="press tap -ml-4 flex shrink-0 items-center justify-center rounded-pill text-text-muted"
            >
              <CaretLeft size={24} weight="light" aria-hidden="true" />
            </button>
          ) : (
            // A spacer with the caret's exact footprint, negative margin
            // included: the rail must start at the same x on step one as on
            // every step after it, or it appears to jump sideways the first
            // time she moves forward.
            <div className="tap -ml-4 shrink-0" aria-hidden="true" />
          )}

          {showRail && (
            <OnboardingProgress
              answeredCount={answeredCount}
              totalQuestions={onboardingQuestions.length}
            />
          )}
        </header>

        <div ref={stepRef} tabIndex={-1} className="mt-8">
          {currentQuestion ? (
            <QuestionStep
              question={currentQuestion}
              answers={onboardingAnswers}
              onChange={setOnboardingAnswers}
            />
          ) : (
            <PairingStep />
          )}
        </div>

        {/* The 60px accent pill. `min-h`, never a fixed height: 60px is the
            resting height, and the pill must grow rather than clip when text
            is scaled to 200%. Quieted to 0.55 while the step has nothing to
            move past — the README's disabled look — but never hidden and never
            re-labelled, so the shape of the step does not change under her. */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="press tap mt-12 flex min-h-[60px] w-full items-center justify-center rounded-pill bg-accent px-6 text-label text-on-accent disabled:opacity-55"
        >
          {ONBOARDING_CONTINUE_LABEL}
        </button>
      </div>

      {/* The shared dock. Bar weight, then the operator route — which is the
          last child of every dock in the product. */}
      <Dock>
        <CheckInControl variant="bar" />
      </Dock>
    </>
  );
}
