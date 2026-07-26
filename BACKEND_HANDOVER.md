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
before the design handoff and is still true; the interface just grew a
heart-rate channel. Everything else in `backend-connections.md` (report
delivery, identity, clinic contact resolution, voice notes, content versioning)
sits behind ordinary API calls and is unaffected by the UI work.

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

  // --- heart rate, new ---
  getHeartRateWindow(spanMinutes: number, stepSeconds: number): HeartRateWindow;
  getLiveHeartRateWindow(spanMinutes: number, stepSeconds: number): HeartRateWindow;
  hasSignal(): boolean;
}

type ActivitySample   = { timestamp: Date; moved: boolean };
type HeartRateSample  = { timestamp: Date; bpm: number };
type HeartRateWindow  = { samples: HeartRateSample[]; settledIndex: number };
```

The band reports movement and heart rate over the same link, so this is
deliberately one boundary rather than two. `getBaseline()` still means what §1
says it means — read that paragraph, the exclusion of the most recent 24 hours
is load-bearing and easy to reimplement wrongly.

**What the UI actually asks for.** Match these or the traces will look wrong:

| Caller | Call | Meaning |
| --- | --- | --- |
| `LiveDataCard` (Home) | `getHeartRateWindow(1440, 600)` | 24 hours at 10-minute resolution — 144 points. A settled record of the day. |
| `LiveView` | `getLiveHeartRateWindow(2, 1)` | 2 minutes at 1-second resolution — 120 points, re-polled while the screen is open. |

### 2.2 `settledIndex` is a real property of your feed, not a display constant

`HeartRateWindow.settledIndex` is the last sample the band has **confirmed**.
Everything after it is still arriving, and the live view draws that tail greyed
with the live-sample dot sitting on the boundary.

The mock hard-codes `SETTLED_FRACTION = 0.62` because the design reference draws
the switch at 62% of the trace width. **That number is a placeholder for a
property of your ingest pipeline** — how far behind real-time your confirmed
data actually runs. Return the honest index. If your feed confirms
instantly, return `samples.length - 1` and the greyed tail correctly disappears;
the UI handles that without changes.

Do not reproduce 0.62 to make it look like the mock.

### 2.3 An offline band must return nothing, everywhere

`hasSignal()` is new, and **`getWindow()` is now gated on it too** — it returns
`[]` when the band is silent, which it did not before.

This is a correctness fix, not tidiness. Home and the live view render their
no-signal state from the heart-rate windows; `reportAssembly` pulls ~288
movement samples from `getWindow()` for the same period and puts them in the
report that rule 4e has **already sent to the clinic**. Before the gate, an
offline band produced a screen saying "no signal" and a clinician-facing report
full of confident movement data for the same hours.

Your implementation must hold the same line: **no signal returns empty, in every
method, and never a flat line at the baseline.** A flat line is a claim. This
boundary does not make claims. `getBaseline()` is the one deliberate exception —
it is a historical figure that an offline band says nothing about — and the
reasoning is written at the method.

`setBandSignal()` is demo-only plumbing (`AppStateContext` mirrors the demo
panel's `bandOffline` toggle into it). A real implementation derives signal from
the link and should not export it.

### 2.4 Delete the seed generator

`src/data/seedHeartRate.ts` is a deterministic stand-in — a continuous function
of absolute time, written that way so Home's 10-minute sampling and the live
view's 1-second sampling agree about the same instant. It has no clinical
validity and is not a model of anything. It goes when you land.

### 2.5 The live view's session is fake

`SESSION_TOTAL_SECONDS = 1046` in `src/screens/LiveView.tsx` is hardcoded, and
the "Listening since HH:MM" line is derived from it. There is no session
concept in the backend yet. Decide whether a listening session is a real
server-side object (start, duration, state) or purely a client-side view of a
continuous stream, and tell the frontend which — the ring and the clock both
depend on the answer.

### 2.6 A new phone number needs provisioning

The operator route (`OPERATOR_NUMBER` in `src/data/clinicalContent.ts`,
`0800 055 1122`) is new and appears on **every screen**, directly under the
primary control. It is currently a placeholder `tel:` link.

`backend-connections.md` §10 says telephony needs no integration because
`tel:` links dial natively. That still holds technically — but this number is a
promise that a human answers. Provisioning it, staffing it, and defining what
that operator can and cannot do is a real dependency, not a frontend detail.
Raise it with whoever owns the service model before pilot.

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
- **(New) How far behind real-time is confirmed heart-rate data?** This is
  `settledIndex` — see 2.2.
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
