/**
 * Hidden demo control panel — built fully working so a one-minute stage
 * demo can't fail on flaky real-time/real-sensor conditions.
 *
 * Toggle: Ctrl+. (keyboard) or the small low-contrast dot in the bottom
 * right corner (pointer). Available as an overlay on every screen (mounted
 * once in src/components/Layout.tsx).
 */

import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, X } from '@phosphor-icons/react';
import { useAppState } from '../context/AppStateContext';
import { redFlagQuestions } from '../data/clinicalContent';
import type { RedFlagAnswer } from '../types';
import { PushBanner } from './PushBanner';

interface ScreenLink {
  key: string;
  label: string;
  path: string;
  /** Runs synchronously right before navigation, to seed app state so the
   * jump lands on an honest, deterministic version of that screen instead
   * of whatever state happened to be left over from an earlier click-through. */
  seed?: () => void;
}

/** Every question answered with its non-flagging answer — the "no positive
 * red flags" case used to demo the ad hoc/routine outcome. */
function nonFlaggingAnswers(): RedFlagAnswer[] {
  return redFlagQuestions.map((question) => ({
    questionId: question.id,
    answer: question.flagWhen === 'yes' ? 'no' : 'yes',
  }));
}

function formatTimeForInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function overrideAtHour(hour: number): Date {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function DemoPanel(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [isPushVisible, setIsPushVisible] = useState(false);
  const navigate = useNavigate();
  const {
    now,
    clockOverride,
    setClockOverride,
    activityVariant,
    setActivityVariant,
    setAlertActive,
    setEntryPath,
    setRedFlagAnswers,
    submitReport,
    resetState,
  } = useAppState();

  const screenLinks: ScreenLink[] = [
    { key: 'onboarding', label: 'Onboarding', path: '/onboarding' },
    {
      key: 'home',
      label: 'Home',
      path: '/home',
      // Plain Home: no alert, and any stale alert entry path is cleared so
      // it can never leak into a later ad hoc check-in.
      seed: () => {
        setAlertActive(false);
        setEntryPath(null);
      },
    },
    {
      key: 'home-alert',
      label: 'Home (alert state)',
      path: '/home',
      // The alert entry path is set alongside alertActive so a check-in
      // started from here can never be mislabelled ad hoc.
      seed: () => {
        setAlertActive(true);
        setEntryPath('alert');
      },
    },
    { key: 'live', label: 'Live view', path: '/live' },
    { key: 'triage', label: 'Triage flow', path: '/triage' },
    {
      key: 'outcome-escalate',
      label: 'Outcome (escalate)',
      path: '/outcome',
      // Alert path + zero positive red flags still escalates — the alert
      // path can only push towards escalation, never away from it.
      seed: () => {
        setEntryPath('alert');
        setRedFlagAnswers([]);
        submitReport();
      },
    },
    {
      key: 'outcome-routine',
      label: 'Outcome (routine)',
      path: '/outcome',
      // Ad hoc + zero positive red flags is the only combination that's
      // routine.
      seed: () => {
        setEntryPath('adhoc');
        setRedFlagAnswers(nonFlaggingAnswers());
        submitReport();
      },
    },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey && event.key === '.') {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const goToScreen = (link: ScreenLink): void => {
    link.seed?.();
    navigate(link.path);
    setIsOpen(false);
  };

  const firePushNotification = (): void => {
    setIsPushVisible(true);
    setIsOpen(false);
  };

  const handlePushOpen = (): void => {
    setIsPushVisible(false);
    setEntryPath('alert');
    setAlertActive(true);
    navigate('/home');
  };

  const handleTimeInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const [hoursStr, minutesStr] = event.target.value.split(':');
    if (hoursStr === undefined || minutesStr === undefined) {
      return;
    }
    const date = new Date();
    date.setHours(Number(hoursStr), Number(minutesStr), 0, 0);
    setClockOverride(date);
  };

  return (
    <>
      <PushBanner visible={isPushVisible} onOpen={handlePushOpen} />

      <button
        type="button"
        aria-label="Open demo control panel"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-0 right-0 z-40 flex h-14 w-14 items-center justify-center"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-text-muted opacity-30" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-4 text-text sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <SlidersHorizontal size={20} weight="light" aria-hidden="true" />
                Demo controls
              </h2>
              <button
                type="button"
                aria-label="Close demo control panel"
                onClick={() => setIsOpen(false)}
                className="flex h-14 w-14 items-center justify-center rounded-full hover:bg-surface-hi"
              >
                <X size={20} weight="light" aria-hidden="true" />
              </button>
            </div>

            <section className="mb-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Jump to screen
              </h3>
              <div className="flex flex-col gap-2">
                {screenLinks.map((link) => (
                  <button
                    key={link.key}
                    type="button"
                    onClick={() => goToScreen(link)}
                    className="min-h-14 rounded-lg bg-surface-hi px-3 py-2 text-left hover:opacity-80"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="mb-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Push notification
              </h3>
              <button
                type="button"
                onClick={firePushNotification}
                className="min-h-14 w-full rounded-lg bg-accent px-3 py-2 text-left text-bg hover:opacity-90"
              >
                Fire push notification
              </button>
            </section>

            <section className="mb-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Seeded activity data
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivityVariant('quiet')}
                  aria-pressed={activityVariant === 'quiet'}
                  className={`min-h-14 flex-1 rounded-lg px-3 py-2 ${
                    activityVariant === 'quiet' ? 'bg-accent text-bg' : 'bg-surface-hi'
                  }`}
                >
                  Quiet
                </button>
                <button
                  type="button"
                  onClick={() => setActivityVariant('active')}
                  aria-pressed={activityVariant === 'active'}
                  className={`min-h-14 flex-1 rounded-lg px-3 py-2 ${
                    activityVariant === 'active' ? 'bg-accent text-bg' : 'bg-surface-hi'
                  }`}
                >
                  Active
                </button>
              </div>
            </section>

            <section className="mb-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Clock override
              </h3>
              <p className="mb-2 text-sm text-text-muted">
                Now: {formatTimeForInput(now())}
                {clockOverride ? ' (overridden)' : ' (real time)'}
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setClockOverride(overrideAtHour(14))}
                  className="min-h-14 flex-1 rounded-lg bg-surface-hi px-3 py-2"
                >
                  2pm
                </button>
                <button
                  type="button"
                  onClick={() => setClockOverride(overrideAtHour(2))}
                  className="min-h-14 flex-1 rounded-lg bg-surface-hi px-3 py-2"
                >
                  2am
                </button>
                <button
                  type="button"
                  onClick={() => setClockOverride(null)}
                  className="min-h-14 flex-1 rounded-lg bg-surface-hi px-3 py-2"
                >
                  Real time
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-text-muted">
                Custom time
                <input
                  type="time"
                  onChange={handleTimeInputChange}
                  value={clockOverride ? formatTimeForInput(clockOverride) : ''}
                  className="min-h-14 flex-1 rounded-lg bg-surface-hi px-3 py-2 text-text"
                />
              </label>
            </section>

            <section>
              <button
                type="button"
                onClick={resetState}
                className="min-h-14 w-full rounded-lg border border-line bg-surface px-3 py-2 text-text hover:opacity-90"
              >
                Reset state
              </button>
            </section>
          </div>
        </div>
      )}
    </>
  );
}
