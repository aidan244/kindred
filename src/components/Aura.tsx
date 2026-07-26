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
 * WHY THE BREATH WAS AMPLIFIED, AND WHAT WAS *NOT* TOUCHED TO DO IT
 *
 * Reported again as invisible after the one-orb fix above. The orb itself was
 * now visible; its BREATH was not, for three compounding reasons, and the fix
 * had to avoid the one lever that would have been easiest to reach for.
 *
 *  1. TOO SLOW. The breath ran at 13-23s while `--dur-breath` — the cycle the
 *     avatar, the pairing mark and the recording ring all use — is 9s. A
 *     half-cycle of 6.5-11.5s spreads a small luminance change so thinly that
 *     nothing registers as changing. The core now runs on `--dur-breath`
 *     itself; the outer layers lag just behind it.
 *  2. TOO SHALLOW. The trough was 0.55 of a peak alpha of 0.08-0.18 — under
 *     heavy blur, a swing of a few RGB steps. Now 0.15, a ~6.7x swing.
 *  3. SELF-CANCELLING. The four layers were deliberately scattered in phase so
 *     they would not pulse as one object; the side effect was that one layer
 *     dimmed while another brightened and the total light held roughly still.
 *     They now start nearly in phase and drift apart naturally. See
 *     `breathDelay`.
 *
 * THE ALPHAS WERE NOT RAISED, and that is the point. They are the contrast
 * ceiling; everything above is either a timing change or a change that can
 * only ever make the field DIMMER than its verified peak, so none of it can
 * move the number that binds. Re-measured after the change by rendering the
 * real layers with all four forced to full opacity — a state strictly worse
 * than anything the animation reaches — and sampling every pixel against
 * `--text-muted`: night 5.24:1, day 5.20:1. The scale amplitudes grew too
 * (src/index.css), which is why day moved at all: a wider field puts slightly
 * more of its own brightest region on screen. Still 0.7 clear of the floor.
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
  /**
   * Negative offset into the breath — where in its cycle the layer starts.
   *
   * THESE USED TO SCATTER THE LAYERS AND NOW ALIGN THEM, which is a reversal
   * and needs saying. The old values (-3s/-5s/-17s/-11s against 13/17/23/19s
   * periods) put the four layers at phases 0.23/0.29/0.74/0.58 — deliberately
   * spread, so they "never swell together and read as one pulsing object".
   * The cost of that was the thing it was protecting against: with one layer
   * dimming while another brightened, the total light in the field stayed
   * roughly constant, so the composite had no breath left to see. Scatter is
   * why a change that measures present reads as absent.
   *
   * All four now start at ~0.24 of their own cycle: nearly in phase, a quarter
   * of the way up the inhale, so the aura is already rising when the app opens
   * rather than sitting at its dimmest. Because the four periods still differ,
   * they drift apart over the following minutes and reconverge — so the field
   * breathes as one body at first and picks up its layered quality later,
   * instead of never having one.
   *
   * Note this cannot change the worst-case contrast: the periods have always
   * been mutually non-multiple, so every relative phase — including all four
   * at peak together — was already reachable. Aligning them changes how OFTEN
   * that state occurs, never how bright it is.
   */
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
    breathDelay: '-2.4s', // 0.240 of its 10s cycle
  },
  {
    size: 114,
    squash: 0.94,
    token: 'ring-2',
    shape: { kind: 'ring', inner: 60, peak: 70, outer: 80 },
    blur: '26px',
    keyframes: 'orb-ring-2',
    duration: 'ring-2',
    breathDelay: '-3.2s', // 0.246 of its 13s cycle
  },
  {
    size: 86,
    squash: 0.96,
    token: 'ring-1',
    shape: { kind: 'ring', inner: 56, peak: 68, outer: 80 },
    blur: '20px',
    keyframes: 'orb-ring-1',
    duration: 'ring-1',
    breathDelay: '-2.7s', // 0.245 of its 11s cycle
  },
  {
    size: 62,
    squash: 1,
    token: 'core',
    shape: { kind: 'disc', stop: 72 },
    blur: '24px',
    keyframes: 'orb-core',
    duration: 'core',
    breathDelay: '-2.2s', // 0.244 of its 9s cycle
  },
];

/** The rest transform every layer holds at, matching its keyframes' 0% stop
 * so the animated and held-static cases agree. Ring 2 rests at scale(1.06)
 * because its track does — if that keyframe's amplitude changes, THIS CHANGES
 * WITH IT, or the reduced-motion render silently differs from the animated
 * one's starting frame. */
function restTransform(layer: Layer): string {
  return layer.keyframes === 'orb-ring-2'
    ? 'translate(-50%, -50%) scale(1.06)'
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
