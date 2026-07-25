import { describe, expect, it } from 'vitest';
import { getTriageContact } from '../logic/triageContact';
import { patientFixture } from '../data/clinicalContent';

// patientFixture.clinic.hours = { opens: '08:00', closes: '18:00' }

function atLocalTime(hours: number, minutes: number): Date {
  return new Date(2026, 6, 25, hours, minutes, 0, 0);
}

describe('getTriageContact', () => {
  it('2pm on a normal day resolves to the clinic triage line', () => {
    const contact = getTriageContact(atLocalTime(14, 0), patientFixture);
    expect(contact.label).toBe(patientFixture.clinic.name);
    expect(contact.number).toBe(patientFixture.clinic.triagePhoneNumber);
    expect(contact.kind).toBe('clinic');
    expect(contact.reason.toLowerCase()).not.toContain('a&e');
  });

  it('2am resolves to the booked maternity unit, with a reason mentioning when the clinic opens', () => {
    const contact = getTriageContact(atLocalTime(2, 0), patientFixture);
    expect(contact.label).toBe(patientFixture.bookedUnit.name);
    expect(contact.number).toBe(patientFixture.bookedUnit.triagePhoneNumber);
    expect(contact.kind).toBe('unit');
    expect(contact.reason).toContain(patientFixture.clinic.hours.opens);
  });

  it('is open at the exact opening minute', () => {
    const contact = getTriageContact(atLocalTime(8, 0), patientFixture);
    expect(contact.label).toBe(patientFixture.clinic.name);
  });

  it('is closed at the exact closing minute', () => {
    const contact = getTriageContact(atLocalTime(18, 0), patientFixture);
    expect(contact.label).toBe(patientFixture.bookedUnit.name);
  });

  it('is closed one minute before opening and open one minute before closing', () => {
    expect(
      getTriageContact(atLocalTime(7, 59), patientFixture).label
    ).toBe(patientFixture.bookedUnit.name);
    expect(
      getTriageContact(atLocalTime(17, 59), patientFixture).label
    ).toBe(patientFixture.clinic.name);
  });

  it('returns exactly one contact object (label, number, reason, kind) — never two', () => {
    const contact = getTriageContact(atLocalTime(14, 0), patientFixture);
    expect(Object.keys(contact).sort()).toEqual(['kind', 'label', 'number', 'reason']);
  });

  it('never returns 999', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const contact = getTriageContact(atLocalTime(hour, 0), patientFixture);
      expect(contact.number).not.toBe('999');
      expect(contact.reason).not.toContain('999');
    }
  });

  it('never contains "A&E" or "attend" in any string field, across a full sweep of hours', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of [0, 15, 30, 45, 59]) {
        const contact = getTriageContact(atLocalTime(hour, minute), patientFixture);
        const combined = `${contact.label} ${contact.number} ${contact.reason}`;
        expect(combined).not.toContain('A&E');
        expect(combined.toLowerCase()).not.toContain('attend');
      }
    }
  });

  it('handles an overnight clinic window (opens > closes) consistently at both boundaries', () => {
    const overnightPatient = {
      ...patientFixture,
      clinic: {
        ...patientFixture.clinic,
        hours: { opens: '20:00', closes: '06:00', daysDescription: 'every day' },
      },
    };

    // Open through the evening and small hours.
    expect(getTriageContact(atLocalTime(20, 0), overnightPatient).label).toBe(
      overnightPatient.clinic.name
    );
    expect(getTriageContact(atLocalTime(23, 30), overnightPatient).label).toBe(
      overnightPatient.clinic.name
    );
    expect(getTriageContact(atLocalTime(5, 59), overnightPatient).label).toBe(
      overnightPatient.clinic.name
    );
    // Closed at the exact closing minute and through the day.
    expect(getTriageContact(atLocalTime(6, 0), overnightPatient).label).toBe(
      overnightPatient.bookedUnit.name
    );
    expect(getTriageContact(atLocalTime(12, 0), overnightPatient).label).toBe(
      overnightPatient.bookedUnit.name
    );
    // Open again at the exact opening minute.
    expect(getTriageContact(atLocalTime(19, 59), overnightPatient).label).toBe(
      overnightPatient.bookedUnit.name
    );
  });
});
