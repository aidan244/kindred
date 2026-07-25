/**
 * Router shell. Screen agents replace the placeholder components in
 * src/screens/*.tsx in place — this file should not need to change for
 * that.
 */

import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useThemeSync } from './theme/useThemeSync';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import LiveView from './screens/LiveView';
import TriageFlow from './screens/TriageFlow';
import Outcome from './screens/Outcome';

export function App(): ReactElement {
  useThemeSync();

  return (
    <Layout>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/home" element={<Home />} />
        <Route path="/live" element={<LiveView />} />
        <Route path="/triage" element={<TriageFlow />} />
        <Route path="/outcome" element={<Outcome />} />
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
