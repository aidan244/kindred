# Kindred

Patient-facing prototype of a pregnancy movement monitoring and triage app
for private maternity clinics. Mocked data, no backend.

## Run

```
npm install
npm run dev
```

No API keys, no env vars, no network calls needed.

```
npm test          # logic tests (Vitest)
npm run build     # production build
```

## Demo controls

A hidden demo panel — toggle with **Ctrl+.**, or tap the low-contrast dot
in the bottom-right corner. It can jump to any screen, fire the simulated
push notification (the alert entry path), reset state, switch seeded
activity between quiet/active, and override the clock. The clock override
drives both the day/night theme (day 07:00–20:00) and the clinic
open/closed contact resolution, since both read the same `now()`.

## Architecture

Vite + React 19 + TypeScript + Tailwind v4. Client-side routing. All state
lives in one React context — no external state library, since the app is a
single shallow tree of screens over shared demo state, so context is
sufficient.

All clinical placeholder copy is isolated in `src/data/clinicalContent.ts`,
marked for replacement by a clinician-sourced, version-pinned question set
before any real use. Seeded activity data is deterministic
(`src/data/seedActivity.ts`). Design tokens live only in
`src/styles/tokens.css`, with the full design rationale in
`design-plan.md`.

## Sensor interface boundary

The wearable sits behind one interface, `MovementStream`
(`subscribe`, `getWindow`, `getBaseline`) in
`src/sensors/MovementStream.ts`. The mock implementation reads seed data;
real hardware drops in behind the same interface with no screen changes.

## Pure logic

- `disposition(entryPath, answers)` — the alert path always escalates; ad
  hoc escalates on any positive red flag; only ad hoc with none is routine.
- `getTriageContact(now, patient)` — resolves ONE contact against the
  clock: the clinic line in hours, the booked 24/7 maternity unit out of
  hours.
- The jsPDF report generator, built with direct text layout.

All of the above are pure functions, covered by the Vitest suite (32 tests).

## Clinical safety rules

The dominant harm in consumer fetal monitoring is false reassurance — the
AFFIRM trial found movement-awareness packages didn't reduce stillbirth.
The anomaly detector will also often be wrong, because the underlying
event is rare. So:

- The app never renders a verdict about the baby's wellbeing. No green
  states, no "normal", no reassuring ticks — it shows data and offers
  actions.
- Her perception always wins: the "Check in" control is the same
  component, in the same position, on every screen, and sensor data is
  never shown as a counterargument to how she feels.
- Alert copy is written to survive being wrong: "Worth checking on your
  baby's movements" — never "detected".
- Escalation is always to a maternity triage line resolved against the
  clock, never A&E, and the screen says call, not attend — the clinician
  on the phone decides attendance. 999 is a distinct, secondary route for
  heavy bleeding, collapse, or fitting.
- Red appears exactly once in the product: on the emergency call control.
  That single component is now docked on every screen except the review
  step — under Speak to Kindred where that control is present, alone on the
  triage screens, and as the lead control on the outcome screen's
  escalation state. It is also the second action on the alert framing
  block. Red appears nowhere else. Reaching paramedics no longer depends on
  her having already started a check-in.
- A report goes to the clinic on every outcome.
- The activity visuals are deliberately ambient and non-clinical — no CTG
  traces, waveforms, or scores — because monitor aesthetics are a fear
  cue.

## Assumptions

- Clinic hours fixture: 08:00–18:00, daily.
- The open interval is inclusive at opening, exclusive at closing.
- Seed activity data is anchored to real wall-clock time; the clock
  override drives the theme and contact resolution, not the seed data's
  own timestamps.
- The reduced-or-changed-movements question was added by the engineering
  team so that a patient's perception of reduced movement escalates on the
  ad hoc path (rule: her perception always wins); wording pending
  clinician replacement like the rest of the placeholder set.
