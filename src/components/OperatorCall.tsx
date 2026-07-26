/**
 * The operator route — handoff README, "Operator route". A quiet accent row
 * directly beneath the primary/bar control on every screen (and beneath the
 * 999 note on the triage screens), so a human being is always one tap away
 * without her having to first decide whether what she is feeling counts as
 * clinical.
 *
 * Deliberately understated: no fill, no border, no shadow, accent colour
 * only. It sits in the same stack as the emergency control and must never
 * compete with it for weight.
 *
 * Like EmergencyCall, this control NEVER animates — no press fade, no
 * haptic (handoff README: "No haptic on the emergency or operator
 * controls"). It is the one thing on screen that behaves identically whether
 * she is calm or shaking.
 */

import type { ReactElement } from 'react';
import { PhoneCall } from '@phosphor-icons/react';
import { OPERATOR_ACCESSIBLE_LABEL, OPERATOR_LABEL, OPERATOR_NUMBER } from '../data/clinicalContent';

function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`;
}

export function OperatorCall(): ReactElement {
  return (
    <a
      href={telHref(OPERATOR_NUMBER)}
      aria-label={OPERATOR_ACCESSIBLE_LABEL}
      className="tap flex w-full items-center justify-center gap-[10px] rounded-pill px-4 text-label text-accent"
    >
      <PhoneCall size={20} weight="light" aria-hidden="true" />
      <span>{OPERATOR_LABEL}</span>
    </a>
  );
}
