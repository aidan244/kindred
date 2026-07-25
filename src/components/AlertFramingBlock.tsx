/**
 * The framing block Home shows at the top when `alertActive` is true —
 * entered from the simulated push notification. design-plan.md §9.3: an
 * alert must not look like an emergency, because most sensor alerts here are
 * false positives. `bg-surface-hi rounded-card`, no red, no orange-as-
 * warning, no warning triangle, no exclamation mark, no badge, no dot, no
 * pulse. The only decoration permitted is the hand-drawn band mark or a
 * Phosphor Bell Light in `text-accent` — this uses Bell.
 *
 * Safety rule: copy leads with the suggested action and her own perception,
 * never a diagnostic assertion. The word "detected" never appears. It never
 * shows sensor data as evidence for or against her concern.
 *
 * Two actions, both plain pill controls (never red): start a check-in
 * (entryPath is already 'alert', set by the push banner) or dismiss —
 * dismiss is one tap, never a confirmation dialog, and clears the 'alert'
 * entryPath too so a later ad hoc check-in isn't mislabelled.
 */

import type { ReactElement } from 'react';
import { Bell } from '@phosphor-icons/react';
import { ALERT_FRAMING_BODY, ALERT_FRAMING_TITLE } from '../data/clinicalContent';

export interface AlertFramingBlockProps {
  onCheckIn: () => void;
  onDismiss: () => void;
}

export function AlertFramingBlock({ onCheckIn, onDismiss }: AlertFramingBlockProps): ReactElement {
  return (
    <section
      aria-label="Notification"
      className="rounded-card bg-surface-hi p-[22px]"
    >
      <div className="flex items-start gap-3">
        <Bell size={24} weight="light" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <p className="text-body text-text">{ALERT_FRAMING_TITLE}</p>
          <p className="mt-2 text-body text-text">{ALERT_FRAMING_BODY}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onCheckIn}
          className="tap flex h-14 w-full items-center justify-center rounded-pill bg-accent px-6 text-label text-on-accent transition-opacity duration-[var(--dur-press)] active:opacity-[0.82]"
        >
          Check in
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="tap flex h-14 w-full items-center justify-center rounded-pill border border-line bg-surface px-6 text-label text-text transition-opacity duration-[var(--dur-press)] active:opacity-[0.82]"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
