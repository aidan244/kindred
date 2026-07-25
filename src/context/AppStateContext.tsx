/**
 * Global app state, held in React context — no external state library.
 *
 * `now()` is the single clock accessor used by both the theme switch
 * (src/theme/useThemeSync.ts) and (later) clinic-hours logic
 * (src/logic/triageContact.ts): both must read the same clock so the demo
 * panel's clock override visibly drives both at once.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { ActivityVariant, EntryPath, OnboardingAnswers, RedFlagAnswer } from '../types';

export type ReportSubmissionStatus = 'idle' | 'submitted';

export interface ReportSubmission {
  status: ReportSubmissionStatus;
  submittedAt: Date | null;
}

const initialOnboardingAnswers: OnboardingAnswers = {
  weeksPregnant: null,
  extraMonitoring: { answer: null, detail: '' },
  history: { selected: [], detail: '' },
};

const initialReportSubmission: ReportSubmission = {
  status: 'idle',
  submittedAt: null,
};

export interface AppState {
  /** Demo clock override; null means "use real time". */
  clockOverride: Date | null;
  setClockOverride: (date: Date | null) => void;
  /** The single source of "now" for the whole app. */
  now: () => Date;

  /** Which seeded activity dataset is live. */
  activityVariant: ActivityVariant;
  setActivityVariant: (variant: ActivityVariant) => void;

  /** How the current triage flow was entered. */
  entryPath: EntryPath;
  setEntryPath: (path: EntryPath) => void;

  /** Whether Home shows its alert state. */
  alertActive: boolean;
  setAlertActive: (active: boolean) => void;

  onboardingAnswers: OnboardingAnswers;
  setOnboardingAnswers: (answers: OnboardingAnswers) => void;

  redFlagAnswers: RedFlagAnswer[];
  setRedFlagAnswers: (answers: RedFlagAnswer[]) => void;

  /** Free text captured on the triage flow's detail step. */
  triageDescription: string;
  setTriageDescription: (text: string) => void;

  reportSubmission: ReportSubmission;
  submitReport: () => void;

  /** Restores everything to a clean demo start. */
  resetState: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }): ReactElement {
  const [clockOverride, setClockOverride] = useState<Date | null>(null);
  const [activityVariant, setActivityVariant] = useState<ActivityVariant>('active');
  const [entryPath, setEntryPath] = useState<EntryPath>(null);
  const [alertActive, setAlertActive] = useState<boolean>(false);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers>(
    initialOnboardingAnswers
  );
  const [redFlagAnswers, setRedFlagAnswers] = useState<RedFlagAnswer[]>([]);
  const [triageDescription, setTriageDescription] = useState<string>('');
  const [reportSubmission, setReportSubmission] = useState<ReportSubmission>(
    initialReportSubmission
  );

  const now = useCallback((): Date => clockOverride ?? new Date(), [clockOverride]);

  const submitReport = useCallback((): void => {
    setReportSubmission({ status: 'submitted', submittedAt: now() });
  }, [now]);

  const resetState = useCallback((): void => {
    setClockOverride(null);
    setActivityVariant('active');
    setEntryPath(null);
    setAlertActive(false);
    setOnboardingAnswers(initialOnboardingAnswers);
    setRedFlagAnswers([]);
    setTriageDescription('');
    setReportSubmission(initialReportSubmission);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      clockOverride,
      setClockOverride,
      now,
      activityVariant,
      setActivityVariant,
      entryPath,
      setEntryPath,
      alertActive,
      setAlertActive,
      onboardingAnswers,
      setOnboardingAnswers,
      redFlagAnswers,
      setRedFlagAnswers,
      triageDescription,
      setTriageDescription,
      reportSubmission,
      submitReport,
      resetState,
    }),
    [
      clockOverride,
      now,
      activityVariant,
      entryPath,
      alertActive,
      onboardingAnswers,
      redFlagAnswers,
      triageDescription,
      reportSubmission,
      submitReport,
      resetState,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}
