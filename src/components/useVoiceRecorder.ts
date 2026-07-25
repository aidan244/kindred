/**
 * MediaRecorder wrapper for the detail beat's voice-note affordance
 * (design-plan.md §15.3, §15.4). Kept separate from any component so the
 * capability check, start/stop lifecycle and duration math are testable in
 * isolation from JSX.
 *
 * Safety rules this hook exists to honour:
 *  - Duration comes from `performance.now()` deltas, never `audio.duration`
 *    (Chrome reports Infinity for a webm blob it recorded itself).
 *  - The stream's tracks are stopped immediately on stop, so the OS
 *    microphone indicator never stays lit after she's done.
 *  - Any failure — permission denied, no device, a throw from
 *    getUserMedia or the MediaRecorder constructor — lands in a single
 *    'refused' status. Nothing here throws back at the caller.
 */

import { useCallback, useRef, useState } from 'react';
import type { VoiceNote } from '../types';

/** Capability check at mount, before rendering any mic affordance (§15.3). */
export function canRecordVoiceNotes(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

export type VoiceRecorderStatus = 'idle' | 'recording' | 'refused';

export interface VoiceRecorder {
  status: VoiceRecorderStatus;
  start: () => void;
  stop: () => void;
}

export function useVoiceRecorder(onRecorded: (note: VoiceNote) => void): VoiceRecorder {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startMarkRef = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const start = useCallback((): void => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream);
        } catch {
          stream.getTracks().forEach((track) => track.stop());
          setStatus('refused');
          return;
        }
        streamRef.current = stream;
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };
        recorder.onstop = () => {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const url = URL.createObjectURL(blob);
          // Whole seconds, floored at 1 — never audio.duration (see file
          // header). Rounded rather than floored so a quick tap-stop still
          // reads as "1s" rather than "0s".
          const durationSeconds = Math.max(
            1,
            Math.round((performance.now() - startMarkRef.current) / 1000)
          );
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          recorderRef.current = null;
          setStatus('idle');
          onRecordedRef.current({ url, durationSeconds, mimeType });
        };
        startMarkRef.current = performance.now();
        recorder.start();
        setStatus('recording');
      })
      .catch(() => {
        setStatus('refused');
      });
  }, []);

  const stop = useCallback((): void => {
    recorderRef.current?.stop();
  }, []);

  return { status, start, stop };
}
