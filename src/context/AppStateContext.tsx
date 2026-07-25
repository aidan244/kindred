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
import type {
  ActivityVariant,
  CategoryAnswer,
  EntryPath,
  OnboardingAnswers,
  VoiceNote,
} from '../types';

/** The ambient background wash's iteration — design-plan.md §13.8.
 * 'off' renders nothing; 'hearth' / 'room' select iteration A / B. */
export type AmbientBackground = 'off' | 'hearth' | 'room';

export type ReportSubmissionStatus = 'idle' | 'submitted';

export interface ReportSubmission {
  status: ReportSubmissionStatus;
  submittedAt: Date | null;
  /** True when this submission was fired by the hard-stop interrupt (held-
   * build-brief.md placeholder_content, "Hard-stop rule") rather than by
   * pressing Send on the review screen — review was skipped, and any
   * category not yet answered was genuinely never reached. Read by
   * src/screens/reportAssembly.ts to set ReportData.hardStopEndedEarly. */
  hardStopEndedEarly: boolean;
}

const initialOnboardingAnswers: OnboardingAnswers = {
  weeksPregnant: null,
  extraMonitoring: { answer: null, detail: '' },
  history: { selected: [], detail: '' },
};

const initialReportSubmission: ReportSubmission = {
  status: 'idle',
  submittedAt: null,
  hardStopEndedEarly: false,
};

/** Revokes a VoiceNote's object URL, if it has one. The demo panel's
 * synthetic voice note (design-plan.md §15.7) is a data: URL, never an
 * object URL, and must never be revoked — revoking a data: URL is a no-op
 * that also throws in some environments, so this checks the scheme first.
 * Exported so any other cleanup path (e.g. Outcome.tsx leaving the screen)
 * can revoke consistently rather than re-implementing the blob: check. */
export function revokeVoiceNoteUrl(note: VoiceNote | null | undefined): void {
  if (note?.url.startsWith('blob:')) {
    URL.revokeObjectURL(note.url);
  }
}

export interface AppState {
  /** Demo clock override; null means "use real time". */
  clockOverride: Date | null;
  setClockOverride: (date: Date | null) => void;
  /** The single source of "now" for the whole app. */
  now: () => Date;

  /** Which seeded activity dataset is live. */
  activityVariant: ActivityVariant;
  setActivityVariant: (variant: ActivityVariant) => void;

  /** The ambient background wash — design-plan.md §13.8. Default 'hearth'. */
  ambientBackground: AmbientBackground;
  setAmbientBackground: (value: AmbientBackground) => void;

  /** How the current triage flow was entered. */
  entryPath: EntryPath;
  setEntryPath: (path: EntryPath) => void;

  /** Whether Home shows its alert state. */
  alertActive: boolean;
  setAlertActive: (active: boolean) => void;

  onboardingAnswers: OnboardingAnswers;
  setOnboardingAnswers: (answers: OnboardingAnswers) => void;

  categoryAnswers: CategoryAnswer[];
  setCategoryAnswers: (answers: CategoryAnswer[]) => void;

  /** Free text captured on the triage flow's detail step. */
  triageDescription: string;
  setTriageDescription: (text: string) => void;

  /** Voice note attached to the closing free-text beat (design-plan.md
   * §15.6) — distinct from any voiceNote attached to an individual
   * CategoryAnswer, which lives on that answer instead. */
  triageVoiceNote: VoiceNote | null;
  setTriageVoiceNote: (note: VoiceNote | null) => void;

  reportSubmission: ReportSubmission;
  /** `endedEarly: true` marks this submission as fired by the hard-stop
   * interrupt rather than the review screen's Send (held-build-brief.md
   * placeholder_content, "Hard-stop rule") — see ReportSubmission above. */
  submitReport: (options?: { endedEarly?: boolean }) => void;

  /** Restores everything to a clean demo start. */
  resetState: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }): ReactElement {
  const [clockOverride, setClockOverride] = useState<Date | null>(null);
  const [activityVariant, setActivityVariant] = useState<ActivityVariant>('active');
  const [ambientBackground, setAmbientBackground] = useState<AmbientBackground>('hearth');
  const [entryPath, setEntryPath] = useState<EntryPath>(null);
  const [alertActive, setAlertActive] = useState<boolean>(false);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers>(
    initialOnboardingAnswers
  );
  const [categoryAnswers, setCategoryAnswers] = useState<CategoryAnswer[]>([]);
  const [triageDescription, setTriageDescription] = useState<string>('');
  const [triageVoiceNote, setTriageVoiceNote] = useState<VoiceNote | null>(null);
  const [reportSubmission, setReportSubmission] = useState<ReportSubmission>(
    initialReportSubmission
  );

  const now = useCallback((): Date => clockOverride ?? new Date(), [clockOverride]);

  const submitReport = useCallback(
    (options?: { endedEarly?: boolean }): void => {
      setReportSubmission({
        status: 'submitted',
        submittedAt: now(),
        hardStopEndedEarly: options?.endedEarly ?? false,
      });
    },
    [now]
  );

  const resetState = useCallback((): void => {
    // Revoke any live object URLs before clearing them, so a long demo
    // session can't leak blobs (design-plan.md §15.6). Read via the
    // functional setState form rather than closing over categoryAnswers /
    // triageVoiceNote, so this can stay a zero-dependency callback.
    setCategoryAnswers((prev) => {
      prev.forEach((answer) => revokeVoiceNoteUrl(answer.voiceNote));
      return [];
    });
    setTriageVoiceNote((prev) => {
      revokeVoiceNoteUrl(prev);
      return null;
    });
    setClockOverride(null);
    setActivityVariant('active');
    setAmbientBackground('hearth');
    setEntryPath(null);
    setAlertActive(false);
    setOnboardingAnswers(initialOnboardingAnswers);
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
      ambientBackground,
      setAmbientBackground,
      entryPath,
      setEntryPath,
      alertActive,
      setAlertActive,
      onboardingAnswers,
      setOnboardingAnswers,
      categoryAnswers,
      setCategoryAnswers,
      triageDescription,
      setTriageDescription,
      triageVoiceNote,
      setTriageVoiceNote,
      reportSubmission,
      submitReport,
      resetState,
    }),
    [
      clockOverride,
      now,
      activityVariant,
      ambientBackground,
      entryPath,
      alertActive,
      onboardingAnswers,
      categoryAnswers,
      triageDescription,
      triageVoiceNote,
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
