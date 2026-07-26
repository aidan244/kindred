/**
 * THE WELCOME STEP IS AN OFFSET, AND OFFSETS GO WRONG BY ONE.
 *
 * Onboarding used to map `stepIndex` straight onto `onboardingQuestions`.
 * The welcome beat shifts every question along by `WELCOME_STEPS`, and the
 * failure mode of getting that wrong is not a crash — it is the first question
 * being silently skipped, which no other test in this suite would notice
 * because every remaining step still renders perfectly.
 *
 * So this asserts the seam itself: welcome is what she sees first, and one
 * press of Continue puts her on question ONE.
 *
 * The rail assertions come along because they read off the same arithmetic
 * (`answeredCount` subtracts the same offset) and because "hidden where
 * nothing is being asked" is the rule the welcome step inherits from the
 * pairing step.
 *
 * `cleanup()` is explicit because this project does not enable Vitest globals
 * (vite.config.ts sets only `environment`), so Testing Library's automatic
 * afterEach cleanup never registers.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import Onboarding from '../screens/Onboarding';
import { AppStateProvider } from '../context/AppStateContext';
import {
  ONBOARDING_CONTINUE_LABEL,
  ONBOARDING_PROGRESS_LABEL,
  ONBOARDING_WELCOME_TITLE,
  onboardingQuestions,
} from '../data/clinicalContent';

afterEach(cleanup);

function mountOnboarding(): void {
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <AppStateProvider>
        <Onboarding />
      </AppStateProvider>
    </MemoryRouter>,
  );
}

describe('onboarding opens on the welcome beat', () => {
  it('shows the welcome first, with no rail — nothing has been asked yet', () => {
    mountOnboarding();

    expect(screen.queryByText(ONBOARDING_WELCOME_TITLE), 'the welcome title').not.toBeNull();
    expect(screen.queryByLabelText(ONBOARDING_PROGRESS_LABEL), 'the rail').toBeNull();
  });

  it('advances to the FIRST question, not the second', () => {
    mountOnboarding();
    fireEvent.click(screen.getByText(ONBOARDING_CONTINUE_LABEL));

    expect(screen.queryByText(ONBOARDING_WELCOME_TITLE), 'the welcome title').toBeNull();
    expect(
      screen.queryByText(onboardingQuestions[0].prompt),
      'the first question — an off-by-one shows the second here',
    ).not.toBeNull();
    expect(screen.queryByLabelText(ONBOARDING_PROGRESS_LABEL), 'the rail').not.toBeNull();
  });
});
