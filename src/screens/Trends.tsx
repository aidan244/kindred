/**
 * Trends — the weeks/days view of her baby's kicks, one level up from
 * Home's card (7 days) and the live view (12 hours). Not part of the
 * original handoff README's numbered screens; built from the same parts as
 * every other screen, and on KickTrace's 'trend' variant.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT RENDER — all three are hoisted, and
 * duplicating any of them would break the invariant it exists to protect:
 *  - the aura backdrop — mounted once in App (src/components/Aura.tsx);
 *  - the docked controls and the fade behind them — owned by the shared dock
 *    rectangle (src/components/Dock.tsx);
 *  - its own entrance animation — RouteTransition wraps the router.
 *
 * NO BIG NUMERAL, unlike the live view. That number exists there because
 * it's a live single-reading screen; a "see the shape of it over weeks"
 * screen is better served leading with the chart itself — title, trace,
 * micro start/end labels, nothing else.
 *
 * WHY IT DOES NOT TICK. Same reasoning as LiveDataCard.tsx: getTrendKickWindow
 * is a record of history, not a live edge, and it snaps to its own daily
 * grid, so re-reading it every few seconds would return an identical window
 * and repaint for nothing. It is read once per mount, and again if the
 * variant or the band's signal changes.
 */

import { useEffect, useMemo, useRef, type ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { BandMark } from '../components/BandMark';
import { CheckInControl } from '../components/CheckInControl';
import { Dock } from '../components/Dock';
import { KickTrace } from '../components/KickTrace';
import { useAppState } from '../context/AppStateContext';
import {
  BACK_LABEL,
  BAND_OFFLINE_NO_CLOCK,
  TRACE_NOW_LABEL,
  TRENDS_TITLE,
  TRENDS_TRACE_START_LABEL,
  bandOfflineCopy,
} from '../data/clinicalContent';
import { getMovementStream } from '../sensors/MovementStream';
import { formatClock } from './reportAssembly';

/** Matches the no-signal block's mark size on Home and the live view
 * (handoff README, screen 01's offline variant). */
const BAND_MARK_SIZE = 34;

export default function Trends(): ReactElement {
  const { activityVariant, bandOffline } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();

  // `bandOffline` is a dependency even though it is not read directly —
  // same reasoning as LiveDataCard.tsx: it is what makes this re-read the
  // boundary the moment the band goes quiet or returns.
  const kickWindow = useMemo(
    () => getMovementStream(activityVariant).getTrendKickWindow(),
    [activityVariant, bandOffline]
  );

  const samples = kickWindow.samples;
  const latest = samples.length > 0 ? samples[samples.length - 1] : null;

  // Mirrors LiveDataCard.tsx's lastSignalAt: the last instant the band
  // actually reported, remembered across a signal drop so the no-signal
  // copy can still name a clock rather than saying nothing at all.
  const lastSignalAt = useRef<Date | null>(null);
  useEffect(() => {
    if (latest) {
      lastSignalAt.current = latest.timestamp;
    }
  }, [latest]);

  const offlineCaption = lastSignalAt.current
    ? bandOfflineCopy(formatClock(lastSignalAt.current))
    : BAND_OFFLINE_NO_CLOCK;

  const handleBack = (): void => {
    // A real pop, so RouteTransition reverses the slide. `key === 'default'`
    // means this entry is the first in the session — someone opened
    // /trends directly — and there is nothing to pop, so go to Home
    // explicitly instead of doing nothing (mirrors LiveView.tsx).
    if (location.key === 'default') {
      navigate('/home');
      return;
    }
    navigate(-1);
  };

  return (
    <>
      {/* Same content shell as every other screen: padding, max width,
          centred, dock-safe. */}
      <div className="mx-auto w-full max-w-[var(--content-max)] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] dock-safe">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label={BACK_LABEL}
            className="press tap -ml-4 flex shrink-0 items-center justify-center text-text-muted"
          >
            <CaretLeft size={24} weight="light" aria-hidden="true" />
          </button>
          <h1 className="text-title text-text">{TRENDS_TITLE}</h1>
        </header>

        {latest ? (
          <>
            {/* Geometry, gradient and the dot are all KickTrace's; this
                screen only says which window and which variant. */}
            <KickTrace window={kickWindow} variant="trend" className="mt-6 block" />

            <div className="mt-2 flex items-start justify-between gap-4">
              <span className="text-micro text-text-muted">{TRENDS_TRACE_START_LABEL}</span>
              <span className="text-micro text-text-muted">{TRACE_NOW_LABEL}</span>
            </div>
          </>
        ) : (
          // The band is quiet. One line, about the hardware, never about the
          // baby — same block as Home's card and the live view.
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <BandMark size={BAND_MARK_SIZE} className="text-text-muted" />
            <p className="text-caption text-text-muted">{offlineCaption}</p>
          </div>
        )}
      </div>

      {/* Standard dock — Trends carries the same always-reachable
          Speak-to-Kindred bar as the live view, not a call control. */}
      <Dock>
        <CheckInControl variant="bar" />
      </Dock>
    </>
  );
}
