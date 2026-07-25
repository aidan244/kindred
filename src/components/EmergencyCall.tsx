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
 *    question she is on;
 *  - as the leading element of the outcome screen's escalation state
 *    (`prominence="lead"`), where the number becomes the largest
 *    interactive element on the screen.
 *
 * It never appears on the outcome screen's routine state — that state's
 * "call your clinic" affordance is a plain, non-emergency control rendered
 * by Outcome.tsx itself, deliberately not this component, so red still only
 * ever appears here.
 *
 * The 999 route lives inside this same component, always rendered directly
 * beneath the primary control, always visually quieter (muted text, no
 * fill) — it must never carry equal visual weight to the primary number.
 */

import type { ReactElement } from 'react';
import { PhoneCall } from '@phosphor-icons/react';
import type { TriageContact } from '../types';
import { EMERGENCY_DEFAULT_NOTE } from '../data/clinicalContent';

export interface EmergencyCallProps {
  contact: TriageContact;
  /**
   * 'standard' — the compact docked control shown on every triage-flow
   * screen. 'lead' — the large hero control on the outcome escalation
   * state, where the number must be the biggest interactive element on
   * the screen.
   */
  prominence?: 'standard' | 'lead';
  /**
   * Overrides the default 999 framing. Still rendered with identical,
   * quieter styling — only the words may reflect a specific red flag she
   * raised (e.g. bleeding), never the visual weight.
   */
  secondaryNote?: string;
  className?: string;
}

function telHref(number: string): string {
  const digits = number.replace(/[^\d+]/g, '');
  return `tel:${digits}`;
}

export function EmergencyCall({
  contact,
  prominence = 'standard',
  secondaryNote = EMERGENCY_DEFAULT_NOTE,
  className = '',
}: EmergencyCallProps): ReactElement {
  const isLead = prominence === 'lead';
  const contactNoun = contact.kind === 'clinic' ? 'clinic' : 'unit';

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
          <span>Call the {contactNoun}</span>
        </span>
        {isLead && <span className="text-title">{contact.number}</span>}
      </a>
      <a
        href="tel:999"
        className="tap flex w-full items-center justify-center gap-2 rounded-pill px-4 text-center text-label text-text-muted"
      >
        <PhoneCall size={20} weight="light" aria-hidden="true" />
        <span>{secondaryNote}</span>
      </a>
    </div>
  );
}
