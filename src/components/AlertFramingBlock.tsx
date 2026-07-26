/**
 * The framing block Home shows at the top when `alertActive` is true —
 * entered from the simulated push notification. Handoff README §"02 Home —
 * opened from the notification", the AlertFramingBlock bullet: radius 22,
 * `surface-hi`, padding 22, a 24px Bell in accent with a 2px top offset and a
 * 12px gap, the two body lines, then 24px below two full-width 56px pills
 * stacked 12px apart.
 *
 * THIS BLOCK IS NOW AN EMERGENCY PROMPT. It was designed not to be one, and
 * the rules it used to follow are recorded here because they were removed by
 * decision rather than by drift, and because putting them back is a small
 * edit that someone may well want to make.
 *
 * What it used to be: an alert must not look like an emergency, because most
 * sensor alerts here are false positives. No red, no warning triangle, no
 * exclamation mark, no badge, no pulse. Copy led with the suggested action and
 * her own perception, never a diagnostic assertion — it opened "You know your
 * baby best." and never used the word "detected".
 *
 * What it is now, and the three things that changed:
 *
 *  - THE COPY ASSERTS A FINDING AND INSTRUCTS A CALL. See the note on
 *    ALERT_FRAMING_TITLE in src/data/clinicalContent.ts for the full list of
 *    voice rules this departs from. "You know your baby best" is gone, which
 *    is rule 2 (her perception always wins) no longer being stated at the one
 *    moment it applies.
 *  - THE CALL CONTROL IS FIRST, AND IT IS RED. The copy says call as soon as
 *    possible and fill in the form while waiting, so the call is the primary
 *    action and the check-in the secondary one; the pills are ordered to
 *    match. Red is still EmergencyCall's own and appears nowhere else here —
 *    no red borders, badges or text were introduced.
 *  - THERE IS NO WAY OUT. The block used to offer "Dismiss". Nothing
 *    patient-facing now clears an active alert; it stays until a check-in
 *    re-enters the flow. Under copy that asserts a detected anomaly, that is a
 *    prompt to call an ambulance which cannot be acknowledged or cleared.
 *
 * The Bell in `text-accent` is the one piece of the old restraint still
 * standing, and it now sits above copy that contradicts it.
 *
 * The second pill carries the KindredMark because it IS the "Speak to Kindred"
 * control — it starts the same check-in as the docked one and shares its
 * label, so it must not read as a different, lesser affordance that happens to
 * use the same words.
 */

import type { ReactElement } from 'react';
import { Bell } from '@phosphor-icons/react';
import { EmergencyCall } from './EmergencyCall';
import { KindredMark } from './KindredMark';
import {
  ALERT_FRAMING_BODY,
  ALERT_FRAMING_TITLE,
  CHECK_IN_CONTROL_LABEL,
} from '../data/clinicalContent';

export interface AlertFramingBlockProps {
  onCheckIn: () => void;
}

// Both pills: the README's 56px, expressed as a minimum rather than a height
// so they grow instead of clipping when text is scaled to 200%.
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

      {/* CALL FIRST, FORM SECOND — the order the copy above asks for. The one
          component that owns red, at its own geometry (64px rather than this
          block's 56px pills). Not restyled down to match: it is the same
          control here as in every dock, and a call control that changed size
          by context would be a second version of it. */}
      <div className="mt-6 flex flex-col gap-3">
        <EmergencyCall prominence="standard" />
        {/* The check-in, now the secondary action: "fill in the form while you
            wait". Kept at accent weight rather than demoted to a plain
            surface pill — it is the same control as the docked one and must
            not read as a lesser affordance that happens to share the label. */}
        <button
          type="button"
          onClick={onCheckIn}
          className={`${PILL_CLASSES} bg-accent text-on-accent`}
        >
          <KindredMark size={24} className="shrink-0" />
          {CHECK_IN_CONTROL_LABEL}
        </button>
      </div>
    </section>
  );
}
