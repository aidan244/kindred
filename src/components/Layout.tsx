/**
 * Shell every screen renders inside. Mounts the CheckInControl "bar" variant
 * globally on every screen except:
 *  - /home, which renders the "primary" variant itself as its main CTA.
 *  - /triage, the flow she's already in — that screen gets an
 *    emergency-call control instead, built later.
 *
 * Also mounts the ambient background wash (design-plan.md §13) once, above
 * <main> in DOM order and below it in stacking order (z-0 vs. main's z-1),
 * on every screen except /live — the live view is already a lamp (§13.1).
 * Mounted here, outside anything keyed by pathname, so it persists across
 * navigations rather than being re-created on every route change (§13.9).
 *
 * The hidden demo panel is mounted here too, so it's available everywhere.
 */

import type { ReactElement, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AmbientBackground } from './AmbientBackground';
import { CheckInControl } from './CheckInControl';
import { DemoPanel } from './DemoPanel';
import { useAppState } from '../context/AppStateContext';

const ROUTES_WITHOUT_CHECK_IN_BAR = new Set(['/home', '/triage']);
const ROUTE_WITHOUT_WASH = '/live';

export function Layout({ children }: { children: ReactNode }): ReactElement {
  const location = useLocation();
  const { ambientBackground } = useAppState();
  const showCheckInBar = !ROUTES_WITHOUT_CHECK_IN_BAR.has(location.pathname);

  return (
    <div className="min-h-screen bg-bg text-text">
      {ambientBackground !== 'off' && location.pathname !== ROUTE_WITHOUT_WASH && (
        <AmbientBackground variant={ambientBackground} />
      )}
      <main className="relative z-[1] min-h-screen pb-24">{children}</main>
      {showCheckInBar && <CheckInControl variant="bar" />}
      <DemoPanel />
    </div>
  );
}
