/**
 * The framing block Home shows at the top when `alertActive` is true —
 * entered from the simulated push notification. Handoff README §"02 Home —
 * opened from the notification", the AlertFramingBlock bullet: radius 22,
 * `surface-hi`, padding 22, a 24px Bell in accent with a 2px top offset and a
 * 12px gap, the two body lines, then 24px below two full-width 56px pills
 * stacked 12px apart.
 *
 * DELIBERATE DEPARTURE, ON INSTRUCTION, NOT AN OVERSIGHT. This block used to
 * offer "Speak to Kindred" plus a plain "Dismiss" — no red, no urgency,
 * because most sensor alerts here are false positives and nothing had been
 * assessed yet. The second control is now EmergencyCall itself: a direct 999
 * line from an unconfirmed alert, before any check-in question has been
 * asked. That is rule 5 ("movement data never determines disposition") in
 * its most direct form, raised and knowingly accepted rather than built
 * quietly — see this feature's own conversation for the tradeoff as stated.
 * It does not trip invariant 1's file-scoped emergency-token sweep, because
 * this renders the existing EmergencyCall component rather than duplicating
 * its styling — there is still exactly one implementation of "dial 999" in
 * the product, just a second place it's mounted.
 *
 * ALSO GONE: the neutral "I'm fine, dismiss this" exit. Tapping the alert
 * card now only ever leads to a check-in or a call — there is no longer a
 * third option that ends the alert without either. Flagged the same way as
 * everything above: a real, visible consequence of this change, not
 * something to quietly re-add.
 *
 * Safety rule (everything else, unchanged): copy leads with the suggested
 * action and her own perception, never a diagnostic assertion. The word
 * "detected" never appears. It never shows sensor data as evidence for or
 * against her concern.
 */

import type { ReactElement } from 'react';
import { Bell } from '@phosphor-icons/react';
import { EmergencyCall } from './EmergencyCall';
import { KindredMark } from './KindredMark';
import { ALERT_FRAMING_BODY, ALERT_FRAMING_TITLE, CHECK_IN_CONTROL_LABEL } from '../data/clinicalContent';

export interface AlertFramingBlockProps {
  onCheckIn: () => void;
}

// The one remaining pill here: the README's 56px, expressed as a minimum
// rather than a height so it grows instead of clipping when text is scaled
// to 200%. EmergencyCall draws its own matching pill at `standard`
// prominence, so the two controls stay the same size without sharing a
// class string.
const PILL_CLASSES =
  'tap press flex min-h-14 w-full items-center justify-center gap-3 rounded-pill px-6 py-2 text-label';

export function AlertFramingBlock({ onCheckIn }: AlertFramingBlockProps): ReactElement {
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
        <EmergencyCall prominence="standard" />
      </div>
    </section>
  );
}
