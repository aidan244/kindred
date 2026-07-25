/**
 * The emergency call control — the ONE place in the entire product that
 * uses the `--emergency` (red) token. See design-plan.md §9.2 and the
 * clinical safety rules: red is reserved for this control alone, it is
 * never a verdict, never a warning triangle, never disabled, never
 * animated.
 *
 * One component, reused unchanged:
 *  - on every screen of the triage flow (`prominence="standard"`), docked
 *    in a fixed position so it is always reachable regardless of which
 *    category she is on;
 *  - as the leading element of the outcome screen's escalation state
 *    (`prominence="lead"`), where the number becomes the largest
 *    interactive element on the screen.
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
 *    quiet secondary route beneath it is the 999 fallback — `secondaryNote`,
 *    unchanged from before this rework.
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
import { EMERGENCY_DEFAULT_NOTE } from '../data/clinicalContent';

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

function primaryLabel(contact: TriageContact): string {
  if (contact.kind === 'emergency') {
    return 'Call 999';
  }
  return contact.kind === 'clinic' ? 'Call the clinic' : 'Call the unit';
}

export function EmergencyCall({
  contact,
  prominence = 'standard',
  secondaryNote = EMERGENCY_DEFAULT_NOTE,
  secondaryContact,
  className = '',
}: EmergencyCallProps): ReactElement {
  const isLead = prominence === 'lead';

  return (
    <div className={`flex w-full flex-col gap-3 ${className}`}>
      <a
        href={telHref(contact.number)}
        className={`tap flex w-full flex-col items-center justify-center gap-1 rounded-pill bg-emergency text-on-emergency ${
          isLead ? 'min-h-16 px-6 py-6' : 'min-h-16 px-6 py-3'
        }`}
      >
        <span className="flex items-center gap-3 text-label">
          <PhoneCall size={28} weight="light" aria-hidden="true" />
          <span>{primaryLabel(contact)}</span>
        </span>
        {isLead && <span className="text-title">{contact.number}</span>}
      </a>
      {secondaryContact ? (
        <a
          href={telHref(secondaryContact.number)}
          className="tap flex w-full items-center justify-center gap-2 rounded-pill px-4 text-center text-label text-text-muted"
        >
          <PhoneCall size={20} weight="light" aria-hidden="true" />
          <span>
            For anything else, call {secondaryContact.label} on {secondaryContact.number}
          </span>
        </a>
      ) : (
        <a
          href="tel:999"
          className="tap flex w-full items-center justify-center gap-2 rounded-pill px-4 text-center text-label text-text-muted"
        >
          <PhoneCall size={20} weight="light" aria-hidden="true" />
          <span>{secondaryNote}</span>
        </a>
      )}
    </div>
  );
}
