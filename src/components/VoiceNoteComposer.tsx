/**
 * The mic control and its recording state, inside the detail composer
 * (design-plan.md §15.3, §15.4, §15.5). Renders exactly one of:
 *
 *  - nothing, if the browser has no recording capability at all (§15.3);
 *  - the idle mic button;
 *  - the recording state (Stop glyph, breathing ring, static "Recording"
 *    label — no red, no live duration, no waveform);
 *  - the recorded note as a VoiceNoteBubble preview, with "Record again" /
 *    "Delete" beneath it;
 *  - the quiet CHECK_IN_MIC_UNAVAILABLE caption, if getUserMedia/MediaRecorder
 *    threw (permission denied, no device, ...).
 */

import { useState, type ReactElement } from 'react';
import { Microphone, Stop } from '@phosphor-icons/react';
import { canRecordVoiceNotes, useVoiceRecorder } from './useVoiceRecorder';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { VoiceNoteBubble } from './VoiceNoteBubble';
import { CHECK_IN_MIC_UNAVAILABLE } from '../data/clinicalContent';
import type { VoiceNote } from '../types';

export interface VoiceNoteComposerProps {
  voiceNote: VoiceNote | null;
  onChange: (note: VoiceNote | null) => void;
}

function revokeIfObjectUrl(note: VoiceNote | null): void {
  if (note?.url.startsWith('blob:')) {
    URL.revokeObjectURL(note.url);
  }
}

export function VoiceNoteComposer({ voiceNote, onChange }: VoiceNoteComposerProps): ReactElement | null {
  // Capability check at mount (§15.3) — computed once; never re-checked, so
  // a refusal later doesn't retroactively hide a capability that does exist.
  const [canRecord] = useState(canRecordVoiceNotes);
  const reduced = usePrefersReducedMotion();
  const recorder = useVoiceRecorder((note) => onChange(note));

  if (voiceNote) {
    return (
      <VoiceNoteBubble
        voiceNote={voiceNote}
        onRecordAgain={() => {
          revokeIfObjectUrl(voiceNote);
          onChange(null);
          recorder.start();
        }}
        onDelete={() => {
          revokeIfObjectUrl(voiceNote);
          onChange(null);
        }}
      />
    );
  }

  if (recorder.status === 'refused') {
    return <p className="text-caption text-text-muted">{CHECK_IN_MIC_UNAVAILABLE}</p>;
  }

  if (!canRecord) {
    // An affordance that was never offered needs no apology (§15.3).
    return null;
  }

  if (recorder.status === 'recording') {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={recorder.stop}
          aria-label="Stop recording"
          className="tap relative flex items-center justify-center rounded-pill bg-surface-hi text-accent"
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 rounded-pill ${
              reduced ? '' : 'animate-breath'
            }`}
            style={{
              border: '1.5px solid var(--lamp-4)',
              opacity: reduced ? 1 : undefined,
            }}
          />
          <Stop size={24} weight="light" aria-hidden="true" />
        </button>
        <span className="text-caption text-text-muted">Recording</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={recorder.start}
      aria-label="Record a voice note"
      className="tap flex items-center justify-center rounded-pill bg-surface-hi text-accent"
    >
      <Microphone size={24} weight="light" aria-hidden="true" />
    </button>
  );
}
