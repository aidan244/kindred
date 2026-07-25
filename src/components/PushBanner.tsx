/**
 * Simulated in-app push notification banner, fired from the hidden demo
 * panel (src/components/DemoPanel.tsx) to demo the "alert" entry path
 * without a real backend/push service.
 *
 * Safety rule: notification copy leads with action + her own perception —
 * the word "detected" must never appear anywhere patient-facing. Copy here
 * is exact and should not be edited without checking that rule.
 */

import type { ReactElement } from 'react';
import { Bell } from '@phosphor-icons/react';

export interface PushBannerProps {
  visible: boolean;
  onOpen: () => void;
}

const TITLE = 'Kindred';
const BODY = "Worth checking on your baby's movements. Open when you're ready.";

export function PushBanner({ visible, onOpen }: PushBannerProps): ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex justify-center p-3">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full max-w-md items-start gap-3 rounded-card border border-line bg-surface-hi p-[22px] text-left text-text shadow-float"
      >
        <Bell size={22} weight="light" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <span>
          <span className="block font-medium">{TITLE}</span>
          <span className="block text-caption text-text-muted">{BODY}</span>
        </span>
      </button>
    </div>
  );
}
