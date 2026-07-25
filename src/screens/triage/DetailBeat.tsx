/**
 * The detail beat's composer (design-plan.md §15.2) — inline, scrolls with
 * the conversation, never docked (the dock belongs to the emergency
 * control). Used identically for the per-question auto-detail beat and the
 * closing free-text beat; only the skip label and initial values differ.
 *
 * Nothing here evaluates or reacts to what she types — it only decides
 * whether Send is enabled (text or a voice note present) and hands the
 * result upward on Send/Skip.
 */

import { useState, type ReactElement } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import { VoiceNoteComposer } from '../../components/VoiceNoteComposer';
import type { VoiceNote } from '../../types';

export interface DetailBeatProps {
  id: string;
  skipLabel: string;
  initialText?: string;
  initialVoiceNote?: VoiceNote | null;
  onSend: (text: string, voiceNote: VoiceNote | null) => void;
  onSkip: () => void;
}

export function DetailBeat({
  id,
  skipLabel,
  initialText = '',
  initialVoiceNote = null,
  onSend,
  onSkip,
}: DetailBeatProps): ReactElement {
  const [text, setText] = useState(initialText);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(initialVoiceNote);
  const textareaId = `${id}-detail-text`;

  const canSend = text.trim().length > 0 || voiceNote !== null;

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <label htmlFor={textareaId} className="sr-only">
        {skipLabel === 'Skip this' ? 'Anything you want to add about that' : 'Anything else your clinic should know'}
      </label>
      <textarea
        id={textareaId}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        placeholder="Type here"
        className="w-full resize-none bg-transparent text-body text-text placeholder:text-text-muted focus:outline-none"
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className={voiceNote ? 'w-full' : ''}>
          <VoiceNoteComposer voiceNote={voiceNote} onChange={setVoiceNote} />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button type="button" onClick={onSkip} className="tap px-2 text-label text-accent">
            {skipLabel}
          </button>
          <button
            type="button"
            onClick={() => onSend(text.trim(), voiceNote)}
            disabled={!canSend}
            className="tap flex items-center gap-2 rounded-pill bg-accent px-6 text-label text-on-accent disabled:opacity-55"
          >
            <PaperPlaneRight size={20} weight="light" aria-hidden="true" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
