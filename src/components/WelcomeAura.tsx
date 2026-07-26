/**
 * The welcome screen's own aura — the same lamp as src/components/Aura.tsx,
 * turned all the way up for one hero moment before onboarding.
 *
 * A SEPARATE COMPONENT, NOT A VARIANT OF Aura.tsx. Aura is explicitly
 * "mounted once, above the router — never per screen" (see its own header),
 * because its whole point is motion that survives navigation. This aura is
 * the opposite: it belongs to exactly one screen, mounts and unmounts with
 * it, and never has to sit under dense readable UI the way the ambient orb
 * does — so its alphas run far past that one's contrast ceiling on purpose.
 * Forcing both into one configurable component would mean threading a third
 * animation dimension and a different token set through code built around
 * two, for a component with exactly one other caller.
 *
 * Same structure as Aura.tsx otherwise, so the quality bar and the physics
 * match: four layers (field/ring-2/ring-1/core), radial-gradient discs and
 * annuli, blur, two independent loops per layer (turn, brightness breath) —
 * PLUS a third here: colour wax/wane, a slow hue-rotate + saturate pulse
 * (src/index.css's aura-glow-* keyframes) so the warmth itself swells and
 * recedes rather than each layer sitting at one fixed hue. Ring 1/2 keep
 * their ellipticity (`squash`) for the same reason Aura.tsx does: a perfect
 * circle shows no rotation at all.
 *
 * BREATH DELAYS MATCH AURA.TSX'S OWN, not independently chosen: both share
 * the same `--dur-aura-breath-*` tokens, and Aura.tsx's own header explains
 * why starting nearly in phase (~0.24 of each layer's cycle) rather than
 * scattered actually matters — scattered phases let one layer dim while
 * another brightens, cancelling the net change until the breath reads as
 * absent. That finding applies here too, so this reuses its exact delays
 * rather than reintroducing the failure mode it fixed.
 *
 * Reduced motion holds every layer static at its designed alpha, same
 * reasoning as Aura.tsx: the room stays as lit as designed, the light stops
 * moving.
 */

import type { CSSProperties, ReactElement } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// The `--aura-breath-trough` override below is scoped to this subtree via
// plain CSS custom-property cascading — every layer's aura-breath animation
// reads var(--aura-breath-trough), and this local redeclaration shadows the
// :root one for anything inside this component without touching it globally.
// React's CSSProperties has no index signature for custom properties, hence
// the narrow, explicit extension rather than a cast to `any`.
const ROOT_STYLE: CSSProperties & Record<'--aura-breath-trough', string> = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  contain: 'strict',
  '--aura-breath-trough': 'var(--aura-welcome-breath-trough)',
};

/** Slightly above centre, same reasoning as Aura.tsx: puts the brightest
 * point behind the headline rather than dead centre of the screen. */
const CENTRE_X = '50%';
const CENTRE_Y = '42%';

interface Layer {
  /** Diameter in `vmin` — see Aura.tsx's header on why not a percentage. */
  size: number;
  squash: number;
  token: 'core' | 'ring-1' | 'ring-2' | 'field';
  shape: { kind: 'disc'; stop: number } | { kind: 'ring'; inner: number; peak: number; outer: number };
  blur: string;
  turnKeyframes: string;
  turnDuration: string;
  breathDuration: string;
  breathDelay: string;
  glowKeyframes: string;
  glowDuration: string;
  glowDelay: string;
}

/** Outermost first — these paint in order. Sizes run ~3-6% larger than
 * Aura.tsx's own: this is the one screen built to be looked at rather than
 * seen past. */
const LAYERS: Layer[] = [
  {
    size: 155,
    squash: 1,
    token: 'field',
    shape: { kind: 'disc', stop: 82 },
    blur: '40px',
    turnKeyframes: 'orb-field',
    turnDuration: 'field',
    breathDuration: 'field',
    breathDelay: '-2.4s', // matches Aura.tsx's own delay for this shared 10s period
    glowKeyframes: 'aura-glow-field',
    glowDuration: 'field',
    glowDelay: '-6s',
  },
  {
    size: 118,
    squash: 0.94,
    token: 'ring-2',
    shape: { kind: 'ring', inner: 55, peak: 68, outer: 82 },
    blur: '26px',
    turnKeyframes: 'orb-ring-2',
    turnDuration: 'ring-2',
    breathDuration: 'ring-2',
    breathDelay: '-3.2s', // matches Aura.tsx's own delay for this shared 13s period
    glowKeyframes: 'aura-glow-ring-2',
    glowDuration: 'ring-2',
    glowDelay: '-14s',
  },
  {
    size: 90,
    squash: 0.96,
    token: 'ring-1',
    shape: { kind: 'ring', inner: 50, peak: 66, outer: 80 },
    blur: '20px',
    turnKeyframes: 'orb-ring-1',
    turnDuration: 'ring-1',
    breathDuration: 'ring-1',
    breathDelay: '-2.7s', // matches Aura.tsx's own delay for this shared 11s period
    glowKeyframes: 'aura-glow-ring-1',
    glowDuration: 'ring-1',
    glowDelay: '-9s',
  },
  {
    size: 66,
    squash: 1,
    token: 'core',
    shape: { kind: 'disc', stop: 72 },
    blur: '24px',
    turnKeyframes: 'orb-core',
    turnDuration: 'core',
    breathDuration: 'core',
    breathDelay: '-2.2s', // matches Aura.tsx's own delay for this shared 9s period
    glowKeyframes: 'aura-glow-core',
    glowDuration: 'core',
    glowDelay: '-2s',
  },
];

function restTransform(layer: Layer): string {
  return layer.turnKeyframes === 'orb-ring-2'
    ? 'translate(-50%, -50%) scale(1.03)'
    : 'translate(-50%, -50%)';
}

function background(layer: Layer): string {
  const fill = `rgb(var(--aura-welcome-${layer.token}-rgb) / var(--aura-welcome-${layer.token}-a))`;
  if (layer.shape.kind === 'disc') {
    return `radial-gradient(closest-side, ${fill}, transparent ${layer.shape.stop}%)`;
  }
  const { inner, peak, outer } = layer.shape;
  return `radial-gradient(closest-side, transparent ${inner}%, ${fill} ${peak}%, transparent ${outer}%)`;
}

export function WelcomeAura(): ReactElement {
  const reduced = usePrefersReducedMotion();

  return (
    <div style={ROOT_STYLE} aria-hidden="true" data-welcome-aura>
      {LAYERS.map((layer) => (
        <div
          key={layer.token}
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
            willChange: reduced ? undefined : 'transform, opacity, filter',
            opacity: reduced ? 1 : undefined,
            animation: reduced
              ? 'none'
              : `${layer.turnKeyframes} var(--dur-orb-${layer.turnDuration}) var(--ease-breathe) infinite, ` +
                `aura-breath var(--dur-aura-breath-${layer.breathDuration}) var(--ease-breathe) ${layer.breathDelay} infinite, ` +
                `${layer.glowKeyframes} var(--dur-aura-glow-${layer.glowDuration}) var(--ease-breathe) ${layer.glowDelay} infinite`,
          }}
        />
      ))}
    </div>
  );
}
