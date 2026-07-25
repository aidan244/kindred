/**
 * A play/pause control bound to one VoiceNote's audio (design-plan.md
 * §15.4). Deliberately minimal: no scrubber, no waveform, no elapsed-time
 * readout, no progress bar during playback — playback is play or pause,
 * full stop.
 */

import { useRef, useState, type ReactElement } from 'react';
import { Pause, Play } from '@phosphor-icons/react';
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
      void audio.play();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className={
          className ??
          'tap flex shrink-0 items-center justify-center rounded-pill bg-surface text-accent'
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
