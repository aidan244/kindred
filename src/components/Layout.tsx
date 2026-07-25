/**
 * Shell every screen renders inside. Mounts the CheckInControl "bar" variant
 * globally on every screen except:
 *  - /home, which renders the "primary" variant itself as its main CTA.
 *  - /triage, the flow she's already in — that screen gets an
 *    emergency-call control instead, built later.
 *
 * The hidden demo panel is mounted here too, so it's available everywhere.
 */

import type { ReactElement, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckInControl } from './CheckInControl';
import { DemoPanel } from './DemoPanel';

const ROUTES_WITHOUT_CHECK_IN_BAR = new Set(['/home', '/triage']);

export function Layout({ children }: { children: ReactNode }): ReactElement {
  const location = useLocation();
  const showCheckInBar = !ROUTES_WITHOUT_CHECK_IN_BAR.has(location.pathname);

  return (
    <div className="min-h-screen bg-bg text-text">
      <main className="min-h-screen pb-24">{children}</main>
      {showCheckInBar && <CheckInControl variant="bar" />}
      <DemoPanel />
    </div>
  );
}
