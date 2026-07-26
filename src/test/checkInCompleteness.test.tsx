/**
 * THE CHECK-IN IS ALWAYS WALKED TO THE END.
 *
 * This file used to assert the opposite. A 'yes' on the collapse / seizure /
 * trauma category was a HARD STOP: it submitted whatever had been gathered so
 * far and jumped straight to the emergency outcome, skipping every remaining
 * category and the review screen. That was removed on instruction — the
 * report that reaches the clinician has to be cohesive, and a report that
 * ends mid-questionnaire is not.
 *
 * Recorded because the trade is real and someone will eventually ask why:
 * the interrupt existed so that a person who has just collapsed or had a
 * seizure sees a number to call immediately rather than after five more
 * categories. Completeness now wins that argument. If it is ever reversed,
 * this test is the thing to invert.
 *
 * What did NOT change: the escalation TIER. Answering yes to collapse still
 * resolves to the emergency tier (src/logic/escalationTier.ts), so the
 * outcome screen still leads with the call control — she just reaches it via
 * the review screen like everyone else.
 *
 * Fake timers because every conversational beat is deliberately delayed
 * (`BEAT_MS` / `CHIP_DELAY_MS` in CheckInConversation.tsx); `advance()`
 * fast-forwards inside `act()` so state updates flush deterministically.
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

/** Answers whichever yes/no row is currently on screen, then lets the next
 * beat land. */
function answer(label: 'Yes' | 'No'): void {
  advance(3000);
  fireEvent.click(screen.getByRole('button', { name: label }));
  advance(400); // the row's fade-out before onSelect fires
}

const ORDER = redFlagCategories;
const collapseIndex = ORDER.findIndex((c) => c.hardStop);

describe('the check-in is walked to the end', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom does not implement scrollTo, and the conversation's auto-scroll
    // calls it on every beat.
    window.scrollTo = vi.fn() as typeof window.scrollTo;
  });

  afterEach(() => {
    // vitest is not configured with `test.globals`, so testing-library's
    // automatic afterEach(cleanup) never registers — do it explicitly.
    cleanup();
    vi.useRealTimers();
  });

  it('answering the collapse category yes does NOT end the check-in early', () => {
    // The fixture this leans on: the collapse category must sit mid-sequence,
    // or "the questions after it" is untestable.
    expect(collapseIndex).toBeGreaterThan(0);
    expect(collapseIndex).toBeLessThan(ORDER.length - 1);

    renderTriageFlow();

    for (let i = 0; i < collapseIndex; i += 1) {
      answer('No');
    }

    advance(3000);
    expect(screen.getByText(ORDER[collapseIndex].gateQuestion)).toBeInTheDocument();

    // The answer that used to end everything.
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    advance(400);

    // It did not navigate: the emergency outcome's heading is nowhere, and
    // neither is a review that was never reached.
    expect(screen.queryByText('Please call paramedics now.')).not.toBeInTheDocument();
    expect(screen.queryByText('Check everything')).not.toBeInTheDocument();

    // Every additional gate on the category is still asked, whatever she
    // answered above — they are part of the report.
    for (const prompt of ORDER[collapseIndex].additionalGateQuestions ?? []) {
      advance(3000);
      expect(screen.getByText(prompt)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      advance(400);
    }

    // And so is every category after it — the whole point of the change.
    for (let i = collapseIndex + 1; i < ORDER.length; i += 1) {
      advance(3000);
      expect(screen.getByText(ORDER[i].gateQuestion)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      advance(400);
    }
  });

  it('still reaches the review screen, so the report is complete before it is sent', () => {
    renderTriageFlow();

    for (let i = 0; i < ORDER.length; i += 1) {
      answer(i === collapseIndex ? 'Yes' : 'No');
      if (i === collapseIndex) {
        for (const _prompt of ORDER[i].additionalGateQuestions ?? []) {
          answer('No');
        }
      }
    }

    // The closing free-text beat is optional. Declining it is a legitimate
    // answer, and is what takes her on to review.
    advance(3000);
    fireEvent.click(screen.getByRole('button', { name: 'Nothing to add' }));
    advance(2000);

    fireEvent.click(screen.getByRole('button', { name: 'Continue to review' }));
    advance(1200);

    expect(screen.getByText('Check everything')).toBeInTheDocument();
  });
});
