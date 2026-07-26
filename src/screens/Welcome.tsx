/**
 * Welcome (/welcome) — the very first screen, one tap before onboarding
 * starts. Not one of the original handoff README's numbered screens.
 *
 * The one screen in the product built to be looked at rather than seen
 * past: everywhere else, the aura is a backdrop that has to stay legible
 * under dense, readable UI (src/components/Aura.tsx's contrast ceiling).
 * Here there is exactly one short headline, one line of tagline and one
 * button, so src/components/WelcomeAura.tsx can run far past that ceiling —
 * the same lamp, turned all the way up for one hero moment.
 *
 * NO DOCK. Every other screen renders `<Dock>` so Speak to Kindred stays
 * reachable everywhere — deliberately not here. There is no patient context
 * yet (onboarding hasn't run), so a check-in control would be a live
 * affordance for a flow that cannot actually work yet. This screen is
 * chrome-free on purpose: aura, mark, words, one way forward.
 *
 * WHAT THIS SCREEN DELIBERATELY DOES NOT RENDER — the aura here is the one
 * exception to "mounted once in App": WelcomeAura is its own, scoped to
 * this screen alone (see its header for why it isn't a variant of the
 * persistent Aura). Its own entrance animation is still RouteTransition's,
 * same as everywhere else.
 */

import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { KindredMark } from '../components/KindredMark';
import { WelcomeAura } from '../components/WelcomeAura';
import {
  WELCOME_BRAND_LABEL,
  WELCOME_CTA_FINE_PRINT,
  WELCOME_CTA_LABEL,
  WELCOME_TAGLINE,
  WELCOME_TITLE,
} from '../data/clinicalContent';

export default function Welcome(): ReactElement {
  const navigate = useNavigate();

  const handleBegin = (): void => {
    navigate('/onboarding');
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-bg px-6 pb-12 pt-[calc(env(safe-area-inset-top,0px)+56px)] text-center">
      <WelcomeAura />

      <div className="relative z-[1] flex items-center gap-2 text-text">
        <KindredMark size={20} />
        <span className="text-micro tracking-[0.06em] uppercase">{WELCOME_BRAND_LABEL}</span>
      </div>

      {/* The one place text sits on the aura rather than beside it — the
          drop shadow is a legibility aid, not a design flourish, so it's
          restrained: a soft, dark spread wide enough to separate the type
          from a saturated background without reading as an outline. */}
      <div className="relative z-[1] flex max-w-[300px] flex-col gap-4">
        <h1
          className="text-display text-balance text-text"
          style={{ textShadow: '0 2px 28px rgb(0 0 0 / 0.22)' }}
        >
          {WELCOME_TITLE}
        </h1>
        <p className="text-body text-text-muted" style={{ textShadow: '0 1px 20px rgb(0 0 0 / 0.18)' }}>
          {WELCOME_TAGLINE}
        </p>
      </div>

      <div className="relative z-[1] flex w-full max-w-[280px] flex-col items-center gap-3">
        {/* A solid-fill pill on purpose, unlike every other control in the
            product: this is the one button that has to stay legible against
            a background that can be anywhere from pale gold to hot rose, so
            it carries its own opaque surface rather than depending on
            whatever the aura is doing behind it. */}
        <button
          type="button"
          onClick={handleBegin}
          className="tap press flex min-h-14 w-full items-center justify-center rounded-pill bg-surface text-label text-text shadow-float"
        >
          {WELCOME_CTA_LABEL}
        </button>
        <p className="text-caption text-text-muted opacity-80">{WELCOME_CTA_FINE_PRINT}</p>
      </div>
    </div>
  );
}
