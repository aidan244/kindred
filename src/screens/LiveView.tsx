/**
 * The live view — design-plan.md §7. THE SIGNATURE ELEMENT. An on-demand
 * window onto the live feed: she opens it, watches, closes it when she
 * wants. No countdown, no session length, no completion state, no result,
 * no numbers — the wearable is always on, so this is a window, not a scan.
 *
 * Chrome is almost none: a quiet close control, one label that fades away
 * on its own and never comes back, and (rarely) a line about the hardware
 * if the band has gone quiet for 20s. The docked Check-in bar is mounted
 * globally by Layout for every route except /home and /triage, so it
 * already appears here without this screen doing anything — this screen
 * only needs to render the 24px fade above it (design-plan.md §4.5).
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from '@phosphor-icons/react';
import { BandMark } from '../components/BandMark';
import { LiveSurface } from '../components/LiveSurface';
import { useAppState } from '../context/AppStateContext';

const LABEL_VISIBLE_MS = 6000;

export default function LiveView(): ReactElement {
  const { activityVariant } = useAppState();
  const navigate = useNavigate();
  const [labelVisible, setLabelVisible] = useState(true);
  const [hasSignal, setHasSignal] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setLabelVisible(false), LABEL_VISIBLE_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  const handleClose = (): void => {
    navigate('/home');
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      <LiveSurface variant={activityVariant} onSignalChange={setHasSignal} />

      <button
        type="button"
        onClick={handleClose}
        aria-label="Close"
        className="tap absolute left-2 top-[max(8px,env(safe-area-inset-top))] z-10 flex items-center justify-center text-text-muted"
      >
        <X size={26} weight="light" aria-hidden="true" />
      </button>

      {hasSignal ? (
        <p
          aria-hidden={!labelVisible}
          className="pointer-events-none absolute inset-x-0 top-[max(20px,env(safe-area-inset-top))] z-10 text-center text-caption text-text-muted transition-opacity duration-[1200ms]"
          style={{ opacity: labelVisible ? 1 : 0 }}
        >
          Live movement
        </p>
      ) : (
        // The only conditional text in the whole view — a statement about
        // the hardware, never about the baby (design-plan.md §7.7).
        <div className="pointer-events-none absolute inset-x-0 top-[max(20px,env(safe-area-inset-top))] z-10 flex items-center justify-center gap-2 px-6 text-center text-caption text-text-muted">
          <BandMark size={18} />
          <span>No signal from the band.</span>
        </div>
      )}

      {/* The 24px fade every screen renders above the docked control, so
          the image dissolves under it instead of being sliced. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6"
        style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }}
        aria-hidden="true"
      />
    </div>
  );
}
