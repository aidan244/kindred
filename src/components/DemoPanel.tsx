/**
 * Hidden demo control panel — built fully working so a one-minute stage
 * demo can't fail on flaky real-time/real-sensor conditions.
 *
 * Toggle: Ctrl+. (keyboard) or the small low-contrast dot in the bottom
 * right corner (pointer). Available as an overlay on every screen, mounted
 * once in src/App.tsx — outside the router, next to the aura and the dock, so
 * it survives navigation. (It used to be mounted in src/components/Layout.tsx;
 * that file no longer exists.)
 *
 * NOT PATIENT-FACING, and the only surface in the product that is exempt from
 * the copy rules — it is stage furniture, read by whoever is driving the demo.
 * It is NOT exempt from the two safety invariants: no emergency red anywhere
 * outside EmergencyCall, and no tick/check glyph anywhere at all. A toggle's
 * on-state is an accent fill plus `aria-pressed`, never a tick.
 *
 * It does use the design tokens, because a panel drawn in raw greys sitting on
 * top of the lamplit screens is how "old styling beside the new" gets back in.
 */

import { useEffect, useState, type ChangeEvent, type ReactElement, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microphone, SlidersHorizontal, X } from '@phosphor-icons/react';
import { useAppState } from '../context/AppStateContext';
import { COLLAPSE_CATEGORY_ID, redFlagCategories } from '../data/clinicalContent';
import { getHeldBackend } from '../lib/backend/factory';
import { computeKickBaseline } from '../lib/movement/kickBaseline.ts';
import { detectKickReduction } from '../lib/movement/kickDetector.ts';
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

/**
 * The three-way "Ambient background" control that used to live here is GONE,
 * along with the component it drove. The full-bleed wash (AmbientBackground.tsx,
 * design-plan.md §13) has been replaced by the handoff README's aura backdrop
 * — five drifting blooms, mounted once in App and not switchable — so there is
 * nothing left for a toggle to choose between, and `ambientBackground` no
 * longer exists in AppStateContext either. Its slot below is now the band's
 * signal, which IS one of the README's own tweak props.
 */

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

// ---------------------------------------------------------------------------
// Panel chrome. Three shared class strings and one wrapper, so a dozen demo
// controls cannot quietly drift into a dozen slightly different buttons — and
// so every one of them is a real 56px target (`tap`) with the product's one
// press feedback (`press`), on the product's own radii and surfaces.
// ---------------------------------------------------------------------------

/** A demo row: full width, 56px, chip radius, on the raised surface. */
const ROW_CLASSES = 'press tap w-full rounded-chip bg-surface-hi px-3 py-2 text-left text-text';

/** A two-state control's on/off skins. "On" is an accent fill plus
 * `aria-pressed` — never a tick (there is no tick glyph in this product) and
 * never the emergency red, which exists in EmergencyCall alone. */
const TOGGLE_ON_CLASSES = 'press tap flex-1 rounded-chip bg-accent px-3 py-2 text-on-accent';
const TOGGLE_OFF_CLASSES = 'press tap flex-1 rounded-chip bg-surface-hi px-3 py-2 text-text';

function PanelSection({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-caption text-text-muted">{title}</h3>
      {children}
    </section>
  );
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
    bandOffline,
    setBandOffline,
    setAlertActive,
    setEntryPath,
    categoryAnswers,
    setCategoryAnswers,
    setTriageVoiceNote,
    submitReport,
    resetState,
  } = useAppState();

  const screenLinks: ScreenLink[] = [
    { key: 'welcome', label: 'Welcome', path: '/welcome' },
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
        submitReport();
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

  // The real kick-baseline detector (src/lib/movement/kickDetector.ts),
  // computed plainly here rather than memoised — nothing else in this file
  // uses that pattern, and this is a handful of array operations over an
  // 84-entry table. `{ lastAlertAt: null, sessionOpen: false }` is a
  // deliberate bypass of the refractory/session gating, not an oversight:
  // that gating exists to stop an unattended production job spamming a
  // patient, and this button is presenter-triggered — it has to fire
  // identically on the fifth press as the first.
  const kickWindow = getMovementStream(activityVariant).getTrendKickWindow();
  const kickBaseline = computeKickBaseline(kickWindow, now());
  const kickFiring = detectKickReduction(kickWindow, kickBaseline, now(), {
    lastAlertAt: null,
    sessionOpen: false,
  });

  const runKickCheck = (): void => {
    if (kickFiring) {
      setIsPushVisible(true); // exact same visible path as firePushNotification()
      void (async () => {
        try {
          const backend = await getHeldBackend();
          await backend.fireDetectorAlert(kickFiring);
        } catch (error) {
          // Best-effort: never block the visible demo on a backend hiccup,
          // same posture HeldBackend.audit() itself already documents.
          console.error('DemoPanel: fireDetectorAlert failed', error);
        }
      })();
    }
    setIsOpen(false);
  };

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

      {/* The way in on a touch device: a 56px target in the corner carrying a
          10px dot at 30% opacity, so it is findable by someone who knows it is
          there and invisible to everyone else. */}
      <button
        type="button"
        aria-label="Open demo control panel"
        onClick={() => setIsOpen(true)}
        className="press tap fixed bottom-0 right-0 z-40 flex items-center justify-center"
      >
        <span className="h-2.5 w-2.5 rounded-pill bg-text-muted opacity-30" aria-hidden="true" />
      </button>

      {isOpen && (
        // The scrim is the theme's own, not a black wash: this sits on top of
        // a warm room in both themes, and neutral black over it reads as a
        // different product's modal.
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'var(--scrim)' }}
        >
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-panel bg-surface p-4 text-text sm:rounded-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-label text-text">
                <SlidersHorizontal size={20} weight="light" aria-hidden="true" className="shrink-0" />
                Demo controls
              </h2>
              <button
                type="button"
                aria-label="Close demo control panel"
                onClick={() => setIsOpen(false)}
                className="press tap flex shrink-0 items-center justify-center rounded-pill"
              >
                <X size={20} weight="light" aria-hidden="true" />
              </button>
            </div>

            <PanelSection title="Jump to screen">
              <div className="flex flex-col gap-2">
                {screenLinks.map((link) => (
                  <button
                    key={link.key}
                    type="button"
                    onClick={() => goToScreen(link)}
                    className={ROW_CLASSES}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </PanelSection>

            <PanelSection title="Push notification">
              <button
                type="button"
                onClick={firePushNotification}
                className="press tap w-full rounded-chip bg-accent px-3 py-2 text-left text-on-accent"
              >
                Fire push notification
              </button>
              <p className="mt-2 text-caption text-text-muted">Manual — fires regardless of data.</p>
            </PanelSection>

            <PanelSection title="Kick check (against her own baseline)">
              <p className="mb-2 text-caption text-text-muted">
                {kickWindow.samples.length === 0
                  ? 'No signal — nothing to check.'
                  : !kickBaseline.sufficient
                    ? 'Not enough history yet.'
                    : `Baseline ${Math.round(kickBaseline.meanKicksPerDay)} kicks/day, from ${kickBaseline.daysUsed} days.`}
              </p>
              <button
                type="button"
                onClick={runKickCheck}
                className="press tap w-full rounded-chip bg-accent px-3 py-2 text-left text-on-accent"
              >
                Run RFM check
              </button>
              {kickFiring && (
                <p className="mt-2 text-caption text-text-muted">
                  Reduced: {Math.round(kickFiring.observed)} vs baseline {Math.round(kickFiring.expected)}{' '}
                  (threshold {Math.round(kickFiring.threshold)}) — notification fired.
                </p>
              )}
              {kickBaseline.sufficient && !kickFiring && kickWindow.samples.length > 0 && (
                <p className="mt-2 text-caption text-text-muted">
                  Not reduced against baseline — no notification fired.
                </p>
              )}
            </PanelSection>

            {/* The README's own `bandOffline` tweak prop. One switch, two
                screens: Home's live-data card swaps to the no-signal block and
                the live view drops to its no-signal state, because both read
                the same sensor boundary that `setBandOffline` puts to sleep. */}
            <PanelSection title="Band signal">
              <button
                type="button"
                onClick={() => setBandOffline(!bandOffline)}
                aria-pressed={bandOffline}
                className={bandOffline ? TOGGLE_ON_CLASSES : TOGGLE_OFF_CLASSES}
              >
                Band has no signal
              </button>
              <p className="mt-2 text-caption text-text-muted">
                Swaps Home&rsquo;s live-data card for the no-signal block, and puts the live view
                into its no-signal state.
              </p>
            </PanelSection>

            {injectableMovementStream && (
              <PanelSection title="Live movement">
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={injectSingleSample} className={ROW_CLASSES}>
                    Movement
                    <span className="block text-caption text-text-muted">one sample now</span>
                  </button>
                  <button type="button" onClick={injectActiveSpell} className={ROW_CLASSES}>
                    Active spell
                    <span className="block text-caption text-text-muted">
                      7 samples over ~8 seconds
                    </span>
                  </button>
                </div>
              </PanelSection>
            )}

            <PanelSection title="Voice note">
              <button
                type="button"
                onClick={attachDemoVoiceNote}
                className={`${ROW_CLASSES} flex items-center gap-2`}
              >
                <Microphone size={20} weight="light" aria-hidden="true" className="shrink-0" />
                <span>
                  Attach a demo voice note
                  <span className="block text-caption text-text-muted">
                    no microphone needed — attaches to the latest answer, or the closing note
                  </span>
                </span>
              </button>
            </PanelSection>

            <PanelSection title="Seeded activity data">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActivityVariant('quiet')}
                  aria-pressed={activityVariant === 'quiet'}
                  className={activityVariant === 'quiet' ? TOGGLE_ON_CLASSES : TOGGLE_OFF_CLASSES}
                >
                  Quiet
                </button>
                <button
                  type="button"
                  onClick={() => setActivityVariant('active')}
                  aria-pressed={activityVariant === 'active'}
                  className={activityVariant === 'active' ? TOGGLE_ON_CLASSES : TOGGLE_OFF_CLASSES}
                >
                  Active
                </button>
              </div>
            </PanelSection>

            <PanelSection title="Clock override">
              <p className="mb-2 text-caption text-text-muted">
                Now: {formatTimeForInput(now())}
                {clockOverride ? ' (overridden)' : ' (real time)'}
              </p>
              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setClockOverride(overrideAtHour(14))}
                  className={`${ROW_CLASSES} flex-1`}
                >
                  2pm
                </button>
                <button
                  type="button"
                  onClick={() => setClockOverride(overrideAtHour(2))}
                  className={`${ROW_CLASSES} flex-1`}
                >
                  2am
                </button>
                <button
                  type="button"
                  onClick={() => setClockOverride(null)}
                  className={`${ROW_CLASSES} flex-1`}
                >
                  Real time
                </button>
              </div>
              <label className="flex flex-wrap items-center gap-2 text-caption text-text-muted">
                Custom time
                <input
                  type="time"
                  onChange={handleTimeInputChange}
                  value={clockOverride ? formatTimeForInput(clockOverride) : ''}
                  className="tap flex-1 rounded-chip bg-surface-hi px-3 py-2 text-body text-text"
                />
              </label>
            </PanelSection>

            <section>
              <button
                type="button"
                onClick={resetState}
                className="press tap w-full rounded-chip border border-line bg-surface px-3 py-2 text-text"
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
