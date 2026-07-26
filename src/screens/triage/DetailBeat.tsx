/**
 * The detail beat's composer (design-plan.md §15.2; handoff README screen
 * 05) — inline, scrolls with the conversation, NEVER docked: the dock
 * belongs to the emergency control alone, on every screen of this flow.
 *
 * This is now a thin wrapper, not a composer. The composer itself is one
 * shared component (src/components/Composer.tsx) used by screens 03 and 05
 * so the two are the same object rather than two things that look alike —
 * see HANDOFF_CONTRACT.md. Composer is fully controlled; this wrapper owns
 * the draft (text + voice note) for the beat it belongs to, which is what
 * lets the conversation mount a composer per category without a shared draft
 * leaking from one beat into the next.
 *
 * Three shapes come out of the same component, decided entirely by which
 * optional actions the caller supplies:
 *  - screen 05's detail beat: `skipLabel` ("Skip this" / "Nothing to add") —
 *    the beat is optional and must always have a way past it;
 *  - screen 03's "Add more info": `leftActionLabel`
 *    (CHECK_IN_BACK_TO_OPTIONS), which returns to the chip row;
 *  - the closing beat re-opened from review: `initialText` /
 *    `initialVoiceNote`, so "Change this" reopens what she already wrote
 *    rather than a blank field.
 *
 * Nothing here evaluates or reacts to what she types.
 */

import { useState, type ReactElement } from 'react';
import { Composer } from '../../components/Composer';
import type { VoiceNote } from '../../types';

export interface DetailBeatProps {
  /** Unique per mounted composer — Composer builds its field ids from it. */
  id: string;
  /** Screen-reader label for the field: the bot line this beat answers. */
  ariaLabel: string;
  /** Present only where the beat is skippable (screen 05). */
  skipLabel?: string;
  onSkip?: () => void;
  /** Present only on screen 03's "Add more info" composer. */
  leftActionLabel?: string;
  onLeftAction?: () => void;
  initialText?: string;
  initialVoiceNote?: VoiceNote | null;
  onSend: (text: string, voiceNote: VoiceNote | null) => void;
}

export function DetailBeat({
  id,
  ariaLabel,
  skipLabel,
  onSkip,
  leftActionLabel,
  onLeftAction,
  initialText = '',
  initialVoiceNote = null,
  onSend,
}: DetailBeatProps): ReactElement {
  const [text, setText] = useState(initialText);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(initialVoiceNote);

  return (
    <Composer
      id={id}
      value={text}
      onChange={setText}
      voiceNote={voiceNote}
      onVoiceNoteChange={setVoiceNote}
      leftActionLabel={leftActionLabel}
      onLeftAction={onLeftAction}
      skipLabel={skipLabel}
      onSkip={onSkip}
      // Trimmed here rather than in the composer: what reaches the report is
      // this flow's decision, and "  " must record as nothing rather than as
      // something she said.
      onSend={(sentText, sentVoiceNote) => onSend(sentText.trim(), sentVoiceNote)}
      ariaLabel={ariaLabel}
    />
  );
}
