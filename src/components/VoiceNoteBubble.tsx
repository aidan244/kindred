/**
 * A recorded voice note, drawn as one of HER bubbles — handoff README, "05
 * Check-in — in her own words": "Recorded state: a right-aligned voice-note
 * bubble (surface-hi, radius `22 22 14 22`) with a play button."
 *
 * Same geometry as every other bubble she owns (README, "Spacing, radii,
 * geometry": hers `22 22 14 22`, padding 16, max-width 85%), because that is
 * the whole point of the recorded state: what she recorded becomes a thing she
 * said, sitting in the conversation next to the things she typed and the
 * options she chose. It is not an "attachment" with a filename and a size.
 *
 * Used in two places with the same shape:
 *  - inside the composer as the pre-send preview, where "Record again" and
 *    "Delete" sit beneath it (src/components/Composer.tsx);
 *  - in the conversation transcript once sent, with neither
 *    (src/screens/triage/CheckInConversation.tsx), because a message she has
 *    already sent is changed through "Change this", not through controls that
 *    linger under it.
 *
 * NOTHING HERE DESCRIBES THE RECORDING. The bubble states that a voice note
 * exists and how long it is, and stops: no transcript, no waveform, no
 * "sounds like", no automatic anything. The clinic listens to it; the app has
 * no opinion about it.
 */

import type { ReactElement } from 'react';
import { Microphone } from '@phosphor-icons/react';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import {
  VOICE_NOTE_DELETE_LABEL,
  VOICE_NOTE_LABEL,
  VOICE_NOTE_RECORD_AGAIN_LABEL,
} from '../data/clinicalContent';
import type { VoiceNote } from '../types';

/* All three labels are VISIBLY RENDERED, not aria-only, so they are words she
 * reads and they live in src/data/clinicalContent.ts with the rest of the
 * voice. */

/** `m:ss` — e.g. `0:14`. A settled fact, never a live readout. */
export function formatVoiceNoteDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface VoiceNoteBubbleProps {
  voiceNote: VoiceNote;
  /** Only present pre-send, inside the composer. */
  onRecordAgain?: () => void;
  onDelete?: () => void;
}

export function VoiceNoteBubble({
  voiceNote,
  onRecordAgain,
  onDelete,
}: VoiceNoteBubbleProps): ReactElement {
  return (
    <div className="flex flex-col items-end gap-2">
      {/* `flex-wrap` rather than a fixed row: at 200% text the play control,
          the label and the duration cannot share a line inside 85% of a
          390px screen, and the README's rule is that copy wraps rather than
          truncates. The bubble has a min-height only through `tap` on the
          play button, so it grows with its contents. */}
      <div
        className="ml-auto flex max-w-[85%] flex-wrap items-center gap-3 bg-surface-hi p-4 text-text"
        style={{ borderRadius: 'var(--r-card) var(--r-card) var(--r-chip) var(--r-card)' }}
      >
        <VoiceNotePlayer voiceNote={voiceNote} />
        <span className="text-body text-text">{VOICE_NOTE_LABEL}</span>
        <span className="text-caption text-text-muted">
          {formatVoiceNoteDuration(voiceNote.durationSeconds)}
        </span>
      </div>
      {(onRecordAgain || onDelete) && (
        <div className="flex flex-wrap items-center justify-end gap-4">
          {onRecordAgain && (
            <button
              type="button"
              onClick={onRecordAgain}
              className="press tap px-2 text-caption text-accent"
            >
              {VOICE_NOTE_RECORD_AGAIN_LABEL}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="press tap px-2 text-caption text-accent"
            >
              {VOICE_NOTE_DELETE_LABEL}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The review screen's attachment row — a row, not a bubble. The review
 * (README §06) carries no chat grammar at all: it is three surface cards with
 * a label, an answer and "Change this", so a right-aligned speech bubble
 * would be borrowing a voice from the wrong screen. The note is listed as
 * part of an answer instead, and is changed through the card's own
 * "Change this" control rather than deleted from here.
 */
export function VoiceNoteAttachmentRow({ voiceNote }: { voiceNote: VoiceNote }): ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-chip bg-surface-hi p-3">
      <Microphone size={20} weight="light" aria-hidden="true" className="shrink-0 text-accent" />
      <span className="text-body text-text">{VOICE_NOTE_LABEL}</span>
      <span className="text-caption text-text-muted">
        {formatVoiceNoteDuration(voiceNote.durationSeconds)}
      </span>
      <VoiceNotePlayer
        voiceNote={voiceNote}
        className="press tap ml-auto flex shrink-0 items-center justify-center rounded-pill bg-surface text-accent"
      />
    </div>
  );
}
