/**
 * The emergency call control — handoff README, "EmergencyCall", and the ONE
 * place in the entire product that uses the `--emergency` (red) token. Red is
 * reserved for this control alone: never a badge, a border, an icon, an alert
 * or a validation state anywhere else.
 *
 * It is never a verdict, never a warning triangle, never uppercase, never
 * disabled, and it NEVER animates — no `press` class, no shadow, no pulse, no
 * haptic. Every other control in the product fades on press; this one and the
 * operator route deliberately do not, so they behave identically whether she
 * is calm or shaking, and so nothing about the emergency route can read as a
 * state that might be "off".
 *
 * One component, reused unchanged:
 *  - on every screen of the triage flow (`prominence="standard"`): min-height
 *    64, pill, PhoneCall Light 28px, "Call the clinic" in clinic hours /
 *    "Call the unit" out of hours, with the quiet 999 note beneath it;
 *  - as the leading element of the outcome screen's escalation state
 *    (`prominence="lead"`): the same pill in a column, "Call 999" plus the
 *    numeral at title size, so the NUMBER is the largest interactive element
 *    on the screen — the whole point of the lead variant.
 *
 * It never appears on the outcome screen's routine state — that state's
 * "call your clinic" affordance is a plain, non-emergency control rendered
 * by Outcome.tsx itself, deliberately not this component, so red still only
 * ever appears here.
 *
 * Escalation tier (held-build-brief.md placeholder_content, "Escalation
 * tier") changes only the number and framing here, nothing else about the
 * component's structure:
 *  - Triage tier (the only tier this component sees inside the triage flow
 *    itself, and the outcome screen's routine-adjacent escalate case): the
 *    `contact` prop is the resolved maternity/clinic triage line, and the
 *    quiet secondary route beneath it is the 999 fallback — `secondaryNote`.
 *  - Emergency tier (the outcome screen only — src/screens/Outcome.tsx):
 *    the caller passes a 999 pseudo-`TriageContact` (kind: 'emergency') as
 *    `contact`, so 999 becomes the PRIMARY control, and passes the resolved
 *    triage contact as `secondaryContact` instead of `secondaryNote` — the
 *    triage line moves below the fold as the quiet secondary route. Passing
 *    both would put two numbers at equal weight, which is the one thing
 *    this component must never do, so `secondaryContact` always wins over
 *    `secondaryNote` when both are supplied.
 */

import type { ReactElement } from 'react';
import { PhoneCall } from '@phosphor-icons/react';
import type { TriageContact } from '../types';
import {
  EMERGENCY_DEFAULT_NOTE,
  emergencyCallAccessibleLabel,
  emergencyCallLabel,
  emergencySecondaryContactNote,
} from '../data/clinicalContent';

export interface EmergencyCallProps {
  /** The primary route. Triage tier: `getTriageContact()`'s result
   * (kind: 'clinic' | 'unit'). Emergency tier: a 999 pseudo-contact
   * (kind: 'emergency') — see EMERGENCY_TIER_CONTACT in
   * src/screens/Outcome.tsx. */
  contact: TriageContact;
  /**
   * 'standard' — the compact docked control shown on every triage-flow
   * screen. 'lead' — the large hero control on the outcome escalation
   * state, where the number must be the biggest interactive element on
   * the screen.
   */
  prominence?: 'standard' | 'lead';
  /**
   * The quiet 999 fallback note — triage tier only. Still rendered with
   * identical, quieter styling — only the words may reflect a specific red
   * flag she raised (e.g. bleeding), never the visual weight. Ignored when
   * `secondaryContact` is supplied.
   */
  secondaryNote?: string;
  /**
   * Emergency tier only: the maternity/clinic triage contact, rendered as
   * the quiet secondary route in place of `secondaryNote` — 999 is already
   * primary in this tier, so the secondary must be a different number, not
   * a second 999 link.
   */
  secondaryContact?: TriageContact;
  className?: string;
}

function telHref(number: string): string {
  const digits = number.replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}

/**
 * Every word this component renders now comes from
 * src/data/clinicalContent.ts — the three primary labels, the accessible name,
 * the secondary route's sentence and the default 999 note. They are the words
 * on the one control the product exists to make reachable, and they used to be
 * literals in this file with no note conceding it.
 */
function accessibleCallLabel(contact: TriageContact): string {
  return emergencyCallAccessibleLabel(contact.kind, contact.number);
}

export function EmergencyCall({
  contact,
  prominence = 'standard',
  secondaryNote = EMERGENCY_DEFAULT_NOTE,
  secondaryContact,
  className = '',
}: EmergencyCallProps): ReactElement {
  const isLead = prominence === 'lead';

  // The quiet route beneath the fill. Caption weight, muted — the README is
  // explicit that this row is a CAPTION and not a label: at label weight it
  // starts competing with the control above it, and the whole design of this
  // block is that exactly one number carries visual weight at a time. It
  // stays a real `tel:` link (the prototype draws it as static text) because
  // a number she can read but not tap is a worse safety story than a quiet
  // one she can, and `tap` keeps it at the 56px floor either way.
  const secondaryRowClasses =
    'tap flex w-full items-center justify-center gap-2 rounded-pill px-4 text-center text-caption text-text-muted';

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <a
        href={telHref(contact.number)}
        aria-label={accessibleCallLabel(contact)}
        // No `press`, no `shadow-*`, no transition — see the header. `min-h-16`
        // is the README's 64, as a minimum rather than a height so the pill
        // grows instead of clipping at 200% text.
        className={`tap flex w-full flex-col items-center justify-center gap-1 rounded-pill bg-emergency text-on-emergency ${
          isLead ? 'min-h-16 p-6' : 'min-h-16 px-6 py-3'
        }`}
      >
        <span className="flex items-center gap-3 text-center text-label">
          <PhoneCall size={28} weight="light" className="shrink-0" aria-hidden="true" />
          <span>{emergencyCallLabel(contact.kind)}</span>
        </span>
        {/* The numeral: title size, so it is the largest interactive element
            on the outcome screen. aria-hidden because the anchor's label
            already speaks the number — a screen reader should hear it once. */}
        {isLead && (
          <span className="text-title" aria-hidden="true">
            {contact.number}
          </span>
        )}
      </a>
      {secondaryContact ? (
        <a href={telHref(secondaryContact.number)} className={secondaryRowClasses}>
          <PhoneCall size={20} weight="light" className="shrink-0" aria-hidden="true" />
          <span>
            {emergencySecondaryContactNote(secondaryContact.label, secondaryContact.number)}
          </span>
        </a>
      ) : (
        <a href="tel:999" className={secondaryRowClasses}>
          <PhoneCall size={20} weight="light" className="shrink-0" aria-hidden="true" />
          <span>{secondaryNote}</span>
        </a>
      )}
    </div>
  );
}
