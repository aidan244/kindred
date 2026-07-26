/**
 * The composer — handoff README, "05 Check-in — in her own words", and the
 * SAME component inline on "03 Check-in — the first gate" behind the
 * "Add more info" chip ("see 05 for the identical component").
 *
 * ONE component for both beats, deliberately. 03 and 05 are the same act — she
 * answers in her own words instead of picking an option — so they must never
 * drift into two slightly different text boxes with two slightly different
 * Send buttons. The only thing that varies is which optional side action is
 * present:
 *
 *   - 03 passes `leftActionLabel` ("Back to the options"), the way back to the
 *     chip row this composer replaced. Chips and composer are mutually
 *     exclusive (README, "Interactions & Behaviour" — `moreOpen`), so there
 *     has to be a way back that is not the browser's back button.
 *   - 05 passes `skipLabel` ("Skip this"): the detail beat is optional and
 *     must always be leaveable in one tap.
 *
 * Two optional props rather than a `variant` enum, so the closing free-text
 * beat (Skip, no Back) and a caller that wants neither are already expressible
 * without anyone adding a third case.
 *
 * FULLY CONTROLLED. `value` and `voiceNote` live in the caller, not here, for
 * two reasons: re-opening the composer to change an answer must show what she
 * wrote last time, and the conversation — not the text box — owns the record
 * of what she has said. This component holds no state of its own beyond the
 * recorder's.
 *
 * INLINE, NEVER DOCKED (README §05: "Inline, scrolls with the conversation —
 * never docked; the dock belongs to the emergency control alone"). Nothing
 * here is fixed or absolute and nothing measures the viewport; the screen
 * places it in the conversation flow and carries the dock clearance itself.
 *
 * NOTHING HERE READS WHAT SHE TYPES. The single derived fact is `canSend` —
 * whether there is anything at all to send. No validation, no counters, no
 * length limit, no reaction to content: an empty composer is a legitimate
 * state, not an error, and there is no error state in this component at all
 * (which is also why the emergency red can never appear here).
 */

import type { ReactElement } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import { COMPOSER_PLACEHOLDER, COMPOSER_SEND_LABEL } from '../data/clinicalContent';
import { hapticTick } from '../logic/haptics';
import { VoiceNoteBubble } from './VoiceNoteBubble';
import { useVoiceNoteRecording, VoiceNoteMicButton } from './VoiceNoteComposer';
import type { VoiceNote } from '../types';

export interface ComposerProps {
  /** Namespaces this composer's DOM ids; the field itself is `${id}-text`. */
  id: string;
  value: string;
  onChange: (value: string) => void;
  voiceNote: VoiceNote | null;
  onVoiceNoteChange: (note: VoiceNote | null) => void;
  /** Screen 03 only: "Back to the options". Renders next to the mic. */
  leftActionLabel?: string;
  onLeftAction?: () => void;
  /** Screen 05's optional beat: "Skip this". */
  skipLabel?: string;
  onSkip?: () => void;
  onSend: (text: string, voiceNote: VoiceNote | null) => void;
  /** Screen-reader label for the textarea. */
  ariaLabel: string;
}

export function Composer({
  id,
  value,
  onChange,
  voiceNote,
  onVoiceNoteChange,
  leftActionLabel,
  onLeftAction,
  skipLabel,
  onSkip,
  onSend,
  ariaLabel,
}: ComposerProps): ReactElement {
  const recording = useVoiceNoteRecording(voiceNote, onVoiceNoteChange);
  const textareaId = `${id}-text`;

  // Either kind of content counts: a voice note alone is a complete answer.
  const canSend = value.trim().length > 0 || voiceNote !== null;

  const handleSend = (): void => {
    if (!canSend) {
      return;
    }
    hapticTick();
    onSend(value.trim(), voiceNote);
  };

  return (
    <div className="w-full rounded-card border border-line bg-surface p-4">
      {/*
        The field grows with what she writes — README: no fixed height, no
        truncation, and it has to survive 200% text scaling.

        Done with a hidden sizer stacked under the textarea in the same grid
        cell rather than with a scrollHeight measurement in an effect: the
        sizer is ordinary flowed text, so the browser re-lays it out for free
        on a width change, an orientation change, a font swap or a text-scale
        change. A JS measurement only re-runs when we remember to re-run it,
        and the one time it would be wrong is exactly the 200%-scale case the
        invariant names.

        The sizer falls back to the PLACEHOLDER when the field is empty, so
        the resting height is whatever the placeholder actually needs at her
        text size — at 200% "Type here" may well take two lines, and a box
        sized to one would clip it.

        The trailing space keeps a final newline from collapsing, so pressing
        Enter opens the next line before she types into it. `white-space` and
        `overflow-wrap` are set inline to match the UA's own textarea
        defaults exactly; if the two disagreed by one wrap the height would be
        off by a line.

        `tap` on the textarea, like every other control in the product: it is
        the primary text-entry control on screens 03 and 05, Tailwind's
        preflight zeroes a textarea's padding, and one line of `text-body` is
        ~29px — less than the 56x56 floor, on a field that must be hittable by
        someone whose hands are shaking. The card's own `p-4` is NOT part of
        the field, so tapping the padding does not focus it. The grid row
        takes the max of the sizer and this minimum, so the field rests at
        56px and the sizer drives it taller from there.
      */}
      <div className="grid">
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 text-body"
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
        >
          {value.length > 0 ? `${value} ` : COMPOSER_PLACEHOLDER}
        </span>
        <textarea
          id={textareaId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={COMPOSER_PLACEHOLDER}
          aria-label={ariaLabel}
          rows={1}
          className="tap col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent text-body text-text placeholder:text-text-muted focus:outline-none"
          style={{ overflowWrap: 'break-word' }}
        />
      </div>

      {/* Recorded state (README §05): her own note, as one of her bubbles,
          directly under the field. "Record again" is withheld when the
          browser cannot record — she may be looking at the demo panel's
          injected note on a device with no microphone. */}
      {voiceNote !== null && (
        <div className="mt-4">
          <VoiceNoteBubble
            voiceNote={voiceNote}
            onRecordAgain={recording.available ? recording.recordAgain : undefined}
            onDelete={recording.discard}
          />
        </div>
      )}

      {/*
        The action row, 16px below the field. The README draws it as
        space-between; it is built as "left group, then right group with
        ml-auto" so that at 200% text — where the mic, "Back to the options",
        "Skip this" and "Send" cannot share a line at any width — the groups
        wrap and each stays on its own side instead of overlapping. Same
        picture when it fits, no clipping when it does not.
      */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* The mic stands down once there is a note: the bubble's own
              "Record again" / "Delete" take over, so there are never two
              controls that start a recording. */}
          {voiceNote === null && <VoiceNoteMicButton recording={recording} />}
          {leftActionLabel !== undefined && onLeftAction !== undefined && (
            <button
              type="button"
              onClick={onLeftAction}
              className="press tap px-2 text-label text-accent"
            >
              {leftActionLabel}
            </button>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
          {skipLabel !== undefined && onSkip !== undefined && (
            <button type="button" onClick={onSkip} className="press tap px-2 text-label text-accent">
              {skipLabel}
            </button>
          )}
          {/* Send is quieted to 0.55 while there is nothing to send, never
              hidden and never re-labelled: the shape of the beat stays the
              same whether or not she has written anything yet. */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="press tap flex items-center justify-center gap-2 rounded-pill bg-accent px-6 text-label text-on-accent disabled:opacity-55"
          >
            <PaperPlaneRight size={20} weight="light" aria-hidden="true" className="shrink-0" />
            {COMPOSER_SEND_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
