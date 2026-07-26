/**
 * Router shell, and the one place the three persistent layers are mounted.
 *
 * Stacking, bottom to top:
 *  1. `Aura` — the drifting backdrop (handoff README, "The aura backdrop").
 *     Mounted here, above the router, so it keeps drifting continuously
 *     through navigation instead of restarting on every push.
 *  2. `RouteTransition` + `Routes` — the only thing that animates when she
 *     moves between screens.
 *  3. `DockHost` — the fixed rectangle every screen's dock portals into, so
 *     the Speak-to-Kindred and emergency controls appear not to move at all.
 *
 * Only layer 2 is keyed by pathname. Layers 1 and 3 are fixed reference
 * points and must never reflow during a transition.
 */

import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Aura } from './components/Aura';
import { DemoPanel } from './components/DemoPanel';
import { DockHost } from './components/Dock';
import { RouteTransition } from './components/RouteTransition';
import { useThemeSync } from './theme/useThemeSync';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import LiveView from './screens/LiveView';
import TriageFlow from './screens/TriageFlow';
import Outcome from './screens/Outcome';

export function App(): ReactElement {
  useThemeSync();

  return (
    <div className="min-h-screen bg-bg text-text">
      <Aura />
      <DockHost>
        <main className="relative z-[1] min-h-screen">
          <RouteTransition>
            <Routes>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/home" element={<Home />} />
              <Route path="/live" element={<LiveView />} />
              <Route path="/triage" element={<TriageFlow />} />
              <Route path="/outcome" element={<Outcome />} />
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </RouteTransition>
        </main>
      </DockHost>
      <DemoPanel />
    </div>
  );
}

export default App;
