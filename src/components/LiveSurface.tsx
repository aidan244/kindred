/**
 * THE SIGNATURE — the live view's surface. design-plan.md §7. The screen
 * becomes the still surface of a glass of water with the lamp reflected in
 * it; when the baby moves, a ring spreads from somewhere on the surface.
 *
 * Two layers:
 *  - Layer A, the reflection (three blurred divs + one static glow) —
 *    always at full strength. It never dims, brightens, or responds to the
 *    data. The lamp does not go out.
 *  - Layer B, the rings (one <svg>) — one elliptical ring per `moved: true`
 *    sample. `moved: false` produces no visual change of any kind: no
 *    state change, no counter, no timer reset. That is a safety
 *    requirement, not an optimisation — there is no branching on movement
 *    density anywhere in this file.
 *
 * `getBaseline()` is deliberately never called here — comparing to a
 * baseline is interpretation, and this view only ever shows what arrived.
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { getMovementStream } from '../sensors/MovementStream';
import type { ActivityVariant } from '../types';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface LiveSurfaceProps {
  variant: ActivityVariant;
  /**
   * Fires true the instant any sample arrives (moved or not), and false
   * after 20 consecutive seconds without one — see design-plan.md §7.7.
   */
  onSignalChange?: (hasSignal: boolean) => void;
}

interface Ring {
  id: number;
  cx: number;
  cy: number;
}

const MAX_RINGS = 6;
const NO_SIGNAL_TIMEOUT_MS = 20000;
const VIEW_WIDTH = 390;
const VIEW_HEIGHT = 780;
// Mirrors --dur-settle (900ms) from tokens.css, used only to time the
// reduced-motion ring's JS-driven fade (see note below).
const DUR_SETTLE_MS = 900;
const REDUCED_RING_FADE_OUT_MS = 5000;

/**
 * Deterministic pseudo-random value in [0, 1), hashed from the sample's own
 * timestamp plus a monotonically-increasing counter (so two samples arriving
 * with the same timestamp still land differently). Replaces `Math.random()`
 * so ring positions replay identically on every demo run rather than being
 * different each time, while still spreading across the same range the
 * design plan specifies.
 */
function hashToUnit(timestampMs: number, counter: number): number {
  const seed = Math.sin(timestampMs * 12.9898 + counter * 78.233) * 43758.5453;
  return seed - Math.floor(seed);
}

function deterministicBetween(min: number, max: number, timestampMs: number, counter: number): number {
  return min + hashToUnit(timestampMs, counter) * (max - min);
}

/**
 * The reduced-motion ring fallback (§7.6) still needs to fade in slowly and
 * fade out over ~5s — it is not static. The project-wide reduced-motion CSS
 * baseline (src/index.css, read-only) forces every `animation`/`transition`
 * duration to 0.01ms under prefers-reduced-motion, which would turn a CSS
 * keyframe fade into a flash instead of a calm fade. So this one case is
 * driven directly by rAF + React state (a plain opacity number), which the
 * baseline rule has no power over, to genuinely honour "opacity may still
 * change slowly" rather than produce the exact strobe reduced-motion exists
 * to prevent.
 */
function ReducedRing({ ring, onDone }: { ring: Ring; onDone: (id: number) => void }): ReactElement {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const totalMs = DUR_SETTLE_MS + REDUCED_RING_FADE_OUT_MS;
    const startedAt = performance.now();
    let frameId = 0;

    const tick = (nowMs: number): void => {
      const elapsed = nowMs - startedAt;
      if (elapsed >= totalMs) {
        onDone(ring.id);
        return;
      }
      const value =
        elapsed <= DUR_SETTLE_MS
          ? elapsed / DUR_SETTLE_MS
          : 1 - (elapsed - DUR_SETTLE_MS) / REDUCED_RING_FADE_OUT_MS;
      setOpacity(Math.max(0, Math.min(1, value)));
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [ring.id, onDone]);

  return (
    <g transform={`translate(${ring.cx} ${ring.cy})`}>
      <ellipse
        rx={78}
        ry={48}
        fill="var(--lamp-1)"
        stroke="var(--lamp-4)"
        strokeWidth={1.2}
        style={{ opacity }}
      />
    </g>
  );
}

export function LiveSurface({ variant, onSignalChange }: LiveSurfaceProps): ReactElement {
  const reduced = usePrefersReducedMotion();
  const [rings, setRings] = useState<Ring[]>([]);
  const [entered, setEntered] = useState(false);
  const nextIdRef = useRef(0);
  const noSignalTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const removeRing = useCallback((id: number) => {
    setRings((current) => current.filter((ring) => ring.id !== id));
  }, []);

  const scheduleNoSignalCheck = useCallback(() => {
    if (noSignalTimeoutRef.current !== null) {
      window.clearTimeout(noSignalTimeoutRef.current);
    }
    noSignalTimeoutRef.current = window.setTimeout(() => {
      onSignalChange?.(false);
    }, NO_SIGNAL_TIMEOUT_MS);
  }, [onSignalChange]);

  useEffect(() => {
    scheduleNoSignalCheck();
    const unsubscribe = getMovementStream(variant).subscribe((sample) => {
      onSignalChange?.(true);
      scheduleNoSignalCheck();

      if (!sample.moved) {
        // A quiet sample produces no visual change of any kind. Not an
        // optimisation — a safety requirement (design-plan.md §7.4, §7.7).
        return;
      }

      const timestampMs = sample.timestamp.getTime();
      const ring: Ring = {
        id: nextIdRef.current,
        cx: deterministicBetween(90, 300, timestampMs, nextIdRef.current * 2),
        cy: deterministicBetween(400, 620, timestampMs, nextIdRef.current * 2 + 1),
      };
      nextIdRef.current += 1;
      setRings((current) => {
        const next = [...current, ring];
        return next.length > MAX_RINGS ? next.slice(next.length - MAX_RINGS) : next;
      });
    });
    return () => {
      unsubscribe();
      if (noSignalTimeoutRef.current !== null) {
        window.clearTimeout(noSignalTimeoutRef.current);
      }
    };
  }, [variant, onSignalChange, scheduleNoSignalCheck]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-bg">
      <style>{`
        @keyframes kindred-drift-r1 {
          0%   { transform: translate(-50%, -50%) translate(0px, 0px) scale(1); }
          50%  { transform: translate(-50%, -50%) translate(7px, -4px) scale(1.05); }
          100% { transform: translate(-50%, -50%) translate(0px, 0px) scale(1); }
        }
        @keyframes kindred-drift-r2 {
          0%   { transform: translate(-50%, -50%) translate(0px, 0px) scale(1); }
          50%  { transform: translate(-50%, -50%) translate(-6px, 4px) scale(1.05); }
          100% { transform: translate(-50%, -50%) translate(0px, 0px) scale(1); }
        }
        @keyframes kindred-drift-r3 {
          0%   { transform: translate(-50%, -50%) translate(0px, 0px) scale(1); }
          50%  { transform: translate(-50%, -50%) translate(5px, 3px) scale(1.05); }
          100% { transform: translate(-50%, -50%) translate(0px, 0px) scale(1); }
        }
        .kindred-ring-stroke, .kindred-ring-fill {
          transform-box: fill-box;
          transform-origin: center;
          animation: kindred-ring var(--dur-ring) var(--ease-ripple) forwards;
        }
        @keyframes kindred-ring {
          0%   { transform: scale(0.06); stroke-width: 26;  opacity: 0;    }
          6%   {                                            opacity: 0.55; }
          22%  { transform: scale(0.42); stroke-width: 3.4; opacity: 0.50; }
          100% { transform: scale(1.00); stroke-width: 0.5; opacity: 0;    }
        }
        .kindred-ring-fill { animation-name: kindred-ring-fill; }
        @keyframes kindred-ring-fill {
          0%   { transform: scale(0.06); opacity: 0;    }
          18%  {                         opacity: 0.35; }
          100% { transform: scale(1.00); opacity: 0;    }
        }
      `}</style>

      {/* Layer A — the reflection. Entrance only: fades/scales in once on
          mount. Each blob's own drift loop (below) is independent of this
          wrapper and keeps running for as long as the view is open. */}
      <div
        className="absolute inset-0"
        style={{
          transform: entered ? 'scale(1)' : 'scale(0.94)',
          opacity: entered ? 1 : 0,
          transition: 'transform var(--dur-settle) var(--ease-soft), opacity var(--dur-settle) var(--ease-soft)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(60% 45% at 50% 64%, var(--lamp-1), transparent 72%)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '64%',
            width: '78%',
            height: '27%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(closest-side, var(--lamp-3), transparent)',
            filter: 'blur(30px)',
            animation: reduced ? 'none' : 'kindred-drift-r1 23s var(--ease-breathe) infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '64%',
            width: '54%',
            height: '17%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(closest-side, var(--lamp-4), transparent)',
            filter: 'blur(22px)',
            animation: reduced ? 'none' : 'kindred-drift-r2 31s var(--ease-breathe) infinite',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '64%',
            width: '30%',
            height: '9%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(closest-side, var(--lamp-5), transparent)',
            filter: 'blur(14px)',
            animation: reduced ? 'none' : 'kindred-drift-r3 41s var(--ease-breathe) infinite',
          }}
        />
      </div>

      {/* Layer B — the rings. Elliptical (1 : 0.62) and off-centre, so they
          never read as radar. No SVG filters — animating geometry with
          feGaussianBlur drops frames. */}
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        className="absolute inset-0"
        aria-hidden="true"
      >
        {rings.map((ring) =>
          reduced ? (
            <ReducedRing key={ring.id} ring={ring} onDone={removeRing} />
          ) : (
            <g key={ring.id} transform={`translate(${ring.cx} ${ring.cy})`}>
              <ellipse rx={170} ry={105} fill="var(--lamp-2)" className="kindred-ring-fill" />
              <ellipse
                rx={170}
                ry={105}
                fill="none"
                stroke="var(--lamp-4)"
                className="kindred-ring-stroke"
                onAnimationEnd={() => removeRing(ring.id)}
              />
            </g>
          )
        )}
      </svg>
    </div>
  );
}
