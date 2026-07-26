/**
 * The aura backdrop — handoff README, "The aura backdrop (every screen)".
 *
 * Five heavily-blurred radial blooms, each drifting on its own slow loop, so
 * the app is never a flat page: it is a room with light moving in it. This
 * replaces the earlier two-iteration ambient wash (design-plan.md §13,
 * `AmbientBackground`) wholesale — the handoff README is now the source of
 * truth for the ground the product stands on, and leaving both in place
 * would mean two competing backdrops.
 *
 * MOUNTED ONCE, ABOVE THE ROUTER (src/App.tsx) — never per screen. That is
 * the whole point: the drift is continuous THROUGH navigation rather than
 * restarting on every push, which is only true if this element never
 * unmounts and never re-keys. It also means the aura cannot participate in
 * a route transition, which the README requires ("the aura, the dock and the
 * emergency control must not animate or reflow during a transition").
 *
 * Geometry, fills, blurs and periods are verbatim from the README's table
 * and MUST NOT be adjusted to taste. The fills are read from `--aura-N-rgb`
 * / `--aura-N-a` (src/styles/tokens.css) rather than written literally here,
 * per the no-hard-coded-hex invariant; the day values in that file are the
 * README's numbers exactly.
 *
 * Cost: transform-only animation on five composited layers, no per-frame JS,
 * nothing that can affect layout. `contain: strict` keeps the blur out of
 * the rest of the page's paint work.
 *
 * Reduced motion holds the blooms static rather than removing them (README,
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

interface Bloom {
  /** Width / height, as a percentage of the screen box. */
  width: string;
  height: string;
  left: string;
  top: string;
  /** Which `--aura-N-*` pair fills it. */
  token: 1 | 2 | 3 | 4 | 5;
  /** Where the radial gradient reaches zero alpha. */
  stop: string;
  blur: string;
  keyframes: 'aura-a' | 'aura-b' | 'aura-c' | 'aura-d';
  /** Which `--dur-aura-N` drives it. */
  duration: 1 | 2 | 3 | 4 | 5;
}

/**
 * The transform each keyframe track rests at — its 0%/100% stop, verbatim.
 *
 * Two of the four carry a rest SCALE (the README: "aura-b: rest scale(1.04)",
 * "aura-d: rest scale(1.06)"), and that is the whole reason this is a map
 * rather than one shared constant. Reduced motion holds the blooms static at
 * their rest stop, and a single `translate(-50%,-50%)` held bloom 2 at scale 1
 * and blooms 4 and 5 at scale 1, i.e. 4-6% smaller than their designed rest
 * size — dropping part of the composition for exactly the users the rule
 * exists to serve. "Hold the blooms static (do not remove them)" means hold
 * them AT the 0%/100% stop, scale included.
 *
 * Keep these in step with the @keyframes in src/index.css: the animated case
 * and the held-static case must agree on the same rest position.
 */
const REST_TRANSFORM: Record<Bloom['keyframes'], string> = {
  'aura-a': 'translate(-50%, -50%)',
  'aura-b': 'translate(-50%, -50%) scale(1.04)',
  'aura-c': 'translate(-50%, -50%)',
  'aura-d': 'translate(-50%, -50%) scale(1.06)',
};

/** The README's table, in order. Blooms 4 and 5 share the `aura-d` track on
 * deliberately different periods — that is what the table says. */
const BLOOMS: Bloom[] = [
  { width: '170%', height: '58%', left: '50%', top: '30%', token: 1, stop: '76%', blur: '34px', keyframes: 'aura-a', duration: 1 },
  { width: '150%', height: '52%', left: '26%', top: '66%', token: 2, stop: '72%', blur: '58px', keyframes: 'aura-b', duration: 2 },
  { width: '120%', height: '44%', left: '82%', top: '18%', token: 3, stop: '70%', blur: '52px', keyframes: 'aura-c', duration: 3 },
  { width: '112%', height: '38%', left: '16%', top: '8%', token: 4, stop: '70%', blur: '44px', keyframes: 'aura-d', duration: 4 },
  { width: '150%', height: '52%', left: '62%', top: '96%', token: 5, stop: '72%', blur: '46px', keyframes: 'aura-d', duration: 5 },
];

export function Aura(): ReactElement {
  const reduced = usePrefersReducedMotion();

  return (
    <div style={ROOT_STYLE} aria-hidden="true" data-aura>
      {BLOOMS.map((bloom, index) => (
        <div
          key={index}
          data-reduced-keep={reduced ? '' : undefined}
          style={{
            position: 'absolute',
            width: bloom.width,
            height: bloom.height,
            left: bloom.left,
            top: bloom.top,
            transform: REST_TRANSFORM[bloom.keyframes],
            borderRadius: '50%',
            background: `radial-gradient(closest-side, rgb(var(--aura-${bloom.token}-rgb) / var(--aura-${bloom.token}-a)), transparent ${bloom.stop})`,
            filter: `blur(${bloom.blur})`,
            willChange: 'transform',
            animation: reduced
              ? 'none'
              : `${bloom.keyframes} var(--dur-aura-${bloom.duration}) var(--ease-breathe) infinite`,
          }}
        />
      ))}
    </div>
  );
}
