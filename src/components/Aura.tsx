/**
 * The aura backdrop — one centred orb, turning slowly behind everything.
 *
 * MOUNTED ONCE, ABOVE THE ROUTER (src/App.tsx) — never per screen. That is
 * the whole point: the motion is continuous THROUGH navigation rather than
 * restarting on every push, which is only true if this element never
 * unmounts and never re-keys. It also means the aura cannot participate in
 * a route transition, which the handoff README requires ("the aura, the dock
 * and the emergency control must not animate or reflow during a
 * transition").
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NO LONGER THE README'S FIVE BLOOMS
 *
 * The README's composition is five wide, scattered blooms sized as a
 * percentage of the viewport. On a desktop window it works. On a phone —
 * the only device this product actually ships to — it disappeared, for two
 * compounding reasons, neither of which is fixable by changing its numbers:
 *
 *  1. TRAVEL COLLAPSED. A percentage translate resolves against the
 *     element's OWN box, and the blooms were sized as a percentage of the
 *     viewport. At 390px wide they drifted 3.7-5.9x less far than at
 *     1440px: bloom 3 moved 129px across on a desktop and 35px on a phone.
 *     The animation was still running; there was just nothing to see.
 *
 *  2. THERE WAS NOWHERE TO SEE IT. The blooms sit around the edges of the
 *     field, and content is capped at `--content-max` (420px). On a wide
 *     window that leaves hundreds of pixels of bare aura either side of the
 *     column; at 390px the column IS the viewport, and the only aura left
 *     visible is whatever shows between opaque cards.
 *
 * Both are fixed by the same change: ONE ORB, CENTRED, SIZED IN `vmin`.
 * `vmin` makes the circle and its travel identical at every aspect ratio,
 * and putting it in the middle puts it behind the content column rather
 * than around it — so the phone is now the case it is designed for instead
 * of the case it degrades to.
 *
 * The layer alphas are still derived the same way, and still sit at the
 * contrast ceiling: the composited field is sampled across a 390x844
 * viewport at both ends of the breath, and the worst text contrast anywhere
 * in it is the number that binds. Day 4.92:1, night 4.73:1, against a 4.5:1
 * floor. See src/styles/tokens.css for what each theme spends its budget on
 * and why day's core is a warm white rather than the accent.
 * ---------------------------------------------------------------------------
 *
 * Cost: transform and opacity only, on four composited layers, no per-frame
 * JS, nothing that can affect layout. `contain: strict` keeps the blur out
 * of the rest of the page's paint work.
 *
 * Reduced motion holds the orb static rather than removing it (README,
 * motion_and_accessibility) — the room stays lit, the light stops moving.
 */

import type { CSSProperties, ReactElement } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const ROOT_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  background: 'var(--bg)',
  contain: 'strict',
};

/**
 * Where the orb sits. Slightly above centre on purpose: dead centre puts the
 * brightest part of the field behind the live-data card, which is opaque, so
 * most of it would never be seen. At 44% it sits behind the greeting and the
 * avatar — the part of every screen that is text on bare background.
 */
const CENTRE_X = '50%';
const CENTRE_Y = '44%';

interface Layer {
  /** Diameter in `vmin` — see the header on why not a percentage. */
  size: number;
  /** Slight ellipticity, as a fraction of `size`. A perfect circle shows no
   * rotation at all; this is what makes the rings' turning visible without
   * making them look like they are spinning. */
  squash: number;
  /** Which `--aura-*` token pair fills it. */
  token: 'core' | 'ring-1' | 'ring-2' | 'field';
  /** A solid centre falling to nothing, or an annulus. */
  shape: { kind: 'disc'; stop: number } | { kind: 'ring'; inner: number; peak: number; outer: number };
  blur: string;
  keyframes: string;
  /** Which `--dur-orb-*` and `--dur-aura-breath-*` drive it. */
  duration: string;
  /** Negative offset into the breath, so the four layers never swell
   * together and read as one pulsing object. */
  breathDelay: string;
}

/** Outermost first — these paint in order. */
const LAYERS: Layer[] = [
  {
    size: 150,
    squash: 1,
    token: 'field',
    shape: { kind: 'disc', stop: 82 },
    blur: '40px',
    keyframes: 'orb-field',
    duration: 'field',
    breathDelay: '-11s',
  },
  {
    size: 114,
    squash: 0.94,
    token: 'ring-2',
    shape: { kind: 'ring', inner: 60, peak: 70, outer: 80 },
    blur: '26px',
    keyframes: 'orb-ring-2',
    duration: 'ring-2',
    breathDelay: '-17s',
  },
  {
    size: 86,
    squash: 0.96,
    token: 'ring-1',
    shape: { kind: 'ring', inner: 56, peak: 68, outer: 80 },
    blur: '20px',
    keyframes: 'orb-ring-1',
    duration: 'ring-1',
    breathDelay: '-5s',
  },
  {
    size: 62,
    squash: 1,
    token: 'core',
    shape: { kind: 'disc', stop: 72 },
    blur: '24px',
    keyframes: 'orb-core',
    duration: 'core',
    breathDelay: '-3s',
  },
];

/** The rest transform every layer holds at, matching its keyframes' 0% stop
 * so the animated and held-static cases agree. Ring 2 rests at scale(1.03)
 * because its track does. */
function restTransform(layer: Layer): string {
  return layer.keyframes === 'orb-ring-2'
    ? 'translate(-50%, -50%) scale(1.03)'
    : 'translate(-50%, -50%)';
}

function background(layer: Layer): string {
  const fill = `rgb(var(--aura-${layer.token}-rgb) / var(--aura-${layer.token}-a))`;
  if (layer.shape.kind === 'disc') {
    return `radial-gradient(closest-side, ${fill}, transparent ${layer.shape.stop}%)`;
  }
  const { inner, peak, outer } = layer.shape;
  // An annulus: nothing in the middle, the fill at its peak radius, nothing
  // again outside. This is what gives the orb concentric structure instead
  // of one flat falloff.
  return `radial-gradient(closest-side, transparent ${inner}%, ${fill} ${peak}%, transparent ${outer}%)`;
}

export function Aura(): ReactElement {
  const reduced = usePrefersReducedMotion();

  return (
    <div style={ROOT_STYLE} aria-hidden="true" data-aura>
      {LAYERS.map((layer) => (
        <div
          key={layer.token}
          data-reduced-keep={reduced ? '' : undefined}
          style={{
            position: 'absolute',
            width: `${layer.size}vmin`,
            height: `${layer.size * layer.squash}vmin`,
            left: CENTRE_X,
            top: CENTRE_Y,
            transform: restTransform(layer),
            borderRadius: '50%',
            background: background(layer),
            filter: `blur(${layer.blur})`,
            willChange: reduced ? undefined : 'transform, opacity',
            // Held static at the designed alpha, not at the breath's trough:
            // "hold it static (do not remove it)" means the room stays as lit
            // as it was designed to be. Dimming it for exactly the users the
            // rule exists to serve would be a quieter way of removing it.
            opacity: reduced ? 1 : undefined,
            // Two loops of different length on one element: one turns it, one
            // swells it. Neither touches a property the other does, so they
            // compose rather than fight, and both are compositor-only.
            animation: reduced
              ? 'none'
              : `${layer.keyframes} var(--dur-orb-${layer.duration}) var(--ease-breathe) infinite, ` +
                `aura-breath var(--dur-aura-breath-${layer.duration}) var(--ease-breathe) ${layer.breathDelay} infinite`,
          }}
        />
      ))}
    </div>
  );
}
