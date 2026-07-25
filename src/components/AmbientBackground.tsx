/**
 * The ambient background wash — design-plan.md §13. "The app is not a page,
 * it is somewhere." Mounted once in src/components/Layout.tsx, above <main>
 * in DOM order and below it in stacking order (z-0 vs. main's z-1), on every
 * screen except /live (§13.1 — the live view is already a lamp).
 *
 * Two iterations, chosen behind a demo-panel toggle (§13.8):
 *  - Hearth (A): one low light, off to one side, content sitting above it.
 *  - Room breath (B): no visible source; the whole field is faintly,
 *    unevenly warm, and moves.
 *
 * Both are built only from CSS gradients + `transform` animation on plain
 * `<div>`s — no SVG, no canvas. The geometry, alpha steps and periods below
 * are contrast-verified against `--wash-*` (tokens.css) per §13.3/§13.4/§13.6
 * and MUST NOT be adjusted "to improve" the look — see design-plan.md.
 *
 * The movement-reactivity option (§13.7) is deliberately not implemented:
 * the design plan recommends shipping with it off, and building it would add
 * a second read path onto this component for a behaviour nobody will see.
 */

import type { CSSProperties, ReactElement } from 'react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export type AmbientBackgroundVariant = 'hearth' | 'room';

interface AmbientBackgroundProps {
  variant: AmbientBackgroundVariant;
}

const WASH_ROOT_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
  overflow: 'hidden',
  background: 'var(--bg)',
  contain: 'strict',
};

/** Every drifting form's baseline centring transform — baked into every
 * keyframe stop too (§13.5), so the reduced-motion (no-animation) case and
 * the animated case agree on the same rest position. */
const CENTER_TRANSFORM = 'translate(-50%, -50%)';

export function AmbientBackground({ variant }: AmbientBackgroundProps): ReactElement {
  const reduced = usePrefersReducedMotion();

  return (
    <div style={WASH_ROOT_STYLE} aria-hidden="true">
      <style>{`
        @keyframes kindred-wash-h1 {
          0%   { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
          50%  { transform: translate(-50%, -50%) translate(10px, -6px) scale(1.06); }
          100% { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
        }
        @keyframes kindred-wash-h2 {
          0%   { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
          50%  { transform: translate(-50%, -50%) translate(-8px, 5px)  scale(1.05); }
          100% { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
        }
        @keyframes kindred-wash-h3 {
          0%   { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
          50%  { transform: translate(-50%, -50%) translate(6px,  4px)  scale(1.04); }
          100% { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
        }
        @keyframes kindred-wash-r1 {
          0%   { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
          50%  { transform: translate(-50%, -50%) translate(-46px, 34px) scale(1.10); }
          100% { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
        }
        @keyframes kindred-wash-r2 {
          0%   { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
          50%  { transform: translate(-50%, -50%) translate(38px, -42px) scale(1.08); }
          100% { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
        }
        @keyframes kindred-wash-r3 {
          0%   { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
          50%  { transform: translate(-50%, -50%) translate(-30px, -26px) scale(1.12); }
          100% { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
        }
      `}</style>
      {variant === 'hearth' ? <Hearth reduced={reduced} /> : <RoomBreath reduced={reduced} />}
    </div>
  );
}

/**
 * Iteration A — "Hearth" (§13.4/§13.5). One low light, off to one side,
 * anchored below the fold; the content sits in the lit air above it.
 *
 * Two static elements (S1, S2) behind three drifting forms (H1, H2, H3).
 * `transparent 62%` on the drifting forms is load-bearing, not a taste call
 * — it is what makes each form's alpha reach exactly zero at 62% of its own
 * radius, which is the arithmetic behind the 87vh safety line. Do not change
 * it to `transparent` (100%).
 */
function Hearth({ reduced }: { reduced: boolean }): ReactElement {
  return (
    <>
      {/* S1 — the floor pool, directly under the drifting forms. Static: no
          blur, no animation. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 46% at 50% 116%, var(--wash-1), transparent 74%)',
        }}
      />
      {/* S2 — a wide, very low lift across the whole lower half, so the pool
          has somewhere to fade into instead of ending. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, var(--wash-1), transparent 42%)',
        }}
      />

      {/* H1 */}
      <div
        style={{
          position: 'absolute',
          width: '150vw',
          height: '48vh',
          left: '46%',
          top: '107%',
          transform: CENTER_TRANSFORM,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, var(--wash-4), transparent 62%)',
          filter: 'blur(56px)',
          willChange: 'transform',
          animation: reduced ? 'none' : 'kindred-wash-h1 var(--dur-wash-a) var(--ease-breathe) infinite',
        }}
      />
      {/* H2 */}
      <div
        style={{
          position: 'absolute',
          width: '96vw',
          height: '36vh',
          left: '68%',
          top: '102%',
          transform: CENTER_TRANSFORM,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, var(--wash-3), transparent 62%)',
          filter: 'blur(40px)',
          willChange: 'transform',
          animation: reduced ? 'none' : 'kindred-wash-h2 var(--dur-wash-b) var(--ease-breathe) infinite',
        }}
      />
      {/* H3 */}
      <div
        style={{
          position: 'absolute',
          width: '62vw',
          height: '24vh',
          left: '30%',
          top: '107%',
          transform: CENTER_TRANSFORM,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, var(--wash-2), transparent 62%)',
          filter: 'blur(28px)',
          willChange: 'transform',
          animation: reduced ? 'none' : 'kindred-wash-h3 var(--dur-wash-c) var(--ease-breathe) infinite',
        }}
      />
    </>
  );
}

/**
 * Iteration B — "Room breath" (§13.6). No visible source: three oversized,
 * edgeless forms at `--wash-1`, whose slow interference is the entire
 * perceptible effect. `transparent` (100%, not 62%) on purpose — B affords
 * edgeless falloff because its alpha budget is fixed by the token, not by
 * geometry. Do not add a fourth form or promote one to `--wash-2` — see
 * design-plan.md §13.6.
 */
function RoomBreath({ reduced }: { reduced: boolean }): ReactElement {
  return (
    <>
      {/* R1 */}
      <div
        style={{
          position: 'absolute',
          width: '170vw',
          height: '120vh',
          left: '28%',
          top: '22%',
          transform: CENTER_TRANSFORM,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, var(--wash-1), transparent)',
          filter: 'blur(72px)',
          willChange: 'transform',
          animation: reduced ? 'none' : 'kindred-wash-r1 var(--dur-wash-a) var(--ease-breathe) infinite',
        }}
      />
      {/* R2 */}
      <div
        style={{
          position: 'absolute',
          width: '140vw',
          height: '150vh',
          left: '82%',
          top: '58%',
          transform: CENTER_TRANSFORM,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, var(--wash-1), transparent)',
          filter: 'blur(72px)',
          willChange: 'transform',
          animation: reduced ? 'none' : 'kindred-wash-r2 var(--dur-wash-b) var(--ease-breathe) infinite',
        }}
      />
      {/* R3 */}
      <div
        style={{
          position: 'absolute',
          width: '190vw',
          height: '110vh',
          left: '50%',
          top: '95%',
          transform: CENTER_TRANSFORM,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, var(--wash-1), transparent)',
          filter: 'blur(72px)',
          willChange: 'transform',
          animation: reduced ? 'none' : 'kindred-wash-r3 var(--dur-wash-c) var(--ease-breathe) infinite',
        }}
      />
    </>
  );
}
