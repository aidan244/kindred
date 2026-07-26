# Backend handover — connecting the Kindred patient app

You are picking up a working, fully-mocked React frontend and wiring it to real
systems. Everything below is grounded in the code on the `kindred-ui-walkthrough`
branch as it stands, not in a brief.

---

## How to use this document

`backend-connections.md` is still the main integration map — ten numbered
workstreams, each with what the frontend does today, the contract to honour, and
a pilot-blocking / production priority. **Read it first and treat it as the plan.**

This document exists because a design handoff was implemented after that map was
written, and it changed the sensor boundary. Section 2 below is the delta: the
parts of `backend-connections.md` that are now wrong or incomplete. Everything it
does not contradict still stands.

Read order:

1. `backend-connections.md` — the ten workstreams.
2. This file, section 2 — what changed underneath it.
3. `src/sensors/MovementStream.ts` — the one interface you implement.
4. `design_handoff_kindred_patient_app/README.md` — only if you need to know why
   a screen wants the shape of data it asks for.

`held-backend-integrations.md` is superseded. Ignore it unless
`backend-connections.md` explicitly cites it.

---

## 1. The job, in one paragraph

Every screen talks to the wearable through exactly one interface,
`MovementStream` in `src/sensors/MovementStream.ts`. Replacing
`MockMovementStream` with a real implementation of that interface is the whole
frontend-facing task — **no other file should need to change.** That was true
before the design handoff and is still true; the interface just grew a kick
channel. Everything else in `backend-connections.md` (report delivery,
identity, voice notes, content versioning) sits behind ordinary API calls and
is unaffected by the UI work.

One exception worth reading before you start on §6: **clinic contact
resolution is no longer a call route.** See 2.6.

---

## 2. What changed since `backend-connections.md` was written

### 2.1 `MovementStream` is no longer three methods

`backend-connections.md` §1 documents the interface as `subscribe`,
`getWindow`, `getBaseline`. That is now a subset. The current contract:

```ts
interface MovementStream {
  // --- movement, unchanged in shape ---
  subscribe(cb: (sample: ActivitySample) => void): () => void;
  getWindow(hours: number): ActivitySample[];
  getBaseline(): number;

  // --- kicks, new ---
  getDailyKickWindow(): KickWindow;   // Home's card
  getHourlyKickWindow(): KickWindow;  // the live view
  hasSignal(): boolean;
}

type ActivitySample = { timestamp: Date; moved: boolean };
type KickSample     = { timestamp: Date; kicks: number };  // timestamp = interval START
type KickWindow     = { samples: KickSample[]; settledIndex: number };
```

The band reports movement and kicks over the same link, so this is
deliberately one boundary rather than two. `getBaseline()` still means what
§1 says it means — read that paragraph, the exclusion of the most recent 24
hours is load-bearing and easy to reimplement wrongly.

**Neither kick method takes a span or a resolution, and that is deliberate.**
A kick count is a TALLY OVER AN INTERVAL, not a value at an instant, so "the
same data at a different resolution" is not a thing that exists — a day and
an hour are two different measurements, not two samplings of one signal. Home
asks for days, the live view asks for hours, and the caller picks the
question rather than parameterising one. Currently 7 daily buckets and 12
hourly ones; if you need those counts to be configurable, change the
signature rather than making the caller resample.

### 2.2 `settledIndex` marks the last COMPLETE interval

`KickWindow.settledIndex` is the index of the last **finished** bucket.
Everything after it — in practice the final entry — is the interval still in
progress, which the trace draws as a greyed incoming edge with the dot on the
boundary.

This is not a display convention, it is arithmetic, and getting it wrong has
a specific consequence: **the current bucket is always lower than its
neighbours because it is unfinished.** A UI that drew it at full weight would
show every patient a decline, every single day, forever. Both screens
therefore print `samples[settledIndex]` as their headline number, never the
last entry.

Return `samples.length - 2` when the final bucket is partial, and
`samples.length - 1` when every bucket you return is complete.

(This replaces an earlier note about a `SETTLED_FRACTION` of 0.62, which was a
heart-rate-era placeholder and no longer exists.)

### 2.3 An offline band must return nothing, everywhere

`hasSignal()` is new, and **`getWindow()` is now gated on it too** — it
returns `[]` when the band is silent, which it did not before.

This is a correctness fix, not tidiness. Home and the live view render their
no-signal state from the kick windows; `reportAssembly` pulls ~288 movement
samples from `getWindow()` for the same period and puts them in the report
that rule 4e has **already sent to the clinic**. Before the gate, an offline
band produced a screen saying "no signal" and a clinician-facing report full
of confident movement data for the same hours.

Your implementation must hold the same line: **no signal returns empty, in
every method, and never a flat line at a baseline.** A flat line is a claim.
This boundary does not make claims. `getBaseline()` is the one deliberate
exception — it is a historical figure that an offline band says nothing about
— and the reasoning is written at the method.

`setBandSignal()` is demo-only plumbing (`AppStateContext` mirrors the demo
panel's `bandOffline` toggle into it). A real implementation derives signal
from the link and should not export it.

### 2.4 Delete the seed data

`src/data/seedKicks.ts` is two hardcoded tables — kicks per day and kicks per
hour — chosen to look plausible on screen. No clinical validity, no
thresholds, not a model of anything. It goes when you land.

Note the shape it encodes, because your tables should match: the last entry of
each is the current, in-progress interval, and is deliberately lower than its
neighbours.

### 2.5 The live view's session is fake

`SESSION_TOTAL_SECONDS = 1046` in `src/screens/LiveView.tsx` is hardcoded, and
the "Listening since HH:MM" line is derived from it. There is no session
concept in the backend yet. Decide whether a listening session is a real
server-side object (start, duration, state) or purely a client-side view of a
continuous stream, and tell the frontend which — the ring and the clock both
depend on the answer.

### 2.6 There is exactly one call route now, and it is not the clinic

`backend-connections.md` §6 is about resolving WHICH number a patient sees —
her private clinic in opening hours, the booked maternity unit outside them.
**That resolution no longer drives any call control.** Every call affordance
in the product is now "Call paramedics" on 999. Removed: the clinic/unit
distinction, the quiet 999 fallback note, the routine outcome's "call your
clinic" bar, and a separate operator line that briefly existed.

`getTriageContact()` still exists and §6's hours logic still runs — but only
to NAME a clinic in the report's "sent to" line and to set expectations about
when someone will read it. Nothing dials it.

So §6 drops from a call-routing dependency to a display-name lookup. The
escalation-tier thresholds in that same section still matter: they decide the
outcome screen's framing, just not its number.

---

## 3. Constraints that bind the backend too

These are safety properties, enforced in the frontend by
`src/test/invariants.test.ts`. Several can be broken from your side.

- **Patient-facing copy never says "detected"**, never uses an uppercase
  warning, and never uses an exclamation mark. This applies to **push
  notification payloads**, which the frontend does not author. The test sweeps
  `clinicalContent.ts`; it cannot see your payloads.
- **Never send a verdict.** The app shows the shape of data and stops. No score,
  no "normal"/"abnormal", no interpretation. If an API starts returning a
  classification, there is nowhere in this UI it can legitimately be displayed.
- **Empty renders nothing.** No zero-filled buckets, no baseline row, no
  placeholder series. This is now enforced in the PDF too — an empty activity
  window prints a single absence statement rather than 24 zeroed rows.
- **Red is one component.** `--emergency` appears only in `EmergencyCall.tsx`.
  Do not introduce a severity field expecting the UI to colour by it.
- **`entryPath: 'alert'` always escalates**, regardless of her answers — see
  `src/logic/disposition.ts`. If you change what triggers a push, you change
  who gets escalated.

---

## 4. Where to start

`backend-connections.md` marks priorities. The shortest path to something real:

1. **Wearable ingest** (§1) — nothing else has real data without it. Implement
   `MovementStream` against your ingest tables, including the heart-rate
   methods and the empty-when-offline rule above.
2. **Report submission** (§3) — the check-in currently ends at
   `submitReport()` in `AppStateContext`, which sets local state and navigates.
   Nothing leaves the device.
3. **Identity and clinic association** (§5) — everything above is
   per-patient and currently reads one hardcoded fixture, `patientFixture`.

Voice notes (§4), content versioning (§7) and the optional live model (§8) can
follow.

---

## 5. Open questions needing a first-party answer

Carried from `backend-connections.md`, still unresolved, plus two new:

- **Does the band buffer when the phone is out of range, and for how long?**
  Decides whether the app can honestly say "last synced" or must say "last
  received". A patient-visible honesty question, not plumbing.
- **What is the clinic's practice-management system?** Determines whether report
  delivery is an API, a fax bridge, or a human inbox.
- **(New) Are your kick tallies aligned to calendar days and clock hours,
  or to rolling windows?** The UI labels them "7 days ago → today" and
  "12 hours ago → now", which reads as calendar-aligned. If yours roll, the
  labels are wrong rather than the data.
- **(New) Is a listening session a server-side object?** See 2.5.
- **The pre-eclampsia gap.** `clinicalContent.ts` documents that the six-category
  red-flag set has no headache / visual-disturbance / swelling category, which is
  the standard screen. It was flagged and deliberately not filled by an engineer.
  It is still open, and it is a clinician's call, not yours or mine.

---

## 6. What "done" looks like

- `MockMovementStream` is deleted, `src/data/seedHeartRate.ts` and
  `src/data/seedActivity.ts` are deleted, and no other file changed to make that
  work. If you had to touch a screen, the boundary leaked and that is worth
  fixing before you land.
- `npm test` passes, including `src/test/invariants.test.ts`.
- With the band disconnected, Home, the live view, and a downloaded report all
  agree that there is no data.
