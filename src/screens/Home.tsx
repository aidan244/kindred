/**
 * Home — design-plan.md §8 and the founder's home-screen sketch. The resting
 * state and entry point for the patient-initiated path.
 *
 * Composition, top to bottom: a warm greeting ("Welcome back, {name}.") →
 * the Kindred avatar, a calm hand-drawn presence sitting under it → the 24h
 * ember band, this product's activity graph → a quiet "Worried?" prompt
 * pinned directly above the docked "Speak to Kindred" control (the renamed
 * check-in CTA — see CheckInControl.tsx). The trailing prompt block carries
 * `mt-auto` so it settles at the bottom of the viewport regardless of how
 * tall the content above it is, the same way CheckInControl always docks in
 * the same place.
 *
 * Safety rule: this screen shows the shape of the last 24h of data and
 * STOPS. No summary, no score, no interpretation in words — just the ember
 * band, a plain sync timestamp, and two ways forward: check in (always
 * reachable, same position as everywhere else) or open the live view.
 *
 * When `alertActive` is true (entered from the simulated push notification)
 * the same layout gains a framing block, rendered just below the greeting.
 * Nothing else changes — the check-in control stays in its usual place.
 */

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertFramingBlock } from '../components/AlertFramingBlock';
import { CheckInControl } from '../components/CheckInControl';
import { EmberBand } from '../components/EmberBand';
import { KindredAvatar } from '../components/KindredAvatar';
import { useAppState } from '../context/AppStateContext';
import { patientFixture } from '../data/clinicalContent';
import { getMovementStream } from '../sensors/MovementStream';

const FIRST_NAME = patientFixture.name.split(' ')[0];

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
    <div className="relative flex min-h-[calc(100vh-96px)] items-start justify-center">
      {/* min-h-[calc(100vh-96px)], here and below, rather than min-h-screen:
          Layout's <main> (not owned by this screen) wraps every route in
          `min-h-screen pb-24` — its own 96px of bottom padding. Matching
          that here keeps this column's height, plus that padding, at
          exactly one viewport, so the trailing "Worried?" prompt still
          settles right above the docked control via `mt-auto` without the
          page needing to scroll. `items-start` stops the default flex
          stretch from overriding the inner column's min-height with this
          row's own. */}
      <div className="flex min-h-[calc(100vh-96px)] w-full max-w-[var(--content-max)] flex-col px-6 pt-[calc(env(safe-area-inset-top,0px)+32px)] dock-safe">
        <header>
          <h1 className="text-display text-text">Welcome back, {FIRST_NAME}.</h1>
        </header>

        {alertActive && (
          <div className="mt-8">
            <AlertFramingBlock onCheckIn={handleAlertCheckIn} onDismiss={handleDismiss} />
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <KindredAvatar />
        </div>

        <div className="mt-8">
          <p className="text-caption text-text-muted">Last 24 hours</p>
          <p className="mt-1 text-caption text-text-muted">{syncedCopy}</p>
          <div className="mt-3">
            <EmberBand variant={activityVariant} onOpenLiveView={() => navigate('/live')} />
          </div>
        </div>

        <div className="mt-auto pt-6 text-center">
          <p className="text-caption text-text-muted">Worried?</p>
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
