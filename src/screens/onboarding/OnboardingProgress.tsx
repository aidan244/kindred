import type { ReactElement } from 'react';

export interface OnboardingProgressProps {
  /** 0-indexed current step. */
  currentStep: number;
  totalSteps: number;
}

/**
 * A row of small dots marking progress through onboarding. No numbers, no
 * bar-fill animation — just which step she's on, stated once for assistive
 * tech via the progressbar role and hidden from view otherwise.
 */
export function OnboardingProgress({ currentStep, totalSteps }: OnboardingProgressProps): ReactElement {
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={currentStep + 1}
      aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
      className="flex items-center gap-2"
    >
      {Array.from({ length: totalSteps }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${index <= currentStep ? 'bg-accent' : 'bg-surface-hi'}`}
        />
      ))}
    </div>
  );
}
