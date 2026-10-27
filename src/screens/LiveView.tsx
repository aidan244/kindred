/**
 * 08 Live view — "listening now" (handoff README, screen 08).
 *
 * A FULL REWRITE. This screen used to be a fixed-inset ambient surface
 * (`LiveSurface`, now deleted) that filled the viewport with movement rings
 * and carried almost no chrome. The handoff replaces it with an ordinary
 * scrolling screen built from the same parts as every other screen: a back
 * caret and a title, the live number, the trace, the session ring, and the
 * shared dock. Nothing here is positioned against the viewport any more.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT RENDER — all three are hoisted, and
 * duplicating any of them would break the invariant it exists to protect:
 *  - the aura backdrop — mounted once in App (src/components/Aura.tsx);
 *  - the docked controls and the fade behind them — owned by the shared dock
 *    rectangle (src/components/Dock.tsx). This screen renders `<Dock>` and its
 *    children are portalled there, so Speak to Kindred keeps the same
 *    rectangle in the same position as on every other screen, and the 184px
 *    fade the old implementation drew for itself is gone;
 *  - its own entrance animation — RouteTransition wraps the router.
 *
 * WHERE THE DATA COMES FROM. Everything on this screen is read through the
 * sensor boundary (src/sensors/MovementStream.ts) — there is not a single
 * literal reading anywhere in this file. The big number is the newest SETTLED
 * sample of the live window, i.e. the last reading the band has actually
 * confirmed, never a value taken from the still-arriving edge; the trace draws
 * the same window, greying that edge itself (see KickTrace). Both are
 * kept current by one modest poll, not by per-frame work.
 *
 * WHAT THIS SCREEN NEVER DOES. It shows the shape of the signal and stops: no
 * summary, no range, no verdict, no colour that changes with the number. The
 * only conditional sentence on the whole screen is about the hardware.
 *
 * MOTION. This screen animates nothing of its own. The single moving thing is
 * the data itself, which is why `usePrefersReducedMotion` is deliberately NOT
 * consulted here: honouring reduced motion by freezing a live readout would
 * quietly stop the live view while still calling itself live. The one ambient
 * loop on screen — the ring's breathing glow — is SessionRing's own business
 * and holds static there.
 */

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from '@phosphor-icons/react';
import { BandMark } from '../components/BandMark';
import { CheckInControl } from '../components/CheckInControl';
import { Dock } from '../components/Dock';
import { EmergencyCall } from '../components/EmergencyCall';
import { KickTrace } from '../components/KickTrace';
import { SessionRing } from '../components/SessionRing';
import { useAppState } from '../context/AppStateContext';
import {
  CLOSE_TO_HOME_LABEL,
  LIVE_VIEW_TITLE,
  LIVE_VIEW_TRACE_START_LABEL,
  LIVE_VIEW_UNIT_CAPTION,
  TRACE_HOUR_NOW_LABEL,
  bandOfflineCopy,
  liveViewSessionCaption,
} from '../data/clinicalContent';
import { getMovementStream } from '../sensors/MovementStream';
import { formatClock } from './reportAssembly';
import type { KickWindow } from '../types';

/** The window the README's live trace covers, and the resolution it is
 * sampled at: "12 hours ago" → "now", one tally an hour. Both are stated
 * here rather than inside the poll so the micro labels below the trace and
 * the data behind it can never drift apart. */

/**
 * How often the live window is re-read. One second, because that is exactly
 * the window's own step (above): the trace then advances by precisely one
 * sample per tick instead of jumping several at once, which is both the
 * calmest and the most honest way to draw a line that is genuinely arriving.
 * It is a poll on a timer, never per-frame work and never an animation —
 * nothing here is tied to rAF.
 */
const LIVE_POLL_INTERVAL_MS = 1000;

/** The session clock's tick. It shows mm:ss, so it has to be a second. */
const SESSION_TICK_MS = 1000;

/**
 * The listening session the ring draws its proportion against.
 *
 * DERIVED FROM THE README'S OWN TWO NUMBERS, not rounded off them. Screen 08
 * states `dashoffset 277` and the disc reading `04:11` on the same element,
 * and SessionRing computes `dashoffset = 364.4 x (1 - elapsed/total)`. So the
 * total the reference implies is 251 / (1 - 277/364.4) = 1046s (17:26). This
 * used to be `20 * 60`, "the nearest round number", which put dashoffset 277
 * at 04:48 instead — the README states three numbers that have to agree, and
 * rounding one of them by 15% quietly made the drawn reference unreachable.
 *
 * It is a DISPLAY PROPORTION ONLY — nothing clinical reads it, nothing stops
 * or completes when it is reached, and no copy anywhere promises her a session
 * length, so an unround number costs nothing. (The arc still starts empty on
 * arrival, because `elapsedSeconds` starts at 0: the reference draws one
 * moment of a live session, not its opening frame.) If a real product later
 * gets a genuine session definition, this constant is the one thing that has
 * to change.
 */
const SESSION_TOTAL_SECONDS = 1046;

/**
 * The one ad-hoc numeric size in the type system (handoff README,
 * "Typography": 96 / 1.0 / −0.032em / 300, the live view's own). It is
 * deliberately not a type role — src/index.css's `@theme` carries the seven
 * roles and nothing else — so it is written here, once, as the README states
 * it. In rem rather than px so it still scales with the reader's own font-size
 * setting, exactly like every token role does.
 */
const BPM_NUMERIC_TYPE: CSSProperties = {
  fontSize: '6rem', // 96px at the 16px root the whole scale is built on
  lineHeight: 1,
  letterSpacing: '-0.032em',
  fontWeight: 300,
};

/** The size the product draws the band mark at whenever it is standing in for
 * absent data (README §01's no-signal block uses the same 34px). */
const BAND_MARK_SIZE = 34;

export default function LiveView(): ReactElement {
  const { activityVariant, bandOffline, now } = useAppState();
  const navigate = useNavigate();

  // Seeded synchronously from the stream rather than from an empty window
  // filled in by an effect: an effect runs after paint, so the screen would
  // show one frame of the no-signal state before the data arrived — a false
  // statement about the hardware, however briefly.
  const [liveWindow, setLiveWindow] = useState<KickWindow>(() =>
    getMovementStream(activityVariant).getHourlyKickWindow()
  );

  // The session is the one she opened by arriving here; RouteTransition keys
  // on pathname, so a mount really is an arrival.
  const [sessionStartedAt] = useState<Date>(() => now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [quietSince, setQuietSince] = useState<Date | null>(null);

  // -- What the band is saying, right now --------------------------------
  // `hasSignal()` is read during render rather than polled, so the offline
  // state appears the instant the boundary's answer changes; `bandOffline`
  // (app state's mirror of the same fact) is what re-renders us.
  const stream = getMovementStream(activityVariant);
  const settledSample =
    liveWindow.settledIndex >= 0 ? liveWindow.samples[liveWindow.settledIndex] : undefined;
  // Two ways of being absent — the band is not reporting, or it is reporting
  // nothing — and they are the same state on screen. Absence is absence.
  const listening = stream.hasSignal() && settledSample !== undefined;

  // The no-signal line names a clock time, and the boundary reports only
  // whether the band is quiet NOW, never when it went quiet. So this latches
  // the first moment this screen saw it quiet and holds that until it comes
  // back — the honest answer available here, and the right one for the case
  // that matters (the band dropping while she is watching). Adjusted during
  // render, which React re-runs before painting, rather than in an effect,
  // which would paint one frame of "No signal since undefined".
  if (!listening && quietSince === null) {
    setQuietSince(now());
  } else if (listening && quietSince !== null) {
    setQuietSince(null);
  }

  // -- The poll ----------------------------------------------------------
  useEffect(() => {
    // Nothing to poll while the band is quiet: the boundary would only hand
    // back the same empty window. `bandOffline` is a dependency for exactly
    // that reason — it is what starts the poll again the moment the band
    // comes back, with a read straight away rather than a tick later.
    if (bandOffline) {
      return undefined;
    }
    const source = getMovementStream(activityVariant);
    const read = (): void => {
      setLiveWindow(source.getHourlyKickWindow());
    };
    read();
    const interval = window.setInterval(read, LIVE_POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activityVariant, bandOffline]);

  // -- The session clock -------------------------------------------------
  // Counted in ticks rather than derived from wall time, because pausing has
  // to actually stop it: a `Date.now() - start` reading would silently count
  // the paused stretch and then jump when she resumed.
  useEffect(() => {
    if (paused) {
      return undefined;
    }
    const interval = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      SESSION_TICK_MS
    );
    return () => window.clearInterval(interval);
  }, [paused]);

  // Pausing stops the session clock and the ring, and DELIBERATELY does not
  // stop the poll above. A frozen trace under labels reading "12 hours ago"
  // and "now", with a big number above it, would be a claim about the baby's
  // count right now that the screen could not stand behind. The band
  // does not pause; only her session does.
  const handleTogglePause = (): void => setPaused((current) => !current);

  // AN X, NOT A CARET, AND IT ALWAYS LANDS ON HOME. The caret read as "back
  // one screen" and popped history, which meant the same glyph went somewhere
  // different depending on how she arrived — and on a direct visit to /live it
  // had nothing to pop and had to special-case Home anyway. The live view is a
  // thing you open and close, not a level in a hierarchy, so it now says so:
  // one destination, no history-dependent behaviour, nothing to reason about.
  const handleClose = (): void => {
    navigate('/home');
  };

  return (
    <>
      {/* README §08: `padding: 32px 24px 0`, content max-width 420, centred.
          The top inset is added to the 32px rather than replacing it, so the
          header keeps its designed distance from the notch. `dock-safe-tall`
          is the clearance the dock needs now that it carries the call control
          under Speak to Kindred; no content may enter it. */}
      <div className="mx-auto w-full max-w-[var(--content-max)] px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] dock-safe-tall">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleClose}
            aria-label={CLOSE_TO_HOME_LABEL}
            className="press tap -ml-4 flex shrink-0 items-center justify-center text-text-muted"
          >
            <X size={24} weight="light" aria-hidden="true" />
          </button>
          <h1 className="text-title text-text">{LIVE_VIEW_TITLE}</h1>
        </header>

        {listening ? (
          <>
            {/* The number and its unit are one paragraph, not two siblings, so
                a screen reader reads the number and its unit as one
                statement it is. It is not a live region: the reading changes
                every second, and announcing it every second would be
                unusable. */}
            <p className="mt-6 flex flex-col items-center gap-1 text-center">
              {/* `break-words` is the 200%-text-size guard: at that setting a
                  96px numeral can outgrow the 342px content column, and it
                  must wrap rather than be clipped or push the page sideways.
                  Nothing here has a fixed height. */}
              <span className="text-text break-words" style={BPM_NUMERIC_TYPE}>
                {settledSample.kicks}
              </span>
              <span className="text-caption text-text-muted">{LIVE_VIEW_UNIT_CAPTION}</span>
            </p>

            {/* Geometry, gradient, the greyed incoming edge and the live dot
                are all KickTrace's; this screen only says which window
                and which variant. */}
            <KickTrace window={liveWindow} variant="live" className="mt-6 block" />

            <div className="mt-2 flex items-start justify-between gap-4">
              <span className="text-micro text-text-muted">{LIVE_VIEW_TRACE_START_LABEL}</span>
              <span className="text-micro text-text-muted">{TRACE_HOUR_NOW_LABEL}</span>
            </div>

            {/* 28px above the ring, per the README's own rhythm. SessionRing
                owns its 132px box, its glow and its pause control. */}
            <div className="mt-7 flex justify-center">
              <SessionRing
                elapsedSeconds={elapsedSeconds}
                totalSeconds={SESSION_TOTAL_SECONDS}
                paused={paused}
                onTogglePause={handleTogglePause}
              />
            </div>

            <p className="mt-4 text-center text-caption text-text-muted">
              {liveViewSessionCaption(formatClock(sessionStartedAt))}
            </p>
          </>
        ) : (
          /* The band is quiet. One line, about the hardware, never about the
             baby, and it names the one thing she can do about it. Everything
             else on the screen goes with the data: no trace, no number, and
             no ring or session caption either — that caption ends "The band is
             connected", and the ring counts a listening session that is not
             happening. Neither may be shown as a claim the screen cannot
             stand behind. */
          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <BandMark size={BAND_MARK_SIZE} className="text-text-muted" />
            <p className="text-caption text-text-muted">
              {bandOfflineCopy(formatClock(quietSince ?? sessionStartedAt))}
            </p>
          </div>
        )}
      </div>

      {/* Bar weight: Speak to Kindred is not this screen's own call to action,
          it is the same always-reachable control it is everywhere else. The
          call control sits under it, on this screen as on every other — see
          Home.tsx's dock note for why it is permanent, and why the dock is
          `tall` once it carries two pills. */}
      <Dock variant="tall">
        <CheckInControl variant="bar" />
        <EmergencyCall prominence="standard" />
      </Dock>
    </>
  );
}
