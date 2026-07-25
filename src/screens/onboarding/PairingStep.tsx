import type { ReactElement } from 'react';
import { BandMark } from '../../components/BandMark';
import { usePrefersReducedMotion } from '../../components/usePrefersReducedMotion';

export interface PairingStepProps {
  onContinue: () => void;
}

/**
 * The closing moment of onboarding: a calm, mocked confirmation that the
 * wearable is paired. This is a statement about the device, not the baby —
 * no verdict, no tick, no "all good". Nothing here ticks or spins like a
 * loader; the only motion is the shared slow ambient breath behind the mark.
 *
 * Under prefers-reduced-motion, the glow renders static at its resting/full
 * opacity rather than animating — the animation class is omitted entirely,
 * rather than relying on the global reduced-motion CSS clamp, which would
 * otherwise freeze it at the breath keyframe's 0% opacity (0.62) instead of
 * showing the lamp fully lit.
 */
export function PairingStep({ onContinue }: PairingStepProps): ReactElement {
  const reduced = usePrefersReducedMotion();

  return (
    <div className="flex flex-col items-center pt-4 text-center">
      <div className="relative flex h-48 w-48 items-center justify-center">
        <div
          aria-hidden="true"
          className={`absolute h-40 w-40 rounded-full ${reduced ? '' : 'animate-breath'}`}
          style={{
            background: 'radial-gradient(closest-side, var(--lamp-3), transparent)',
            opacity: reduced ? 1 : undefined,
          }}
        />
        <BandMark size={112} className="relative text-accent" />
      </div>

      <h1 className="mt-8 text-display text-text">Your band is paired.</h1>
      <p className="mt-3 text-lead text-text-muted">
        It sends your movement data to Kindred while you wear it.
      </p>

      <button
        type="button"
        onClick={onContinue}
        className="tap mt-12 flex w-full items-center justify-center rounded-pill bg-accent px-6 text-label text-on-accent"
      >
        Continue
      </button>
    </div>
  );
}
