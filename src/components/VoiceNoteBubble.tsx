/**
 * Renders a VoiceNote as one of "her" bubbles (design-plan.md §15.4) — same
 * geometry as the conversation's other her-bubbles (§14.4): right-aligned,
 * bg-surface-hi, 85% max width, the asymmetric bottom-left corner. Used both
 * as the pre-send preview inside the detail composer (with "Record again" /
 * "Delete" beneath it) and as the permanent transcript bubble once sent.
 */

import type { ReactElement } from 'react';
import { Microphone } from '@phosphor-icons/react';
import { VoiceNotePlayer } from './VoiceNotePlayer';
import type { VoiceNote } from '../types';

/** `m:ss` — e.g. `0:14`. A settled fact, never a live readout. */
export function formatVoiceNoteDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export interface VoiceNoteBubbleProps {
  voiceNote: VoiceNote;
  /** Only present pre-send, inside the composer (§15.4). */
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
      <div
        className="ml-auto flex max-w-[85%] items-center gap-3 bg-surface-hi px-4 py-3 text-text"
        style={{ borderRadius: 'var(--r-card) var(--r-card) var(--r-chip) var(--r-card)' }}
      >
        <VoiceNotePlayer voiceNote={voiceNote} />
        <span className="text-body text-text">Voice note</span>
        <span className="text-caption text-text-muted">
          {formatVoiceNoteDuration(voiceNote.durationSeconds)}
        </span>
      </div>
      {(onRecordAgain || onDelete) && (
        <div className="flex gap-4">
          {onRecordAgain && (
            <button
              type="button"
              onClick={onRecordAgain}
              className="tap px-2 text-caption text-accent"
            >
              Record again
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="tap px-2 text-caption text-accent">
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The review screen's attachment row (§15.6) — a row, not a bubble; the
 * review carries no chat grammar (§14.8). Not deletable from here; editing
 * is via the card's existing "Edit" control. */
export function VoiceNoteAttachmentRow({ voiceNote }: { voiceNote: VoiceNote }): ReactElement {
  return (
    <div className="flex items-center gap-3 rounded-chip bg-surface-hi p-3">
      <Microphone size={20} weight="light" aria-hidden="true" className="text-accent" />
      <span className="text-body text-text">Voice note</span>
      <span className="text-caption text-text-muted">
        {formatVoiceNoteDuration(voiceNote.durationSeconds)}
      </span>
      <VoiceNotePlayer
        voiceNote={voiceNote}
        className="tap ml-auto flex shrink-0 items-center justify-center rounded-pill bg-surface text-accent"
      />
    </div>
  );
}
