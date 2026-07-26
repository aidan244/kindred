/**
 * LiveDataCard — Home's live-data card (handoff README, screen 01 point 4,
 * reused on screen 02).
 *
 * The card is the whole of what Home says about the band: a number, a shape,
 * two orientation labels and a way into the live view. It states and it stops.
 * There is no summary line, no score, no trend arrow, no "looks normal" and no
 * "check this" — the one interpretation the product is allowed to make lives
 * in the triage conversation, where a clinician's question set is doing the
 * asking.
 *
 * WHY THE CARD FETCHES ITS OWN WINDOW. `LiveDataCardProps` deliberately has no
 * `window` prop (see HANDOFF_CONTRACT.md): screens 01 and 02 are the same card
 * showing the same 24-hour window, and threading it through two screens would
 * let them drift apart. The card owns the span/step and reads the sensor
 * boundary directly.
 *
 * WHY IT DOES NOT TICK. `getHeartRateWindow` is described at the boundary as
 * "a record of the day, not a live edge", and it snaps to its own step grid,
 * so re-reading it every few seconds would return an identical window and
 * repaint for nothing. It is read once per mount, and again if the variant or
 * the band's signal changes. The place where a heart rate updates in front of
 * her is the live view, which she opens on purpose.
 *
 * `showNumber` hides the number row ALONE (screen 02, where the alert block is
 * the focus). The trace, the micro labels and the way into the live view are
 * on both screens — the card is one card in two weights, not two cards.
 *
 * THE OFFLINE VARIANT is a statement about the hardware and never about the
 * baby: the mark, the clock of the last sample the band sent, and the one
 * thing she can actually do about it. Nothing is drawn where the trace was —
 * no flat line, no dimmed copy of the last trace, no "waiting" shimmer.
 */

import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';
import { BandMark } from './BandMark';
import { HeartRateTrace } from './HeartRateTrace';
import { useAppState } from '../context/AppStateContext';
import {
  BAND_OFFLINE_NO_CLOCK,
  bandOfflineCopy,
  HOME_BPM_UNIT,
  HOME_HEART_RATE_LABEL,
  HOME_OPEN_LIVE_VIEW,
  HOME_TRACE_START_LABEL,
  TRACE_NOW_LABEL,
} from '../data/clinicalContent';
import { getMovementStream } from '../sensors/MovementStream';
import { formatClock } from '../screens/reportAssembly';

export interface LiveDataCardProps {
  /** false on screen 02: the alert is the focus, so the card shows the
   *  trace and micro labels only. */
  showNumber: boolean;
  onOpenLiveView: () => void;
}

/** The window behind Home's trace: 24 hours at ten-minute resolution. The
 * resolution is the one src/data/seedHeartRate.ts's header names for this
 * screen, and it is what keeps Home and the live view looking at the same
 * underlying signal at two different scales. */
const HOME_SPAN_MINUTES = 24 * 60;
const HOME_STEP_SECONDS = 600;

/* Two band-offline sentences, both in src/data/clinicalContent.ts:
 * `bandOfflineCopy()` names the clock of the last sample the band sent, which
 * is the right thing to say in every case but one — the card mounted with the
 * band already quiet, so this session never saw a sample and there is no
 * honest clock to quote. `BAND_OFFLINE_NO_CLOCK` is that case: same voice,
 * same two facts, one fewer claim. */

export function LiveDataCard({ showNumber, onOpenLiveView }: LiveDataCardProps): ReactElement {
  const { activityVariant, bandOffline } = useAppState();

  // `bandOffline` is a dependency even though it is not read inside: the
  // sensor boundary owns whether the band is reporting, and app state mirrors
  // it (see AppStateContext's setBandOffline). Listing it here is what makes
  // the card re-read the boundary the moment the band goes quiet or returns.
  const heartRateWindow = useMemo(
    () =>
      getMovementStream(activityVariant).getHeartRateWindow(HOME_SPAN_MINUTES, HOME_STEP_SECONDS),
    [activityVariant, bandOffline]
  );

  const samples = heartRateWindow.samples;
  const latest = samples.length > 0 ? samples[samples.length - 1] : null;

  // The last instant the band actually reported. An offline band returns an
  // empty window — the boundary will not synthesise a trailing sample — so the
  // card remembers the last one it saw and quotes that clock afterwards. The
  // effect runs after the render that had the sample, so the value is already
  // in hand on the render where the signal drops.
  const lastSignalAt = useRef<Date | null>(null);
  useEffect(() => {
    if (latest) {
      lastSignalAt.current = latest.timestamp;
    }
  }, [latest]);

  const offlineCaption = lastSignalAt.current
    ? bandOfflineCopy(formatClock(lastSignalAt.current))
    : BAND_OFFLINE_NO_CLOCK;

  return (
    <div className="rounded-card bg-surface px-4 pt-[22px] pb-4">
      {/* The card follows the data, not the flag: if the window is empty there
          is nothing to draw, whatever app state believes about the band. */}
      {latest ? (
        <>
          {showNumber && (
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-baseline gap-2">
                {/* One of the system's two ad-hoc numeric sizes (handoff
                    README, "Typography"): 56 / 1.0 / -0.03em / 300. It is not
                    a type role because it appears exactly twice in the whole
                    product — here, and at 96 on the live view — and giving it
                    a role name would invite a third use.
                    Written in rem rather than px for the same reason every
                    role in src/index.css's @theme is: 3.5rem IS the README's
                    56px, and it still scales when she has turned her text
                    size up. `break-words` because at 200% a three-digit
                    numeral at this size can outgrow the column, and it must
                    wrap rather than be clipped. */}
                <span className="text-[3.5rem] leading-none font-light tracking-[-0.03em] break-words text-text">
                  {latest.bpm}
                </span>
                <span className="text-caption text-text-muted">{HOME_BPM_UNIT}</span>
              </div>
              <span className="text-caption text-text-muted">{HOME_HEART_RATE_LABEL}</span>
            </div>
          )}

          {/* Geometry, gradient and the live dot are all HeartRateTrace's. */}
          <HeartRateTrace window={heartRateWindow} variant="card" className="block" />

          {/* The two ends of the window — the only place the micro role is
              used (handoff README, "Typography"). They live INSIDE this
              branch: an x axis spanning 24 hours with nothing plotted on it is
              the labelled empty frame HeartRateTrace refuses to draw ("not a
              flat line at zero, not an empty frame with labels"), and it
              would quietly imply a window that was measured and came back
              flat. They label the data; when the data goes, they go. */}
          <div className="mt-3 flex items-start justify-between gap-4">
            <span className="text-micro text-text-muted">{HOME_TRACE_START_LABEL}</span>
            <span className="text-micro text-text-muted">{TRACE_NOW_LABEL}</span>
          </div>
        </>
      ) : (
        // The README's 96px block. min-height, never height: at 200% text the
        // caption wraps to three lines and must push the block taller rather
        // than be clipped inside it.
        <div className="flex min-h-24 flex-col items-center justify-center gap-3 py-2">
          <BandMark size={34} className="text-accent" />
          <span className="text-center text-caption text-text-muted">{offlineCaption}</span>
        </div>
      )}

      {/* A row-button, not a pill: it belongs to the card, and the dock's pill
          is the one Speak-to-Kindred rectangle that must never have a
          lookalike competing with it for weight. */}
      <button
        type="button"
        onClick={onOpenLiveView}
        className="press tap mt-6 flex w-full items-center justify-between gap-3 rounded-card bg-surface-hi px-4 py-3 text-left text-label text-accent"
      >
        <span>{HOME_OPEN_LIVE_VIEW}</span>
        <ArrowUpRight size={20} weight="light" className="shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}
