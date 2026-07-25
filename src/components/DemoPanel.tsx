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
import { Microphone, SlidersHorizontal, X } from '@phosphor-icons/react';
import type { AmbientBackground } from '../context/AppStateContext';
import { useAppState } from '../context/AppStateContext';
import { COLLAPSE_CATEGORY_ID, redFlagCategories } from '../data/clinicalContent';
import { asInjectable, getMovementStream } from '../sensors/MovementStream';
import type { CategoryAnswer, VoiceNote } from '../types';
import { PushBanner } from './PushBanner';

/**
 * design-plan.md §15.7 — a valid, silent WAV as a data: URL, so the demo can
 * attach a playable, seekable "voice note" without ever touching
 * getUserMedia or MediaRecorder. 44-byte RIFF/WAVE header (PCM, mono, 8kHz,
 * 8-bit) followed by 8000 bytes of 0x80 (silence) — one second of audio.
 * Never call URL.revokeObjectURL on this: it is a data: URL, not an object
 * URL (see resetState's revokeVoiceNoteUrl, which skips non-blob: URLs).
 */
const DEMO_VOICE_NOTE_BASE64 = 'UklGRmQfAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAfAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
const DEMO_VOICE_NOTE_DATA_URL = `data:audio/wav;base64,${DEMO_VOICE_NOTE_BASE64}`;
/** A plausible-looking figure for the review row and nothing more (§15.7). */
const DEMO_VOICE_NOTE_DURATION_SECONDS = 12;

function demoVoiceNote(): VoiceNote {
  return {
    url: DEMO_VOICE_NOTE_DATA_URL,
    durationSeconds: DEMO_VOICE_NOTE_DURATION_SECONDS,
    mimeType: 'audio/wav',
  };
}

/** design-plan.md §13.8 — the three mutually exclusive wash options. */
const AMBIENT_BACKGROUND_OPTIONS: ReadonlyArray<{ value: AmbientBackground; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'hearth', label: 'A: Hearth' },
  { value: 'room', label: 'B: Room breath' },
];

interface ScreenLink {
  key: string;
  label: string;
  path: string;
  /** Runs synchronously right before navigation, to seed app state so the
   * jump lands on an honest, deterministic version of that screen instead
   * of whatever state happened to be left over from an earlier click-through. */
  seed?: () => void;
}

/** Every category's gate answered no — the "no positive red flags" case
 * used to demo the ad hoc/routine outcome. Also a valid, honest fixture for
 * the alert-path escalate seed below, since the alert path escalates
 * regardless of answers. */
function nonFlaggingAnswers(): CategoryAnswer[] {
  return redFlagCategories.map((category) => ({
    categoryId: category.id,
    gateAnswer: 'no',
    additionalGateAnswers: category.additionalGateQuestions?.map(() => 'no'),
    followUpAnswers: [],
  }));
}

/** Categories up to and including a Collapse-category hard stop, gated yes
 * — the "Outcome (emergency)" jump seeds a realistic hard-stop submission:
 * everything walked before the hard stop fired is answered no, the hard
 * stop itself is yes, and (matching `handleHardStop` in TriageFlow.tsx)
 * nothing after it is answered at all, so the PDF's "not asked — check-in
 * ended early" wording has something real to demo too. */
function emergencyTierAnswers(): CategoryAnswer[] {
  const collapseIndex = redFlagCategories.findIndex((c) => c.id === COLLAPSE_CATEGORY_ID);
  return redFlagCategories.slice(0, collapseIndex + 1).map((category) => {
    if (category.id === COLLAPSE_CATEGORY_ID) {
      return { categoryId: category.id, gateAnswer: 'yes', additionalGateAnswers: [], followUpAnswers: [] };
    }
    return {
      categoryId: category.id,
      gateAnswer: 'no',
      additionalGateAnswers: category.additionalGateQuestions?.map(() => 'no'),
      followUpAnswers: [],
    };
  });
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
    ambientBackground,
    setAmbientBackground,
    setAlertActive,
    setEntryPath,
    categoryAnswers,
    setCategoryAnswers,
    setTriageVoiceNote,
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
      label: 'Outcome (escalate, triage tier)',
      path: '/outcome',
      // Alert path + zero positive gates still escalates — the alert path
      // can only push towards escalation, never away from it. None of the
      // emergency-tier conditions are met, so this resolves to triage tier.
      seed: () => {
        setEntryPath('alert');
        setCategoryAnswers([]);
        submitReport();
      },
    },
    {
      key: 'outcome-emergency',
      label: 'Outcome (emergency)',
      path: '/outcome',
      // Seeds a collapse-category hard stop so the emergency tier — 999
      // primary, maternity triage moved to the quiet secondary route — is
      // demoable without walking the whole hard-stop interrupt live.
      seed: () => {
        setEntryPath('adhoc');
        setCategoryAnswers(emergencyTierAnswers());
        submitReport({ endedEarly: true });
      },
    },
    {
      key: 'outcome-routine',
      label: 'Outcome (routine)',
      path: '/outcome',
      // Ad hoc + every gate no is the only combination that's routine.
      seed: () => {
        setEntryPath('adhoc');
        setCategoryAnswers(nonFlaggingAnswers());
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

  // design-plan.md §16.5 — null when the current stream has no injection
  // capability (a real hardware stream, say), in which case the section
  // below renders neither button nor heading.
  const injectableMovementStream = asInjectable(getMovementStream(activityVariant));

  const injectSingleSample = (): void => {
    injectableMovementStream?.injectSample();
    setIsOpen(false);
  };

  const injectActiveSpell = (): void => {
    injectableMovementStream?.injectBurst();
    setIsOpen(false);
  };

  // design-plan.md §15.7 — attaches a synthetic VoiceNote without touching
  // getUserMedia, so the demo can show the review attachment row and PDF
  // line with the microphone blocked, missing, or in use. Targets the most
  // recently answered CategoryAnswer's own voiceNote (the last entry —
  // categoryAnswers is always appended/re-inserted in answer order, so its
  // last item is the one most recently touched); once every category has an
  // answer, the conversation has moved on to the closing free-text beat, so
  // it targets triageVoiceNote instead.
  const attachDemoVoiceNote = (): void => {
    const note = demoVoiceNote();
    if (categoryAnswers.length >= redFlagCategories.length && categoryAnswers.length > 0) {
      setTriageVoiceNote(note);
    } else if (categoryAnswers.length > 0) {
      const lastCategoryId = categoryAnswers[categoryAnswers.length - 1].categoryId;
      setCategoryAnswers(
        categoryAnswers.map((answer) =>
          answer.categoryId === lastCategoryId ? { ...answer, voiceNote: note } : answer
        )
      );
    } else {
      // Nothing answered yet — attach to the closing beat so the button
      // never silently does nothing.
      setTriageVoiceNote(note);
    }
    setIsOpen(false);
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
                Ambient background
              </h3>
              <div className="flex gap-2">
                {AMBIENT_BACKGROUND_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAmbientBackground(option.value)}
                    aria-pressed={ambientBackground === option.value}
                    className={`min-h-14 flex-1 rounded-lg px-3 py-2 ${
                      ambientBackground === option.value ? 'bg-accent text-bg' : 'bg-surface-hi'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            {injectableMovementStream && (
              <section className="mb-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Live movement
                </h3>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={injectSingleSample}
                    className="min-h-14 rounded-lg bg-surface-hi px-3 py-2 text-left hover:opacity-80"
                  >
                    Movement
                    <span className="block text-sm text-text-muted">one sample now</span>
                  </button>
                  <button
                    type="button"
                    onClick={injectActiveSpell}
                    className="min-h-14 rounded-lg bg-surface-hi px-3 py-2 text-left hover:opacity-80"
                  >
                    Active spell
                    <span className="block text-sm text-text-muted">7 samples over ~8 seconds</span>
                  </button>
                </div>
              </section>
            )}

            <section className="mb-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Voice note
              </h3>
              <button
                type="button"
                onClick={attachDemoVoiceNote}
                className="flex min-h-14 w-full items-center gap-2 rounded-lg bg-surface-hi px-3 py-2 text-left hover:opacity-80"
              >
                <Microphone size={18} weight="light" aria-hidden="true" />
                <span>
                  Attach a demo voice note
                  <span className="block text-sm text-text-muted">
                    no microphone needed — attaches to the latest answer, or the closing note
                  </span>
                </span>
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
