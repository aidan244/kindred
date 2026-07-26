/**
 * Confirms the outcome screen's copy changes actually reach the rendered
 * DOM, not just that the clinicalContent.ts strings exist in isolation:
 * the routine state's new two-fact closing line, and both escalate tiers
 * sharing the same "call paramedics now" urgency and report-handoff
 * instruction.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect, useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppStateProvider, useAppState } from '../context/AppStateContext';
import { COLLAPSE_CATEGORY_ID } from '../data/clinicalContent';
import Outcome from '../screens/Outcome';
import type { CategoryAnswer } from '../types';

afterEach(() => {
  cleanup();
});

/** Seeds AppStateContext with the given entry path/answers, submits, then
 * mounts Outcome only once that's actually landed — Outcome snapshots
 * context at its own mount, so it must never be the first thing to render. */
function Harness({
  entryPath,
  categoryAnswers,
}: {
  entryPath: 'adhoc' | 'alert';
  categoryAnswers: CategoryAnswer[];
}): ReactElement | null {
  const { setEntryPath, setCategoryAnswers, submitReport } = useAppState();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntryPath(entryPath);
    setCategoryAnswers(categoryAnswers);
    submitReport();
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready ? <Outcome /> : null;
}

function renderOutcome(entryPath: 'adhoc' | 'alert', categoryAnswers: CategoryAnswer[]): void {
  render(
    <AppStateProvider>
      <MemoryRouter initialEntries={['/outcome']}>
        <Harness entryPath={entryPath} categoryAnswers={categoryAnswers} />
      </MemoryRouter>
    </AppStateProvider>
  );
}

const NO_FLAGS: CategoryAnswer[] = [];
const COLLAPSE_FLAGGED: CategoryAnswer[] = [
  { categoryId: COLLAPSE_CATEGORY_ID, gateAnswer: 'yes', additionalGateAnswers: [], followUpAnswers: [] },
];

describe('Outcome — routine', () => {
  it('states nothing was flagged and names paramedics, not a clinic contact', () => {
    renderOutcome('adhoc', NO_FLAGS);

    expect(
      screen.getByText(/Nothing you told us was flagged as a concern/)
    ).toBeInTheDocument();
    expect(screen.getByText(/call paramedics on 999/)).toBeInTheDocument();
    // The old wording named the clinic as who to call — confirm that's gone.
    expect(screen.queryByText(/call Thornfield/i)).not.toBeInTheDocument();
  });
});

describe('Outcome — escalate (triage tier)', () => {
  it('titles the same call as the emergency tier, and instructs handing over the report', () => {
    renderOutcome('alert', NO_FLAGS);

    expect(screen.getByRole('heading', { name: 'Please call paramedics now.' })).toBeInTheDocument();
    expect(
      screen.getByText('Download your report below and have it ready to hand to the paramedics.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /call paramedics on 999/i })).toHaveAttribute(
      'href',
      'tel:999'
    );
  });
});

describe('Outcome — escalate (emergency tier)', () => {
  it('titles the call, keeps the physical-safety advice, and adds the report-handoff instruction', () => {
    renderOutcome('adhoc', COLLAPSE_FLAGGED);

    expect(screen.getByRole('heading', { name: 'Please call paramedics now.' })).toBeInTheDocument();
    expect(screen.getByText(/lie on your left side/)).toBeInTheDocument();
    expect(
      screen.getByText(/have it ready to hand to the paramedics/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download your report to hand to paramedics' })
    ).toBeInTheDocument();
  });
});
