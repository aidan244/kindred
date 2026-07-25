/**
 * Safety rule: one always-reachable control to raise a concern, anchored in
 * the same position (bottom of viewport) on every screen. Two visual
 * weights sharing the same behaviour and label:
 *
 *  - variant="primary": full-width, high-contrast — Home renders this
 *    itself as its main CTA.
 *  - variant="bar": a quieter persistent bar — mounted globally by
 *    src/components/Layout.tsx on every screen except /home (which renders
 *    the primary variant itself) and /triage (she's already in the triage
 *    flow; that screen gets an emergency-call control instead, built
 *    later).
 *
 * Styled per design-plan.md §9.1. Fixes the scaffold's rule violation: the
 * primary variant was `bg-emergency text-text` — red is reserved for the
 * one emergency call control (§9.2) and must never appear here, and that
 * pairing also failed contrast (3.00:1). Now `bg-accent text-on-accent`.
 */

import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { KindredMark } from './KindredMark';
import { useAppState } from '../context/AppStateContext';

export interface CheckInControlProps {
  variant: 'primary' | 'bar';
}

const LABEL = 'Speak to Kindred';

export function CheckInControl({ variant }: CheckInControlProps): ReactElement {
  const { entryPath, setEntryPath, alertActive } = useAppState();
  const navigate = useNavigate();

  const handlePress = (): void => {
    // Only set entryPath if no flow is already in progress, so re-pressing
    // "Check in" mid-flow doesn't clobber how she originally entered it.
    // If an alert is currently active, a check-in started from here is an
    // alert-path check-in, not an ad hoc one — otherwise it could reach the
    // routine outcome despite starting from an active alert (the alert path
    // must only ever push towards escalation, never be mislabelled away
    // from it).
    if (entryPath === null) {
      setEntryPath(alertActive ? 'alert' : 'adhoc');
    }
    navigate('/triage');
  };

  const isPrimary = variant === 'primary';

  const sharedClasses =
    'tap pointer-events-auto flex w-full max-w-[calc(var(--content-max)-48px)] items-center justify-center gap-3 rounded-pill text-label shadow-float transition-opacity duration-[var(--dur-press)] active:opacity-[0.82]';
  const primaryClasses = 'h-[60px] bg-accent text-on-accent';
  const barClasses = 'h-14 border border-line bg-surface text-text';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-30 flex justify-center px-6">
      <button
        type="button"
        onClick={handlePress}
        className={`${sharedClasses} ${isPrimary ? primaryClasses : barClasses}`}
      >
        <KindredMark size={isPrimary ? 24 : 22} />
        {LABEL}
      </button>
    </div>
  );
}
