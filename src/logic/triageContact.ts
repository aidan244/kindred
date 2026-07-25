/**
 * Resolves WHICH number a patient sees when she needs to call about reduced
 * movement or another red flag.
 *
 * Clinical context: in the UK, a woman past ~20 weeks with reduced fetal
 * movement (or another red flag) must call a maternity triage line directly
 * — this function never returns 999 or anything resembling an emergency
 * department; that is a separate, explicit UI route, not this function's
 * job. The private clinic in this prototype is not staffed 24/7, so the
 * contact resolves against the clock:
 *
 *  - Within the clinic's opening hours: her private clinic's own triage
 *    line (short, plain reason).
 *  - Outside clinic hours: the 24/7 maternity unit where she is booked to
 *    deliver, with a reason that says when the clinic reopens.
 *
 * Exactly one contact is returned — the resolution is the point. Never two
 * numbers of equal weight, and never the words "A&E" or "attend".
 *
 * Pure and deterministic: `now` is a parameter, not read from the system
 * clock, so this is fully testable without waiting for a particular time of
 * day.
 */

import type { Patient, TriageContact, ClinicHours } from '../types';

function minutesFromHHMM(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Whether `now` falls within the clinic's opening hours.
 *
 * Boundary semantics: opening time is inclusive (the clinic is open AT
 * `opens`), closing time is exclusive (the clinic is already closed AT
 * `closes`) — i.e. the open window is `[opens, closes)`. This also makes
 * overnight windows (opens > closes, e.g. "20:00"-"06:00") behave
 * consistently: open from `opens` up to midnight, and from midnight up to
 * (but not including) `closes`.
 *
 * Assumption: `ClinicHours` (src/types.ts) models a single opens/closes pair
 * with a free-text `daysDescription` (e.g. "every day") rather than
 * per-day-of-week hours. There is no structured per-day data to check
 * against, so we apply the same opens/closes window every calendar day,
 * regardless of `daysDescription`'s wording. If a future fixture adds real
 * per-day hours, this is the function to extend.
 */
function isWithinClinicHours(now: Date, hours: ClinicHours): boolean {
  const nowMinutes = minutesSinceMidnight(now);
  const opensMinutes = minutesFromHHMM(hours.opens);
  const closesMinutes = minutesFromHHMM(hours.closes);

  if (opensMinutes === closesMinutes) {
    // Degenerate configuration (open 24h or misconfigured as a zero-length
    // window) — not something the fixture data produces, but fail safe by
    // treating it as never open, so the 24/7 maternity unit is always a
    // valid fallback.
    return false;
  }

  if (opensMinutes < closesMinutes) {
    // Ordinary same-day window, e.g. 08:00-18:00.
    return nowMinutes >= opensMinutes && nowMinutes < closesMinutes;
  }

  // Overnight window, e.g. 20:00-06:00.
  return nowMinutes >= opensMinutes || nowMinutes < closesMinutes;
}

export function getTriageContact(now: Date, patient: Patient): TriageContact {
  const { clinic, bookedUnit } = patient;

  if (isWithinClinicHours(now, clinic.hours)) {
    return {
      label: clinic.name,
      number: clinic.triagePhoneNumber,
      reason: 'Your clinic is open now, call this number.',
      kind: 'clinic',
    };
  }

  return {
    label: bookedUnit.name,
    number: bookedUnit.triagePhoneNumber,
    reason: `Your clinic is closed until ${clinic.hours.opens}, call the maternity unit instead.`,
    kind: 'unit',
  };
}
