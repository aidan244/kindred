/**
 * Simulated in-app push notification banner, fired from the hidden demo
 * panel (src/components/DemoPanel.tsx) to demo the "alert" entry path
 * without a real backend/push service.
 *
 * Handoff README §"02 Home — opened from the notification", the PushBanner
 * bullet: top 20px, 16px insets, radius 22, `surface-hi`, 1px line, padding
 * 22, float shadow, Bell 22px accent + 12px gap; a title row "Kindred" at
 * body size in weight 500, then the muted caption body.
 *
 * It is a NOTIFICATION, not an alarm: no badge, no dot, no pulse, no sound,
 * no red — everything a real OS banner would use to demand attention is
 * deliberately absent. It waits.
 *
 * Safety rule: notification copy leads with action + her own perception —
 * the word "detected" must never appear anywhere patient-facing. Copy here
 * is exact and should not be edited without checking that rule.
 *
 * This is the one overlay in the product that positions itself. That does not
 * contradict the "screens never position their own docked controls" rule: the
 * dock is the bottom rectangle the shared `<Dock>` owns, and this sits at the
 * top, above everything, for as long as it is visible.
 */

import type { ReactElement } from 'react';
import { Bell } from '@phosphor-icons/react';
import { PUSH_BANNER_BODY, PUSH_BANNER_TITLE } from '../data/clinicalContent';

export interface PushBannerProps {
  visible: boolean;
  onOpen: () => void;
}

/* The copy is imported, never restated here. The body's first sentence is the
 * SAME sentence AlertFramingBlock opens with — the one governed by "lead with
 * the action and her own perception, never a diagnostic assertion" — and it
 * used to exist as a second, independent literal in this file, so an edit to
 * clinicalContent.ts would have left the notification saying something else
 * with nothing to catch it. PUSH_BANNER_BODY is now composed from
 * ALERT_FRAMING_TITLE at its definition. */

export function PushBanner({ visible, onOpen }: PushBannerProps): ReactElement | null {
  if (!visible) {
    return null;
  }

  return (
    // top-5 / px-4 are the README's 20px top and 16px insets. The inner
    // max-width keeps the banner on the same measure as screen content once
    // the viewport is wider than a phone, rather than stretching edge to edge.
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[60] flex justify-center px-4">
      <button
        type="button"
        onClick={onOpen}
        className="tap press pointer-events-auto flex w-full max-w-[var(--content-max)] items-start gap-3 rounded-card border border-line bg-surface-hi p-[22px] text-left shadow-float"
      >
        <Bell size={22} weight="light" className="mt-1 shrink-0 text-accent" aria-hidden="true" />
        <span className="flex flex-col">
          {/* The one deliberate composition on a type role in this component:
              the README specifies the title as body size at weight 500, which
              is body's metrics with label's weight — not the `label` role,
              whose leading and tracking are tighter. */}
          <span className="text-body font-medium text-text">{PUSH_BANNER_TITLE}</span>
          <span className="text-caption text-text-muted">{PUSH_BANNER_BODY}</span>
        </span>
      </button>
    </div>
  );
}
