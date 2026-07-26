/**
 * The hard-stop interrupt tested AS UI BEHAVIOUR (held-build-brief.md
 * tech_stack: "test the hard stop as a UI behaviour too, not just a
 * function result") — mounts the real triage flow, walks a few ordinary
 * categories, answers the Collapse/seizure/trauma category's gate yes
 * mid-sequence, and asserts immediate navigation to the emergency outcome
 * without the remaining categories (Vomiting, Movement) ever being asked,
 * and without passing through the review screen.
 *
 * Uses fake timers because every conversational beat is deliberately
 * delayed (design-plan.md §14.5, `BEAT_MS` / `CHIP_DELAY_MS` in
 * CheckInConversation.tsx) — `advance()` below fast-forwards past those
 * pauses inside `act()` so state updates flush deterministically.
 */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider } from '../context/AppStateContext';
import { redFlagCategories } from '../data/clinicalContent';
import TriageFlow from '../screens/TriageFlow';
import Outcome from '../screens/Outcome';

function renderTriageFlow(): void {
  render(
    <AppStateProvider>
      <MemoryRouter initialEntries={['/triage']}>
        <Routes>
          <Route path="/triage" element={<TriageFlow />} />
          <Route path="/outcome" element={<Outcome />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>
  );
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const ORDER = redFlagCategories;
const collapseIndex = ORDER.findIndex((c) => c.hardStop);

describe('hard-stop interrupt (UI behaviour)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom does not implement scrollTo — the conversation's auto-scroll
    // (design-plan.md §14.6) and a couple of route-transition scroll resets
    // call it on every beat, which would otherwise spam stderr with "Not
    // implemented" warnings for a codepath this test isn't exercising.
    window.scrollTo = vi.fn() as typeof window.scrollTo;
  });

  afterEach(() => {
    // vitest's config here does not enable `test.globals`, so
    // @testing-library/react's automatic afterEach(cleanup) registration
    // (which relies on a GLOBAL afterEach) never fires — clean up
    // explicitly so each test starts from an empty document.
    cleanup();
    vi.useRealTimers();
  });

  it('answering the collapse category yes mid-sequence navigates immediately to the emergency outcome, skipping remaining categories and review', () => {
    // Sanity check on the fixture this test leans on: the hard-stop
    // category must not be first or last, or "mid-sequence" is untested.
    expect(collapseIndex).toBeGreaterThan(0);
    expect(collapseIndex).toBeLessThan(ORDER.length - 1);

    renderTriageFlow();

    // Answer every ordinary category before the hard-stop category "no",
    // walking the conversation exactly as she would.
    for (let i = 0; i < collapseIndex; i += 1) {
      advance(3000);
      const noButton = screen.getByRole('button', { name: 'No' });
      fireEvent.click(noButton);
      advance(200); // TapChipRow's fade-out delay before onSelect fires
    }

    // The hard-stop category's gate question is now the one on screen.
    advance(3000);
    expect(screen.getByText(ORDER[collapseIndex].gateQuestion)).toBeInTheDocument();

    // The remaining categories have not been rendered at all yet.
    for (const later of ORDER.slice(collapseIndex + 1)) {
      expect(screen.queryByText(later.gateQuestion)).not.toBeInTheDocument();
    }

    const yesButton = screen.getByRole('button', { name: 'Yes' });
    fireEvent.click(yesButton);
    advance(500);

    // Navigated straight to the emergency outcome — "Call now" is
    // Outcome's escalate-state heading, and 999 is the primary number for
    // the emergency tier (src/screens/Outcome.tsx EMERGENCY_TIER_CONTACT).
    expect(screen.getByText('Please call 999 now.')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();

    // Review was skipped entirely — its heading never appears.
    expect(screen.queryByText('Check everything')).not.toBeInTheDocument();

    // The remaining categories were never asked, even after landing on the
    // outcome screen (TriageFlow has unmounted — nothing left to find).
    for (const later of ORDER.slice(collapseIndex + 1)) {
      expect(screen.queryByText(later.gateQuestion)).not.toBeInTheDocument();
    }
  });

  it('a hard stop via the collapse category\'s additional gate question (primary "no") also navigates immediately', () => {
    renderTriageFlow();

    for (let i = 0; i < collapseIndex; i += 1) {
      advance(3000);
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      advance(200);
    }

    // Primary gate: no.
    advance(3000);
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    advance(200);

    // The additional gate question ("Any abdominal trauma or fall?") is now
    // on screen — answering it yes must hard-stop just the same.
    advance(3000);
    const additionalPrompt = ORDER[collapseIndex].additionalGateQuestions?.[0];
    expect(additionalPrompt).toBeTruthy();
    expect(screen.getByText(additionalPrompt as string)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    advance(500);

    expect(screen.getByText('Please call 999 now.')).toBeInTheDocument();
    expect(screen.getByText('999')).toBeInTheDocument();
    expect(screen.queryByText('Check everything')).not.toBeInTheDocument();
  });
});
