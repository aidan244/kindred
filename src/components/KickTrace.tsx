/**
 * KickTrace — the one data drawing in the product (handoff README,
 * screen 01's live-data card and screen 08's live view; also used by the
 * weeks/days trends screen). One polyline, no fill, stroked with a
 * horizontal gradient that runs from nearly-invisible at the old end to
 * full accent at "now", and a single dot marking the live edge.
 *
 * WHAT THIS COMPONENT REFUSES TO DRAW, and why:
 *
 *  - No axis, no gridlines, no baseline row. A baseline implies a normal band
 *    and therefore a verdict; this app draws the shape of what the band
 *    reported and stops (handoff README, invariants).
 *  - Nothing at all when the window is empty. `null`, not a flat line at
 *    zero, not an empty frame with labels. A flat line is a claim that the
 *    anything was counted. Absence is absence.
 *  - No colour that means anything. There is one accent ramp and, on the live
 *    variant, one muted grey for the part the band has not confirmed yet. Red
 *    exists in EmergencyCall alone and never appears here, no matter what the
 *    numbers are.
 *
 * GEOMETRY IS DERIVED, NEVER HARDCODED. The reference HTML ships a literal
 * `points="0,67 2,66.4 ..."` string; that is placeholder sample data, not
 * artwork. Everything below maps real samples from the sensor boundary
 * (src/sensors/MovementStream.ts) into the README's viewBox:
 *
 *  - X: samples are laid out evenly across [0, 342]. The viewBox starts at -6
 *    and is 354 wide, so both ends keep 6 units of margin — enough that the
 *    live dot (r 3.6 at most) is never clipped by the edge.
 *  - Y: the window's OWN min/max, padded by a little headroom, mapped onto a
 *    plot band inset from the viewBox by the same 6 units. A fixed kicks axis
 *    was rejected deliberately: it would make ordinary variation read as a
 *    flat line most days and as a cliff on the day it moves, which is a
 *    judgement about the data dressed up as a scale.
 *
 * The gradient id is per-instance (`useId`) because Home and the live view can
 * both be mounted during a route transition, and two `<linearGradient id>`s
 * that collide would silently repaint each other's trace.
 */

import { useId, type ReactElement } from 'react';
import {
  kickTraceCardSummary,
  kickTraceLiveSummary,
  kickTraceTrendSummary,
} from '../data/clinicalContent';
import type { KickSample, KickWindow } from '../types';

export interface KickTraceProps {
  /** From the sensor boundary. An empty `samples` array renders nothing. */
  window: KickWindow;
  variant: 'card' | 'live' | 'trend';
  className?: string;
}

// ---------------------------------------------------------------------------
// Screen-reader copy lives in src/data/clinicalContent.ts
// (`kickTraceCardSummary` / `kickTraceLiveSummary` / `kickTraceTrendSummary`),
// like every other patient-facing sentence.
//
// IT ANNOUNCES THE NUMBER ON SCREEN, not a statistic. The label used to state
// the arithmetic MEAN of the whole window, while LiveDataCard displayed the
// latest sample and LiveView displayed the settled one — so the announced
// quantity and the visible quantity were different things, and the announced
// one was a figure the app had derived rather than a reading the band
// reported. A derived average is the closest thing to a score anywhere in this
// product, and it was the version only non-sighted users got. All variants
// now speak `samples[dotIndex]` — the very sample the accent dot marks, which
// is exactly what each caller prints beside the trace.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Where the oldest sample sits, in viewBox units. */
const PLOT_X_START = 0;
/** Where "now" sits. The viewBox runs to 348, leaving 6 units for the dot. */
const PLOT_X_END = 342;

/**
 * How much of the plot band is left empty above and below the data, as a
 * fraction of the window's own kicks span. Without it the highest and lowest
 * samples of every window would touch the band's edges, which reads as the
 * trace having hit a limit.
 */
const HEADROOM_FRACTION = 0.12;

/** The clearance the plot band keeps from the viewBox edge, matching the 6
 * units of margin at each end of the x axis so the drawing sits evenly. */
const BAND_INSET = 6;

interface TraceGeometry {
  /** Verbatim from the handoff README — do not adjust. */
  viewBox: string;
  /** Rendered height in px; width is always 100% of the container. */
  height: number;
  /** Smaller y — where the highest kicks in the window lands. */
  bandTop: number;
  /** Larger y — where the lowest kicks lands. */
  bandBottom: number;
  /** Radius of the dot marking the live edge. */
  dotRadius: number;
}

const GEOMETRY: Record<KickTraceProps['variant'], TraceGeometry> = {
  // viewBox y runs 8 -> 108; the band is that, inset top and bottom.
  card: {
    viewBox: '-6 8 354 100',
    height: 100,
    bandTop: 8 + BAND_INSET,
    bandBottom: 108 - BAND_INSET,
    dotRadius: 3.2,
  },
  // viewBox y runs 20 -> 150.
  live: {
    viewBox: '-6 20 354 130',
    height: 150,
    bandTop: 20 + BAND_INSET,
    bandBottom: 150 - BAND_INSET,
    dotRadius: 3.6,
  },
  // No handoff README reference for this one — it's a new screen, not in
  // the original handoff. Taller than live (190 vs 150): this is the whole
  // point of its own screen rather than embedded above a session ring, so
  // it gets more room. viewBox y runs 12 -> 182. A number worth a visual
  // look once real, not a spec to hold as final.
  trend: {
    viewBox: '-6 12 354 170',
    height: 190,
    bandTop: 12 + BAND_INSET,
    bandBottom: 182 - BAND_INSET,
    dotRadius: 3.4,
  },
};

const STROKE_WIDTH = 1.6;

// ---------------------------------------------------------------------------
// The gradient
//
// Colours are read from the theme, never written literally: the trace has to
// be correct in the night theme too, where the accent is a warm light on a
// dark room rather than a bronze on paper.
// ---------------------------------------------------------------------------

const ACCENT = 'rgb(var(--accent-rgb))';
const MUTED = 'var(--text-muted)';

interface GradientStop {
  offset: number;
  color: string;
  opacity: number;
}

/** Home's card and the trends screen: one ramp, old to now, ending at full
 * accent. Both are retrospective ("what did she have") rather than the live
 * view's "what's arriving right now", so neither draws a greyed incoming
 * edge — there is no edge, only a history. */
const SIMPLE_RAMP_STOPS: readonly GradientStop[] = [
  { offset: 0, color: ACCENT, opacity: 0.07 },
  { offset: 0.4, color: ACCENT, opacity: 0.28 },
  { offset: 0.82, color: ACCENT, opacity: 0.85 },
  { offset: 1, color: ACCENT, opacity: 1 },
];

/**
 * The README states the live ramp's stops as 30% and 60% with the hard switch
 * at 62%, because its sample data settles at 62%. The real switch point is
 * wherever `settledIndex` falls, so the two intermediate stops are expressed
 * as their fractions OF that boundary (0.30/0.62 and 0.60/0.62): if the band
 * ever confirms more or less of the window, the ramp still reaches full accent
 * precisely where the greying begins rather than peaking somewhere arbitrary
 * inside the incoming edge.
 *
 * HOW CLOSE THAT IS TO THE README'S LITERAL NUMBERS. `settledIndex` is a
 * rounded sample index, not the raw fraction, so it does not land exactly on
 * SETTLED_FRACTION: on the live view's 121-sample window it is
 * round(0.62 x 120) = 74, i.e. 0.6167, and the two ramp stops resolve to
 * 0.2984 and 0.5968. That is ~0.4% off the README's 0.30/0.60/0.62 — well
 * under a rendered pixel across a 342-unit plot — and it is the price of the
 * stops tracking the real boundary rather than a constant. Stated here rather
 * than left to be re-derived, because this comment previously claimed they
 * resolved to the README's numbers exactly.
 */
const LIVE_RAMP_A = 0.3 / 0.62;
const LIVE_RAMP_B = 0.6 / 0.62;

/** The width of the hard switch. Small enough to read as an edge rather than
 * a fade — the reference does the same with 0.621 -> 0.622. */
const SWITCH_EPSILON = 0.001;

/**
 * The live view: accent up to the last sample the band has confirmed, then a
 * hard switch to muted grey for the incoming edge. The grey is not a warning
 * and not a gap in the data — it is the part the band has not finished
 * confirming, and it goes accent-coloured a moment later.
 */
function liveStops(switchOffset: number): GradientStop[] {
  const hold = clamp(switchOffset, 0, 1);
  return [
    { offset: 0, color: ACCENT, opacity: 0.06 },
    { offset: hold * LIVE_RAMP_A, color: ACCENT, opacity: 0.34 },
    { offset: hold * LIVE_RAMP_B, color: ACCENT, opacity: 0.95 },
    { offset: hold, color: ACCENT, opacity: 0.95 },
    { offset: Math.min(hold + SWITCH_EPSILON, 1), color: MUTED, opacity: 0.3 },
    { offset: 1, color: MUTED, opacity: 0.2 },
  ];
}

// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Two decimals is well under a rendered pixel at this scale and keeps the
 * points attribute from running to several kilobytes on a 24h window. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Maps a kick count onto the plot band.
 *
 * THE AXIS STARTS AT ZERO, and that is the difference between an honest chart
 * and a misleading one here. This function used to scale to the window's own
 * min and max, which is right for a heart rate — 138 to 146 bpm is a real
 * band and nobody imagines the axis reaching 0. A COUNT is not like that.
 * Zooming 284..333 kicks onto the full plot height turns a 15% spread into a
 * line that swings from floor to ceiling, and someone looking at her own
 * baby's chart would read a catastrophe in ordinary variation.
 *
 * So: zero at the bottom, the window's max plus headroom at the top. Flat
 * data draws a flat line low on the band, which is what flat data is.
 */
function makeKicksToY(samples: KickSample[], geometry: TraceGeometry): (kicks: number) => number {
  const { bandTop, bandBottom } = geometry;
  let max = samples[0].kicks;
  for (const sample of samples) {
    if (sample.kicks > max) max = sample.kicks;
  }

  const high = max * (1 + HEADROOM_FRACTION);

  // An all-zero window has no height to scale across. Draw it on the floor:
  // the count really is zero, and the floor is where zero belongs.
  if (high <= 0) {
    return () => bandBottom;
  }
  return (kicks: number) => bandBottom - (kicks / high) * (bandBottom - bandTop);
}

/** Even spacing across the plot width. A single-sample window is placed at the
 * "now" end, which is where a single sample honestly is. */
function sampleX(index: number, count: number): number {
  if (count < 2) {
    return PLOT_X_END;
  }
  return PLOT_X_START + (index / (count - 1)) * (PLOT_X_END - PLOT_X_START);
}

export function KickTrace({
  window: kickWindow,
  variant,
  className,
}: KickTraceProps): ReactElement | null {
  // Called before the early return: hooks may not sit behind a condition.
  const rawId = useId();

  const { samples, settledIndex } = kickWindow;

  // Absence is absence. No frame, no labels, no flat line (handoff README,
  // invariants) — the caller renders its own no-signal state instead.
  if (samples.length === 0) {
    return null;
  }

  // useId() emits colons, which are legal in an id but awkward in a
  // `url(#...)` reference and in anything that later tries to select on it.
  const gradientId = `hr-trace-${rawId.replace(/:/g, '')}`;

  const geometry = GEOMETRY[variant];
  const count = samples.length;
  const kicksToY = makeKicksToY(samples, geometry);

  const points = samples
    .map((sample, index) => `${round2(sampleX(index, count))},${round2(kicksToY(sample.kicks))}`)
    .join(' ');

  // The card and trend dots mark the last sample (both are retrospective —
  // everything they show has already happened, unfinished current bucket
  // included); the live view's marks the settled boundary instead, which is
  // exactly where the gradient hands over to grey, so its dot always sits
  // on the switch.
  const dotIndex =
    variant === 'live' ? clamp(settledIndex, 0, count - 1) : count - 1;
  const dotX = sampleX(dotIndex, count);
  const dotY = kicksToY(samples[dotIndex].kicks);

  const switchOffset = count < 2 ? 1 : dotIndex / (count - 1);
  const stops = variant === 'live' ? liveStops(switchOffset) : SIMPLE_RAMP_STOPS;

  // The number the caller is printing beside this trace, and therefore the
  // number the accessible label states — see the note at the top of this file.
  const dotKicks = Math.round(samples[dotIndex].kicks);

  return (
    <svg
      viewBox={geometry.viewBox}
      width="100%"
      height={geometry.height}
      role="img"
      aria-label={
        variant === 'card'
          ? kickTraceCardSummary(dotKicks)
          : variant === 'live'
            ? kickTraceLiveSummary(dotKicks)
            : kickTraceTrendSummary(dotKicks)
      }
      className={className}
    >
      <defs>
        {/* userSpaceOnUse, not the default objectBoundingBox: a window with no
            variation has a zero-height bounding box, and an objectBoundingBox
            gradient over a degenerate box renders as nothing at all in some
            engines. Pinning the gradient to the plot's own x range also means
            an offset is literally a position along the window, which is what
            the README's percentages describe. */}
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={PLOT_X_START}
          y1={0}
          x2={PLOT_X_END}
          y2={0}
        >
          {stops.map((stop, index) => (
            <stop
              key={index}
              offset={stop.offset}
              stopColor={stop.color}
              stopOpacity={stop.opacity}
            />
          ))}
        </linearGradient>
      </defs>

      <polyline
        points={points}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The live edge. One dot, accent, no ring, no pulse, no label. */}
      <circle cx={round2(dotX)} cy={round2(dotY)} r={geometry.dotRadius} fill="var(--accent)" />
    </svg>
  );
}
