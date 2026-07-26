/**
 * The call control — the ONE way to reach anyone from inside this product,
 * and the ONE place that uses the `--emergency` (red) token. Red is reserved
 * for this control alone: never a badge, a border, an icon, an alert or a
 * validation state anywhere else.
 *
 * It is never a verdict, never a warning triangle, never uppercase, never
 * disabled, and it NEVER animates — no `press` class, no shadow, no pulse, no
 * haptic. Every other control in the product fades on press; this one
 * deliberately does not, so it behaves identically whether she is calm or
 * shaking, and so nothing about it can read as a state that might be "off".
 *
 * ONE ROUTE, ONE NUMBER. This component used to resolve between her private
 * clinic, the 24/7 maternity unit and 999, with a quiet secondary route
 * underneath whichever was primary. That is gone: it dials paramedics, and
 * that is the only thing it does. See the note on EMERGENCY_CALL_LABEL in
 * src/data/clinicalContent.ts for why, and for what went with it.
 *
 * The practical consequence is that this component now takes no `contact` and
 * has no secondary row. It CANNOT be pointed at a different number, which is
 * the point: there is no configuration here that could put a second number on
 * screen at equal weight, because there is no second number.
 *
 * IT IS DOCKED ON EVERY SCREEN BUT THE REVIEW STEP. It used to appear only on
 * the triage screens and the outcome screen's escalation state, which made the
 * route to paramedics conditional on her having already started a check-in.
 *
 * Two weights, unchanged:
 *  - `standard` (every docked appearance): min-height 64, pill, PhoneCall
 *    Light 28px, the label.
 *  - `lead` (the outcome screen): the same pill in a column, the label plus
 *    the numeral at title size, so the NUMBER is the largest interactive
 *    element on the screen — the whole point of the lead variant.
 */

import type { ReactElement } from 'react';
import { PhoneCall } from '@phosphor-icons/react';
import {
  EMERGENCY_CALL_ACCESSIBLE_LABEL,
  EMERGENCY_CALL_LABEL,
  EMERGENCY_NUMBER,
} from '../data/clinicalContent';

export interface EmergencyCallProps {
  /**
   * 'standard' — the compact docked control shown on every triage screen.
   * 'lead' — the large hero control on the outcome screen, where the number
   * must be the biggest interactive element present.
   */
  prominence?: 'standard' | 'lead';
  className?: string;
}

export function EmergencyCall({
  prominence = 'standard',
  className = '',
}: EmergencyCallProps): ReactElement {
  const isLead = prominence === 'lead';

  return (
    <a
      href={`tel:${EMERGENCY_NUMBER}`}
      aria-label={EMERGENCY_CALL_ACCESSIBLE_LABEL}
      // No `press`, no `shadow-*`, no transition — see the header. `min-h-16`
      // is the README's 64, as a minimum rather than a height so the pill
      // grows instead of clipping at 200% text.
      className={`tap flex w-full flex-col items-center justify-center gap-1 rounded-pill bg-emergency text-on-emergency ${
        isLead ? 'min-h-16 p-6' : 'min-h-16 px-6 py-3'
      } ${className}`}
    >
      <span className="flex items-center gap-3 text-center text-label">
        <PhoneCall size={28} weight="light" className="shrink-0" aria-hidden="true" />
        <span>{EMERGENCY_CALL_LABEL}</span>
      </span>
      {/* The numeral: title size, so it is the largest interactive element on
          the outcome screen. aria-hidden because the anchor's label already
          speaks the number — a screen reader should hear it once. */}
      {isLead && (
        <span className="text-title" aria-hidden="true">
          {EMERGENCY_NUMBER}
        </span>
      )}
    </a>
  );
}
