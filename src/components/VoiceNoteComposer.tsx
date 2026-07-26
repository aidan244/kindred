/**
 * The voice-note half of the composer — handoff README, "05 Check-in — in her
 * own words" ("Recording state: the mic becomes Stop and gains a 1.5px lamp-4
 * ring breathing on the same 9s cycle. No red, no live duration, no
 * waveform.").
 *
 * SHAPE: a hook plus one button, rather than the single self-contained block
 * this file used to be. The README puts the two halves of the voice-note
 * affordance in two different places inside the composer card — the recorded
 * note is a bubble sitting directly under the text field, while the mic is an
 * item in the action row alongside Send — and a single component cannot
 * render into two parents. Splitting the recorder STATE (the hook) from the
 * mic CONTROL (the button) lets Composer.tsx place each piece where the
 * README puts it while there is still exactly one recorder driving both.
 *
 * LOAD-BEARING BEHAVIOUR, CARRIED OVER UNCHANGED from the previous shape of
 * this file — restyling must not quietly drop any of it:
 *
 *  - Capability check at mount, computed ONCE (`useState(canRecordVoiceNotes)`).
 *    It is never re-checked, so a refusal later cannot retroactively hide a
 *    capability that does exist.
 *  - If the browser has no recording capability at all, the mic is not
 *    rendered: an affordance that was never offered needs no apology.
 *  - If getUserMedia/MediaRecorder threw (permission denied, no device, blocked
 *    by policy), the mic is replaced in place by the quiet
 *    CHECK_IN_MIC_UNAVAILABLE caption. Never a dialog, never a toast, never a
 *    retry button — and note the caption already tells her she can type
 *    instead, so the composer stays fully usable.
 *  - Object URLs are revoked on delete and on record-again, so a discarded
 *    recording does not leak for the life of the tab. A note handed UPWARD by
 *    Send is never revoked here — the caller owns it from that moment on.
 *
 * NO HAPTIC on the mic or Stop (src/logic/haptics.ts: the tick fires on chip
 * select and on send only), and no red anywhere: the recording state is a warm
 * accent ring, because starting a recording is not an alarm.
 */

import { useState, type ReactElement } from 'react';
import { Microphone, Stop } from '@phosphor-icons/react';
import {
  canRecordVoiceNotes,
  useVoiceRecorder,
  type VoiceRecorderStatus,
} from './useVoiceRecorder';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import {
  CHECK_IN_MIC_UNAVAILABLE,
  VOICE_NOTE_RECORD_ACCESSIBLE_LABEL,
  VOICE_NOTE_STOP_ACCESSIBLE_LABEL,
} from '../data/clinicalContent';
import type { VoiceNote } from '../types';

/** Everything Composer needs to drive and describe one voice note. */
export interface VoiceNoteRecording {
  /** False when the browser cannot record at all — the mic is then not
   *  offered, and "Record again" must not be offered on the bubble either. */
  available: boolean;
  status: VoiceRecorderStatus;
  start: () => void;
  stop: () => void;
  /** Drop the current note (revoking its object URL) and record a new one. */
  recordAgain: () => void;
  /** Drop the current note and revoke its object URL. */
  discard: () => void;
}

/** Only a URL this app minted can be revoked; the demo panel injects a data:
 *  URL, which has no handle to release. */
function revokeIfObjectUrl(note: VoiceNote | null): void {
  if (note?.url.startsWith('blob:')) {
    URL.revokeObjectURL(note.url);
  }
}

export function useVoiceNoteRecording(
  voiceNote: VoiceNote | null,
  onChange: (note: VoiceNote | null) => void
): VoiceNoteRecording {
  const [available] = useState(canRecordVoiceNotes);
  const recorder = useVoiceRecorder((note) => onChange(note));

  return {
    available,
    status: recorder.status,
    start: recorder.start,
    stop: recorder.stop,
    recordAgain: () => {
      revokeIfObjectUrl(voiceNote);
      onChange(null);
      recorder.start();
    },
    discard: () => {
      revokeIfObjectUrl(voiceNote);
      onChange(null);
    },
  };
}

export interface VoiceNoteMicButtonProps {
  recording: VoiceNoteRecording;
}

/**
 * The 56x56 pill in the composer's action row: mic, or Stop-with-a-breathing-
 * ring while recording, or the quiet unavailable caption, or nothing at all.
 * The rectangle never moves between those states — only the glyph and the ring
 * change — so the control does not jump under her thumb mid-tap.
 */
export function VoiceNoteMicButton({ recording }: VoiceNoteMicButtonProps): ReactElement | null {
  const reduced = usePrefersReducedMotion();

  if (recording.status === 'refused') {
    return <p className="text-caption text-text-muted">{CHECK_IN_MIC_UNAVAILABLE}</p>;
  }

  if (!recording.available) {
    return null;
  }

  const isRecording = recording.status === 'recording';

  return (
    <button
      type="button"
      onClick={isRecording ? recording.stop : recording.start}
      aria-label={isRecording ? VOICE_NOTE_STOP_ACCESSIBLE_LABEL : VOICE_NOTE_RECORD_ACCESSIBLE_LABEL}
      className="press tap relative flex shrink-0 items-center justify-center rounded-pill bg-surface-hi text-accent"
    >
      {isRecording && (
        // The one signal that recording is live: a 1.5px lamp-4 ring on the
        // canonical 9s breath. No duration readout and no waveform on purpose
        // — both turn "say what you want" into a performance against a clock.
        // Held static under reduced motion rather than removed, so the state
        // is still visible (README, motion_and_accessibility).
        // `data-reduced-keep` matches Aura, SessionRing and PairingStep: the
        // stylesheet (src/index.css) documents it as the guard that stops the
        // global reduced-motion rule from ever re-animating a held-static
        // element at 0.01ms, which would strobe rather than calm. Dropping the
        // animation class alone happens to be enough TODAY — with no
        // animation-name there is nothing to clamp — but that is a property of
        // this markup, not a rule, and re-adding any animation class here
        // would silently produce the strobe.
        <span
          aria-hidden="true"
          data-reduced-keep={reduced ? '' : undefined}
          className={`pointer-events-none absolute inset-0 rounded-pill ${
            reduced ? '' : 'animate-breath'
          }`}
          style={{ border: '1.5px solid var(--lamp-4)', opacity: reduced ? 1 : undefined }}
        />
      )}
      {isRecording ? (
        <Stop size={24} weight="light" aria-hidden="true" />
      ) : (
        <Microphone size={24} weight="light" aria-hidden="true" />
      )}
    </button>
  );
}
