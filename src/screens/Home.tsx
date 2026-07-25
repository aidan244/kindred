/**
 * Home — design-plan.md §8 and the task's screen spec. The resting state
 * and entry point for the patient-initiated path.
 *
 * Safety rule: this screen shows the shape of the last 24h of data and
 * STOPS. No summary, no score, no interpretation in words — just the ember
 * band, a plain sync timestamp, and two ways forward: check in (always
 * reachable, same position as everywhere else) or open the live view.
 *
 * When `alertActive` is true (entered from the simulated push notification)
 * the same layout gains a framing block at the top. Nothing else changes —
 * the check-in control stays in its usual place.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertFramingBlock } from '../components/AlertFramingBlock';
import { CheckInControl } from '../components/CheckInControl';
import { EmberBand } from '../components/EmberBand';
import { useAppState } from '../context/AppStateContext';
import { getMovementStream } from '../sensors/MovementStream';

// How often the "synced ... ago" line quietly recomputes. Not an animation —
// a plain metadata string, updated the way any ordinary app keeps a
// timestamp honest, not a visible counter (design-plan.md rule 6 bans
// counters; this never renders more than one static line of text).
const SYNC_REFRESH_MS = 30000;

function formatSyncedAgo(latest: Date | null, nowMs: number): string {
  if (!latest) {
    return 'Not yet synced';
  }
  const diffMinutes = Math.round(Math.max(0, nowMs - latest.getTime()) / 60000);
  if (diffMinutes < 1) {
    return 'Synced just now';
  }
  if (diffMinutes === 1) {
    return 'Synced 1 minute ago';
  }
  if (diffMinutes < 60) {
    return `Synced ${diffMinutes} minutes ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours === 1) {
    return 'Synced 1 hour ago';
  }
  return `Synced ${diffHours} hours ago`;
}

export default function Home(): ReactElement {
  const { alertActive, setAlertActive, entryPath, setEntryPath, activityVariant } = useAppState();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setTick((current) => current + 1), SYNC_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, []);

  const latestSampleAt = useMemo(() => {
    const samples = getMovementStream(activityVariant).getWindow(24);
    return samples.length > 0 ? samples[samples.length - 1].timestamp : null;
  }, [activityVariant, tick]);

  const syncedCopy = formatSyncedAgo(latestSampleAt, Date.now());

  // Mirrors CheckInControl's own guard: only claim the entry path if no
  // flow is already in progress, so this never mislabels a flow entered
  // another way.
  const handleAlertCheckIn = (): void => {
    if (entryPath === null) {
      setEntryPath('alert');
    }
    navigate('/triage');
  };

  // One tap, never a confirmation dialog. Clears the 'alert' entry path
  // too, so a later ad hoc check-in isn't mislabelled as having come from
  // this notification.
  const handleDismiss = (): void => {
    setAlertActive(false);
    if (entryPath === 'alert') {
      setEntryPath(null);
    }
  };

  return (
    <div className="relative flex min-h-screen justify-center">
      <div className="w-full max-w-[var(--content-max)] px-6">
        <div className="flex flex-col pt-[calc(env(safe-area-inset-top,0px)+32px)] dock-safe">
          {alertActive && (
            <div className="mb-8">
              <AlertFramingBlock onCheckIn={handleAlertCheckIn} onDismiss={handleDismiss} />
            </div>
          )}

          <header>
            <h1 className="text-title text-text">Last 24 hours</h1>
            <p className="mt-3 text-caption text-text-muted">{syncedCopy}</p>
          </header>

          <div className="mt-8">
            <EmberBand variant={activityVariant} onOpenLiveView={() => navigate('/live')} />
          </div>
        </div>
      </div>

      {/* The 24px fade every screen renders above the docked control. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-6"
        style={{ background: 'linear-gradient(to top, var(--bg), transparent)' }}
        aria-hidden="true"
      />

      <CheckInControl variant="primary" />
    </div>
  );
}
