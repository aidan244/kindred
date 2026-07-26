/**
 * The play/pause control bound to one VoiceNote's audio — the "play button"
 * the handoff README asks for inside the recorded-state bubble (§05).
 *
 * Deliberately minimal: no scrubber, no waveform, no elapsed-time readout, no
 * progress bar during playback. Playback is play or pause, full stop. A
 * scrubber would invite her to review and re-record what she said until it
 * sounded right, which is the opposite of "in her own words".
 *
 * `playing` is driven by the audio element's own events rather than by the
 * click handler, so the glyph stays honest if playback ends on its own, is
 * interrupted by the OS, or never starts because `play()` was rejected.
 *
 * The default styling is the 56px accent pill the bubble wants; `className`
 * overrides it wholesale for the review screen's attachment row, which needs
 * the same behaviour in a different rectangle. An override must carry its own
 * `tap` and `press` — there is no merge here, by design, so that a caller
 * cannot end up with two conflicting size or radius utilities.
 */

import { useRef, useState, type ReactElement } from 'react';
import { Pause, Play } from '@phosphor-icons/react';
import {
  VOICE_NOTE_PAUSE_ACCESSIBLE_LABEL,
  VOICE_NOTE_PLAY_ACCESSIBLE_LABEL,
} from '../data/clinicalContent';
import type { VoiceNote } from '../types';

export interface VoiceNotePlayerProps {
  voiceNote: VoiceNote;
  className?: string;
}

export function VoiceNotePlayer({ voiceNote, className }: VoiceNotePlayerProps): ReactElement {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = (): void => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (playing) {
      audio.pause();
    } else {
      // A rejected play() (autoplay policy, a revoked object URL) leaves
      // `playing` false because nothing fired `onPlay` — no catch needed, and
      // nothing to say to her about it.
      void audio.play();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? VOICE_NOTE_PAUSE_ACCESSIBLE_LABEL : VOICE_NOTE_PLAY_ACCESSIBLE_LABEL}
        className={
          className ??
          'press tap flex shrink-0 items-center justify-center rounded-pill bg-surface text-accent'
        }
      >
        {playing ? (
          <Pause size={22} weight="light" aria-hidden="true" />
        ) : (
          <Play size={22} weight="light" aria-hidden="true" />
        )}
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- a voice
          note has no captionable track; it is her own recorded speech. */}
      <audio
        ref={audioRef}
        src={voiceNote.url}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </>
  );
}
