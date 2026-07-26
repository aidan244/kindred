/**
 * SessionRing — the live view's session dial (handoff README, screen 08, the
 * "Session ring" paragraph).
 *
 * A 132px ring with a track, an accent arc showing how long she has been
 * listening, a breathing glow sitting just outside it, and a disc in the
 * middle carrying the elapsed clock and the pause control.
 *
 * NOTHING HERE COUNTS DOWN OR RACES. That is the whole design constraint, and
 * it is the reason for several things that would otherwise look like
 * omissions:
 *  - the arc GROWS with elapsed time; it is never drawn as time remaining, and
 *    there is no "time left", no percentage, no target and no finish;
 *  - reaching the end of `totalSeconds` does nothing at all — no colour
 *    change, no completion state, no chime, no result. The wearable is always
 *    on; this is a window she is looking through, not a scan that finishes;
 *  - the arc carries no transition, so nothing ever appears to sprint to catch
 *    up after the tab was backgrounded or the session was paused;
 *  - the only motion in the component is the glow's 9s breath, the same
 *    ambient loop the avatar and the pairing mark use.
 *
 * THE PAUSED STATE. The README draws the listening state only, and it fixes
 * the glyph: two 4x16 accent bars. So the glyph does not change — this is a
 * toggle button (`aria-pressed`), not two different controls, and its visible
 * state is carried by the glow, which holds still while she is paused. That
 * is the honest reading: the breath is the band reporting, and while paused
 * nothing is arriving. No second glyph was invented, and no red, no "stopped"
 * label and no warning appears in either state.
 *
 * THE CLOCK IS NOT ANNOUNCED. It is `aria-hidden`, and the button's accessible
 * name is the action alone. A name that included the elapsed time would change
 * every second — unusable with a screen reader, and precisely the ticking
 * this screen is built to avoid. The session's start time is already stated in
 * plain language in the caption beneath the ring
 * (`liveViewSessionCaption`), which is the thing worth hearing.
 */

import type { ReactElement } from 'react';
import { LIVE_VIEW_PAUSE_LABEL } from '../data/clinicalContent';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface SessionRingProps {
  elapsedSeconds: number;
  totalSeconds: number;
  paused: boolean;
  onTogglePause: () => void;
}

// -- Geometry, verbatim from the README ------------------------------------
//
// THE BOX IS IN rem, NOT px, and that is load-bearing rather than tidiness.
// It was `width: 132, height: 132` — a px box holding `text-lead` clock text
// inside a button pinned at `inset-3`. `inset-3` is 0.75rem and scales with
// the root font size; a px box does not. At 200% text the disc stayed 108px
// while "04:11" grew from 23px to 46px (~115px wide) — the clock spilled
// straight over the accent arc, which is the "or overlap" half of the
// text-scales-to-200% invariant. In rem the box, the inset, the disc and the
// numerals all grow together, and the drawing is identical at the default
// size because 8.25rem IS 132px at the 16px root this whole scale is built on.
//
// The SVG keeps the README's numbers as viewBox units — the arc's radius,
// stroke and dasharray are geometry inside a 132-unit square, and the square
// itself is what scales.
const BOX_REM = '8.25rem'; // 132px at a 16px root
const BOX_UNITS = 132; // the viewBox's own coordinate space
const CENTRE = BOX_UNITS / 2;
const RADIUS = 58;
const STROKE_WIDTH = 3;
/** 2 * pi * 58 = 364.42; the README rounds it to 364.4 and so does this, so
 * the arc and the reference agree to the last decimal. */
const DASH_ARRAY = 364.4;
/** How far outside the ring the glow reaches: the README's 14px, in rem for
 * the same reason as the box. */
const GLOW_SPREAD_REM = '0.875rem'; // 14px at a 16px root

/** mm:ss, both parts padded, so the clock never changes width as it counts —
 * "04:11" in the reference. Minutes are allowed past 59 rather than rolling
 * into an hours field: a longer session should read as a longer number, not
 * as a new unit appearing. */
function formatElapsed(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function SessionRing({
  elapsedSeconds,
  totalSeconds,
  paused,
  onTogglePause,
}: SessionRingProps): ReactElement {
  const reduced = usePrefersReducedMotion();

  // A zero or negative total would otherwise produce NaN and blank the arc.
  // An unbounded session simply shows no arc rather than a full one — it has
  // not "completed" anything.
  const progress =
    totalSeconds > 0 ? Math.min(1, Math.max(0, elapsedSeconds / totalSeconds)) : 0;
  const dashOffset = DASH_ARRAY * (1 - progress);

  // The glow holds STATIC rather than being removed, under reduced motion and
  // while paused alike (handoff README: "hold the blooms static (do not remove
  // them)"). data-reduced-keep stops the global reduced-motion rule in
  // src/index.css from re-animating it at 0.01ms, which would strobe.
  const glowStill = reduced || paused;

  return (
    <div className="relative" style={{ width: BOX_REM, height: BOX_REM }}>
      <div
        aria-hidden="true"
        data-reduced-keep={reduced ? '' : undefined}
        className={`absolute rounded-full ${glowStill ? '' : 'animate-breath'}`}
        style={{
          inset: `calc(-1 * ${GLOW_SPREAD_REM})`,
          background: 'radial-gradient(closest-side, var(--lamp-3), transparent)',
          opacity: glowStill ? 1 : undefined,
        }}
      />

      {/* Decorative: the arc says the same thing as the clock beside it, and
          the caption below the ring says it in words. */}
      {/* 100% of the box rather than a px size, so the drawing follows the
          box when the root font size changes. */}
      <svg
        viewBox={`0 0 ${BOX_UNITS} ${BOX_UNITS}`}
        width="100%"
        height="100%"
        fill="none"
        aria-hidden="true"
        className="absolute inset-0"
      >
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          stroke="var(--line)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />
        {/* Rotated -90 from the centre so the arc starts at the top. No
            transition: see the header — nothing here races to catch up. */}
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          stroke="var(--accent)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={DASH_ARRAY}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
        />
      </svg>

      {/* The disc is the control. `inset-3` (0.75rem) inside an 8.25rem ring
          makes it 6.75rem — 108x108 at the default size, comfortably over the
          56px minimum, and growing with the box at any text scale rather than
          shrinking against it. `tap` states the minimum anyway so the
          guarantee survives any future resize. */}
      <button
        type="button"
        onClick={onTogglePause}
        aria-pressed={paused}
        aria-label={LIVE_VIEW_PAUSE_LABEL}
        className="press tap absolute inset-3 flex flex-col items-center justify-center gap-1.5 rounded-full bg-surface-hi"
      >
        <span aria-hidden="true" className="text-lead text-text">
          {formatElapsed(elapsedSeconds)}
        </span>
        {/* The glyph: two 4x16 accent bars, radius 2, 4px apart. */}
        <span aria-hidden="true" className="flex gap-1">
          <span className="block h-4 w-1 rounded-[2px] bg-accent" />
          <span className="block h-4 w-1 rounded-[2px] bg-accent" />
        </span>
      </button>
    </div>
  );
}
