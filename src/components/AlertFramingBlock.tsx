/**
 * The framing block Home shows at the top when `alertActive` is true —
 * entered from the simulated push notification. Handoff README §"02 Home —
 * opened from the notification", the AlertFramingBlock bullet: radius 22,
 * `surface-hi`, padding 22, a 24px Bell in accent with a 2px top offset and a
 * 12px gap, the two body lines, then 24px below two full-width 56px pills
 * stacked 12px apart.
 *
 * An alert must not look like an emergency, because most sensor alerts here
 * are false positives: no red, no orange-as-warning, no warning triangle, no
 * exclamation mark, no badge, no dot, no pulse. The only decoration permitted
 * is the hand-drawn band mark or a Phosphor Bell Light in `text-accent` —
 * this uses Bell.
 *
 * Safety rule: copy leads with the suggested action and her own perception,
 * never a diagnostic assertion. The word "detected" never appears. It never
 * shows sensor data as evidence for or against her concern.
 *
 * Two actions, both plain pill controls (never red). The first carries the
 * KindredMark, because it IS the "Speak to Kindred" control — it starts the
 * same check-in as the docked one and shares its label, so it must not read
 * as a different, lesser affordance that happens to use the same words. The
 * second dismisses: one tap, never a confirmation dialog, and it clears the
 * 'alert' entryPath too so a later ad hoc check-in isn't mislabelled.
 */

import type { ReactElement } from 'react';
import { Bell } from '@phosphor-icons/react';
import { KindredMark } from './KindredMark';
import {
  ALERT_FRAMING_BODY,
  ALERT_FRAMING_DISMISS_LABEL,
  ALERT_FRAMING_TITLE,
  CHECK_IN_CONTROL_LABEL,
} from '../data/clinicalContent';

export interface AlertFramingBlockProps {
  onCheckIn: () => void;
  onDismiss: () => void;
}

// Both pills: the README's 56px, expressed as a minimum rather than a height
// so they grow instead of clipping when text is scaled to 200%.
const PILL_CLASSES =
  'tap press flex min-h-14 w-full items-center justify-center gap-3 rounded-pill px-6 py-2 text-label';

export function AlertFramingBlock({ onCheckIn, onDismiss }: AlertFramingBlockProps): ReactElement {
  return (
    <section aria-label="Notification" className="rounded-card bg-surface-hi p-[22px]">
      <div className="flex items-start gap-3">
        {/* mt-0.5 is the README's 2px optical offset: the bell's drawn body
            sits above the first line's baseline without it. */}
        <Bell size={24} weight="light" className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <div className="flex flex-col gap-2">
          <p className="text-body text-text">{ALERT_FRAMING_TITLE}</p>
          <p className="text-body text-text">{ALERT_FRAMING_BODY}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onCheckIn}
          className={`${PILL_CLASSES} bg-accent text-on-accent`}
        >
          <KindredMark size={24} className="shrink-0" />
          {CHECK_IN_CONTROL_LABEL}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={`${PILL_CLASSES} border border-line bg-surface text-text`}
        >
          {ALERT_FRAMING_DISMISS_LABEL}
        </button>
      </div>
    </section>
  );
}
