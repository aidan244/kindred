# Kindred: backend integration map

Every connection the backend team needs to build to take this frontend to production. Grounded in the code as it stands today, not the hackathon brief.

**This document supersedes `held-backend-integrations.md` wherever the two differ.** That file was written against the original flat six-question red-flag set with no escalation tier, no hard stop, and no voice notes. Since then the frontend has grown a six-category gated questionnaire (`src/data/clinicalContent.ts`), a two-tier escalation split (`src/logic/escalationTier.ts`, emergency vs. triage), a hard-stop interrupt that can end a check-in early with partial data, and voice notes attached at the category and closing-detail level. Where the old document made a recommendation that still holds (wearable ingest shape, the clinic-PMS "ask your design partner" advice, the compliance stack, telephony needing no integration), it is repeated or referenced here rather than re-litigated. Where it no longer matches the frontend, that is called out explicitly in each section below, and summarised in "What changed from the old doc" at the end.

Confidence note, carried over from the old doc: technology choices below are recommendations, not verified vendor decisions. The clinic's practice-management system and the exact regulatory pathway still need first-party confirmation.

Priority key: **pilot-blocking** (needed before any real patient touches this), **production** (needed to scale past a single design-partner clinic), or, where relevant, **none — demo-blocking** (nothing in this document blocks the current prototype; it runs standalone).

---

## 1. Wearable ingest and baseline computation

**What the frontend does today.** `MovementStream` (`src/sensors/MovementStream.ts`) is the single interface every screen talks to: `subscribe(cb)`, `getWindow(hours)`, `getBaseline()`. The mock (`MockMovementStream`) reads deterministic seed data from `src/data/seedActivity.ts` (14 days, 5-minute resolution, circadian-shaped) and fans live samples out to subscribers on a 4-second interval. `getBaseline()` is worth reading closely before reproducing it server-side: it takes the patient's *own* `'active'`-variant history, excludes the most recent 24 hours, and returns the fraction of samples that were `moved: true`. That exclusion is deliberate — it compares a quiet spell against what is normal for her outside the window under question, not against itself, so a real 24h reduction doesn't quietly drag its own baseline down. `InjectableMovementStream` (`injectSample`, `injectBurst`) is a demo-only capability narrowed via `asInjectable()`; a real stream should not implement it, and nothing outside `DemoPanel.tsx` may call it.

**Interface contract the backend must honour.** Whatever replaces `MockMovementStream` must satisfy the same three-method interface with no other file changing:

```ts
interface MovementStream {
  subscribe(cb: (sample: ActivitySample) => void): () => void;
  getWindow(hours: number): ActivitySample[];
  getBaseline(): number; // 0-1 fraction, "moved" rate over patient history minus recent window
}
// ActivitySample = { timestamp: Date; moved: boolean }
```

Sampling at 5-minute resolution over a third trimester is ~20,000 points per patient — small. Don't reach for a specialised time-series store; Postgres (optionally with TimescaleDB if query patterns demand it) is enough unless sampling frequency changes by an order of magnitude.

**Delivery/infra.** BLE device → phone → HTTPS batch upload → ingest API → per-patient time-series table. `getWindow`/`getBaseline` become authenticated reads against that table, scoped to the logged-in patient.

**Open question for the hardware team, unresolved since the old doc.** Does the wearable buffer locally when the phone is out of range, and for how long? That decides whether the app can honestly show "last synced" versus "last received" — a real, patient-visible honesty question, not just plumbing.

**Priority.** Pilot-blocking — nothing else in the product has real data without this.

---

## 2. Anomaly detection and push notification delivery

**What the frontend does today.** `PushBanner` (`src/components/PushBanner.tsx`) simulates the entire alert path: the demo panel fires it directly, no detector, no push service. Its copy is fixed and deliberately survives being wrong: "Worth checking on your baby's movements. Open when you're ready." — never "Reduced movement detected." All patient-facing alert and check-in copy is centralised in `src/data/clinicalContent.ts` (`ALERT_FRAMING_TITLE`, `ALERT_FRAMING_BODY`), and the rule that matters most for whoever writes the real notification payload: **the word "detected" must never appear on a patient-facing surface, in the app or in the notification.** Opening the notification sets `entryPath = 'alert'` (`AppStateContext.tsx`), which is load-bearing: `disposition()` (`src/logic/disposition.ts`) always escalates an alert-path check-in, regardless of her answers, even with zero red flags recorded.

**Interface contract.** Two services, cleanly separable:

1. An anomaly detector, watching each patient's stream against her own rolling baseline (see §1) and deciding when to fire. It must run server-side, not on-device: it needs the full baseline history, and its thresholds will need tuning without an app release. Every firing must be logged with model version, input window, and the threshold crossed — if this product is ever reviewed, that log is the evidence, and the honest caveat to carry into that log is that this detector will be frequently wrong, because the underlying event is rare. That's why the app escalates to a phone call rather than an attendance, and why no screen renders a reassuring state.
2. Push delivery — APNs/FCM directly, or a wrapper (OneSignal, Expo Notifications if this becomes React Native). Direct is cheaper at scale; a wrapper ships faster.

```json
// Illustrative push payload — copy sourced from clinicalContent.ts, not hand-written per alert
{ "title": "Kindred", "body": "Worth checking on your baby's movements. Open when you're ready.", "deepLink": "kindred://home?entry=alert" }
```

**Safety constraint.** The notification is the single most-read piece of copy in the product — it appears on a lock screen next to whatever else woke her at 3am. It must go through the same copy review as the app, not a separate one improvised by whoever wires up the push provider.

**Priority.** Pilot-blocking (delivery is currently entirely simulated — there is no alert path without it).

---

## 3. Report submission and delivery to the clinic

**What the frontend does today.** `submitReport()` (`src/context/AppStateContext.tsx`) does nothing but stamp local state — `{ status: 'submitted', submittedAt, hardStopEndedEarly }` — no network call exists. The actual payload is assembled separately by `assembleReportData()` (`src/screens/reportAssembly.ts`) into the `ReportData` shape (`src/types.ts`), pulling category answers, free text, voice notes, onboarding history, and 24h of activity + baseline from `MovementStream`. `Outcome.tsx` then renders from that assembled data and offers a client-side PDF download (§9) — but nothing currently transmits it anywhere.

Three non-negotiables are already encoded in the frontend and must survive the real integration unchanged:

- **A report goes on every outcome, not just escalations.** `TriageFlow.tsx` calls `submitReport()` on the normal review-screen Send (line ~239) *and* on both hard-stop exits (`handleHardStop`, lines ~249/258) — `submitReport({ endedEarly: true })`. The clinic holds the continuity relationship even when it's closed and even when the check-in never reached review.
- **Hard-stop reports carry partial data honestly.** `ReportData.hardStopEndedEarly` tells the PDF (and must tell whatever renders the clinic-side version) that categories with no entry in `categoryAnswers` were genuinely never asked, not silently skipped or answered no (`reportPdf.ts`'s `buildRedFlagParagraphs` renders this distinction explicitly — see §9). A backend report renderer must preserve that distinction; collapsing "not asked because of a hard stop" into "not asked" loses clinically relevant information about why the check-in ended where it did.
- **Safeguarding routing is silent and server-side.** Nothing in `clinicalContent.ts` or any component flags, labels, or acknowledges a safeguarding concern back to the patient (rule 5, `held-build-brief.md`) — the free text and any voice note simply travel to the clinic like everything else. The backend is where this actually gets acted on: the free-text/voice content needs a path to a human reviewer who can flag it, entirely outside the patient's view, with human review before any routing takes effect. This is not implemented anywhere in the frontend by design — it is purely a backend/clinical-ops responsibility.

**Interface contract.** The report-submission endpoint receives the full `ReportData`:

```ts
interface ReportData {
  patientName: string; gestationWeeks: number;
  entryPath: 'alert' | 'adhoc' | null; submittedAt: Date;
  categoryAnswers: CategoryAnswer[];       // gate + follow-ups + detail + voice note, per category
  hardStopEndedEarly: boolean;             // see above — must be honoured downstream
  freeTextDescription: string; freeTextVoiceNote: VoiceNote | null;
  onboardingHistory: OnboardingAnswers;
  recentActivity: ActivitySample[]; activityBaseline: number;
  disclaimer: string;
}
```

`submitReport()` is the natural place to fire the real network call — it already knows the moment of submission and the `endedEarly` flag; it just needs `assembleReportData()`'s output attached and POSTed.

**Delivery/infra.** In order of preference: direct write into the clinic's practice-management system (Semble, Cliniko, Pabau, Meddbase, or a larger group's Salesforce Health Cloup/bespoke system — confirm with the actual design-partner clinic rather than assuming), falling back to transactional email with the PDF attached (Resend, Postmark, SES). Delivery must be acknowledged and retried with dead-letter handling — a report that silently fails to arrive is the single worst failure mode in this system, worse than a false alert, because the patient-facing screen already tells her it was sent.

**Priority.** Pilot-blocking, the single highest-priority item in this document.

---

## 4. Voice notes: upload, storage, retention, clinician playback

**What the frontend does today.** `useVoiceRecorder` (`src/components/useVoiceRecorder.ts`) wraps `MediaRecorder`, producing a `VoiceNote` (`src/types.ts`) whose `url` is a browser object URL (`blob:...`) or, for the demo panel's synthetic note, a `data:` URL. Nothing is uploaded or persisted — the recording lives only in the tab, and `AppStateContext.tsx`'s `revokeVoiceNoteUrl()` explicitly frees it on reset. `VoiceNotePlayer.tsx` and `VoiceNoteBubble`/`VoiceNoteComposer` give play/pause and review-screen affordances entirely against that local blob. Today's PDF (`reportPdf.ts`) never embeds the audio — it appends one factual line, `REPORT_VOICE_NOTE_NOTE`, "A voice note was recorded and is available to the clinic," and nothing else. That line is currently a lie in production terms: there is no path by which the clinic actually becomes "available to" the audio.

**Interface contract.** The recorder needs to upload the blob (webm/opus in Chrome, whatever Safari's `MediaRecorder` produces elsewhere — `mimeType` is already captured and must be preserved) rather than keeping it local, and hand back a durable reference for `VoiceNote.url` to point at instead of an object URL:

```ts
interface VoiceNote {
  url: string;            // becomes a signed/authenticated fetch URL, not blob:
  durationSeconds: number;
  mimeType: string;
}
```

**Delivery/infra.** Direct-to-object-storage upload (S3/GCS presigned URL) keyed by patient + submission, referenced by ID in `ReportData` rather than embedding raw audio in the report payload. Needs: a retention policy (how long does a recording of a frightened patient's voice sit in storage, and does that match the clinical-record retention period the clinic already operates under — this is a legal question as much as an engineering one), access control so only the receiving clinician can play it back, and a decision on whether voice notes get transcribed server-side for the clinician's ten-second scan (would reuse whatever summarisation service is stood up for §8) or stay audio-only.

**Safety constraint.** The frontend already treats a voice note as content that must reach a human without being characterised or transcribed by the app itself (`REPORT_VOICE_NOTE_NOTE`'s own comment: "It never describes, transcribes, or characterises the recording"). Any server-side transcription step is additive for the clinician, not a replacement for the human listening — same safeguarding logic as the free text in §3.

**Priority.** Pilot-blocking — currently a recording genuinely never leaves the device, so the "available to the clinic" line the PDF prints is not yet true.

---

## 5. Patient identity, onboarding, and clinic association

**What the frontend does today.** `patientFixture` (`src/data/clinicalContent.ts`) hard-codes one patient — name, gestation, clinic, hours, booked unit — imported wherever `Patient` data is needed (`Outcome.tsx`, `TriageFlow.tsx`). Onboarding (`src/screens/Onboarding.tsx`, `src/screens/onboarding/*`) collects `OnboardingAnswers` (weeks pregnant, extra-monitoring flag, history flags/detail) into `AppStateContext`, which resets to blank on every `resetState()` — nothing persists across a real session boundary, let alone across devices.

**Interface contract.** `Patient` (`src/types.ts`) is already the right shape to authenticate against:

```ts
interface Patient {
  name: string; gestationWeeks: number;
  clinic: Clinic; bookedUnit: MaternityUnit;
}
```

Becomes real auth (Auth0/Clerk/Supabase Auth are all fine — this is not the interesting part) plus a patient record that carries her clinic association, so a report can only ever reach the clinic she's actually registered with. `OnboardingAnswers` needs a persistence endpoint — save on completion, load on login — replacing the in-memory-only version today. Gestation weeks in particular needs a real update path (weekly, presumably), since the fixture is static.

**Delivery/infra.** Standard auth provider + a patient-profile table (gestation, clinic FK, onboarding history, consent state). Nothing here is architecturally novel; it's the foundational piece everything else in this document assumes exists.

**Priority.** Pilot-blocking.

---

## 6. Clinic contact resolution and escalation-tier thresholds

**What the frontend does today.** Two pure, client-side functions, deliberately kept separate:

- `getTriageContact(now, patient)` (`src/logic/triageContact.ts`) resolves exactly one contact against the clock: the clinic's own triage line within `clinic.hours` (`[opens, closes)`, inclusive-open/exclusive-close, and handles overnight windows), else the 24/7 booked maternity unit, with a reason string ("Your clinic is closed until 08:00, call the maternity unit instead."). It never returns 999 — that's a separate, hand-built `TriageContact` in `Outcome.tsx` (`EMERGENCY_TIER_CONTACT`), by design.
- `getEscalationTier(answers)` (`src/logic/escalationTier.ts`) decides emergency-tier (999 primary) vs. triage-tier (maternity-line primary) *after* `disposition()` has already decided to escalate. Emergency fires on the Collapse/seizure/trauma hard-stop gate, or on Bleeding gated yes *and* ("how much" is heavy — `HEAVY_BLEEDING_VALUES` — or "pain or dizziness" is yes). Everything else defaults to triage tier. The function's own header comment is explicit that Pain, Vomiting, and Fluid thresholds are not yet defined precisely enough and this function does not invent any — it stays conservative until a medic sets them.

**What the backend must supply, not replace.** `getEscalationTier` stays client-side and pure — it is not a candidate for a server round-trip, because a frightened patient must never wait on a network call to see which number to dial. What the backend owns instead is the *data* these functions consume:

```json
{
  "clinic": { "name": "...", "triagePhoneNumber": "...", "hours": { "opens": "08:00", "closes": "18:00", "daysDescription": "every day" } },
  "bookedUnit": { "name": "...", "triagePhoneNumber": "..." }
}
```

This needs a clinic-config admin surface (even a spreadsheet-backed one to start), a named owner, and a review cadence — a wrong or dead number here is a direct patient-safety failure at 3am, not a bug ticket. Store per-patient at onboarding, re-verify if she changes booking.

**Safety constraint, carried forward from the old doc's tier-6 item and now sharper.** The escalation-tier thresholds (`HEAVY_BLEEDING_VALUES`, the Collapse hard-stop, and — explicitly — the *absence* of a Pain/Vomiting/Fluid threshold) are provisional pending medic sign-off, same as the questionnaire content in §7. Backend-side, this means: don't build anything that assumes these thresholds are frozen, and plan for a versioned config path (not necessarily a server call per-check-in, but a build-time or config-refresh path) so a medic-confirmed threshold change doesn't require re-auditing the whole client bundle from scratch.

**Priority.** Pilot-blocking (clinic directory) / pilot-blocking (medic sign-off on thresholds, which is a clinical-content workstream more than an engineering one, but blocks the same launch).

---

## 7. Clinical content versioning

**What the frontend does today.** Every question, threshold, and patient-facing string lives in one file, `src/data/clinicalContent.ts`, and its own header says so in capitals: "PLACEHOLDER CONTENT — WRITTEN BY AN ENGINEER, NOT A CLINICIAN." Two gaps are flagged in-file and deliberately not filled in by engineering judgment:

- **No source citation or version.** The six-category set (Bleeding, Fluid, Pain, Collapse/seizure/trauma, Vomiting, Movement) has no named guideline or protocol it's drawn from, so it cannot yet satisfy "sourced, version-pinned" as a real clinical artefact.
- **The pre-eclampsia gap.** The set has no headache/visual-disturbance/swelling category — the standard pre-eclampsia screen present in most comparable red-flag sets. The file explicitly refuses to silently add one back; that decision is the medic's, not engineering's.

**Interface contract the backend must serve.** A version-pinned question set, fetched (or bundled per-release) rather than hand-edited in a TS file:

```json
{
  "version": "2026-08-01-v1",
  "source": "<named guideline/protocol — currently absent>",
  "categories": [
    { "id": "bleeding", "gateQuestion": "Are you bleeding?", "hardStop": false, "followUps": [ /* ... */ ] }
  ]
}
```

The shape already matches `RedFlagCategory`/`RedFlagFollowUp` in `clinicalContent.ts`, so this is largely a matter of moving the same schema behind a versioned, medic-approved feed rather than redesigning it. Whatever serves this needs an approval workflow (a medic signs off a version, it gets pinned, the app records which version produced which report — this is the same audit-trail requirement as §11) rather than a direct-edit path.

**Priority.** Pilot-blocking — the content cannot go in front of a real patient in its current state, by the file's own explicit admission.

---

## 8. Optional live-model chat for the detail step

**What the frontend does today.** Nothing — this is the one item in this document with zero code behind it yet, only a brief-level allowance. `held-build-brief.md`'s tech notes: "The detail-step chat runs from a scripted, deterministic sequence by default. Optionally support a live model call behind an environment variable, but the app must fall back to the scripted path silently and instantly when the variable is absent... Do not make the stage depend on a network round trip." No `VITE_*`/`import.meta.env` reference, no model call, exists anywhere in `src/` today — the entire conversational surface (`CheckInConversation.tsx`, `Beat.tsx`, `DetailBeat.tsx`, `FollowUpInput.tsx`) is scripted and deterministic, and the six-category schema (§7) already captures far more structured detail per category than the original flat "one free-text step" the brief was written against, which narrows what a live model would actually need to do.

**What this service would need, if built.** A model call scoped to exactly two jobs, matching the old doc's own hard constraints, which still hold:

- Turn her free-text/voice detail (per-category or closing) into something a clinician can scan in ten seconds — summarisation, not judgment.
- Classify content that isn't pregnancy-related, including safeguarding disclosures, so it routes correctly (§3) — again, classification, not disposition.

The model must never decide escalate-vs-routine or emergency-vs-triage tier — that stays `disposition()`/`getEscalationTier()`, deterministic and client-side, full stop. Safeguarding classification output must be as invisible to the patient as the flag itself (§3): no UI acknowledgement, ever. And critically, the frontend's own env-var-gated, silent-fallback contract must be preserved by whatever server sits behind it — a slow or down model endpoint must never block or visibly degrade the check-in; the scripted path is not a degraded fallback, it's the frontend's actual load-bearing default.

**Priority.** Production (explicitly optional even in the original brief; the scripted path is a complete, safe experience without it).

---

## 9. PDF / report rendering

**What the frontend does today.** `src/logic/reportPdf.ts` builds the clinical PDF entirely client-side with `jsPDF`, direct text/table layout (no `html2canvas`, no DOM screenshot) — three testable layers: `buildReportSections` (plain-text content, no jsPDF), `buildReportPdf` (page layout), `downloadReportPdf` (build + `save()`). Two words are asserted-against in tests never to appear: "A&E" and "detected." The hard-stop honesty rule from §3 is implemented here today (`buildRedFlagParagraphs` renders an unasked category as "not asked" normally, or "not asked — check-in ended early to show emergency contact" when `hardStopEndedEarly` is true) — whatever renders the clinic-side copy of this report must preserve that same distinction, not just the patient's downloadable copy.

**Whether server-side rendering is needed.** Client-side jsPDF is genuinely fine for a pilot — it's deterministic, offline-capable, and small. Move it server-side once there's a real delivery pipeline (§3), for three reasons: one canonical rendering rather than two independent implementations drifting apart, a stored copy attached to the patient record for audit (§11), and guaranteed consistency between what she downloaded and what the clinic received — currently there is no guarantee those are byte-identical if the render logic ever forks. Puppeteer (reusing the same `buildReportSections` content layer) or a hosted service (DocRaptor) are both reasonable; the content-generation layer already being framework-agnostic text/paragraphs makes this a lower-risk migration than it sounds.

**Priority.** Production (client-side is acceptable through pilot; the risk is drift between the two renderings once a real delivery pipeline exists, not the PDF quality itself).

---

## 10. Everything else

**Activity data retention.** `recentActivity`/baseline currently exist only as live-generated seed data with no retention policy at all. Once §1 is real, decide how long raw 5-minute samples are kept post-pregnancy, whether they're anonymised/aggregated after the clinical episode closes, and whether that retention period is driven by the same clinical-record rules as the report itself (§4's voice-note retention question applies here too). Production.

**Clinician-facing queue — explicitly out of scope in this build.** `README.md` and the brief are both clear the clinician view isn't built. Email/PMS delivery (§3) is the pilot answer; a prioritised inbox — entry path, red-flag answers, activity trace, response SLA — is where the actual recurring commercial value sits, and it's also where "how does the clinic actually triage across patients" gets answered properly rather than assumed. Production, but worth resourcing early since it's likely the actual product a clinic pays for, not the patient app.

**Telephony.** No integration needed, unchanged from the old doc. Every escalation number renders as a `tel:` link (`Outcome.tsx`'s `telHref`, `EmergencyCall.tsx`) — building a dialer or routing calls through a provider (e.g. Twilio) adds risk with no benefit here.

**Audit logging.** Not present in the frontend today (nor should it be — it's inherently a backend/data-store concern). Needs to be append-only and cover: every alert fired (§2, with model version + threshold), every questionnaire completed and its content-set version (§7), every disposition/tier computed and by which rule version, every report sent and its delivery acknowledgement (§3). This is the artefact produced when something goes wrong in a clinical product — treat it as required infrastructure, not an afterthought bolted on before an audit. Pilot-blocking.

**Rule 11 / medical-device classification — the app's core design answer, unchanged by everything added since the old doc.** Under Rule 11 (UK MHRA), software providing information used for clinical decisions starts at Class IIa, rising where a wrong output could cause serious or irreversible harm. This frontend's answer — still true after the escalation-tier split and hard stop were added — is that the app decides the *urgency of contact* (which number, how prominently) and a human clinician decides *attendance*, on the phone. `disposition()` and `getEscalationTier()` are deterministic, pure, and testable, not model-driven judgment calls; that's a design property worth preserving precisely because it's the thing that keeps disposition with a person rather than the software. A disclaimer doesn't change intended purpose — the architecture has to do the work. Verify current MHRA position with a regulatory consultant before this becomes a claim made in writing. Data-protection stack (UK GDPR/DPA 2018, DPIA, Article 9 condition, ROPA, UK/EEA residency) and clinical-safety stack (DCB0129/DCB0160 — Clinical Safety Officer, Hazard Log, Clinical Safety Case Report, both under NHS England consultation through 11 September 2026) are unchanged from the old doc and still apply in full. Pilot-blocking before any real patient data flows.

---

## What changed from the old doc

- **Escalation tier (emergency vs. triage) is entirely new** and reshapes §6 — the old doc's "clinic directory" item now has a second, higher-stakes dependency: medic-confirmed thresholds for which categories/values trigger 999-primary framing, not just which clinic number to show.
- **The hard-stop interrupt is entirely new** and reshapes §3 — the old doc's "report on every outcome" point still holds, but it didn't anticipate a report needing to honestly represent categories that were *never reached* (`hardStopEndedEarly`), only ones answered no.
- **Voice notes are entirely new** (§4) — not in the old doc at all, and currently the least backend-ready feature in the app: recordings never leave the browser tab.
- **The flat six-question set is gone**, replaced by six categories with conditional follow-ups (§7) — the schema is richer, which narrows (but doesn't eliminate) the case for the LLM summarisation job in §8, since more structure is already captured deterministically.
- **The old doc's combined "LLM for free-text + safeguarding" item is split here** into safeguarding routing as a §3/delivery concern (needs a human reviewer path, not necessarily a model) and the optional live-model chat as its own, still-unbuilt, still-optional item (§8).
- Wearable ingest shape, clinic-PMS ambiguity, telephony (none needed), and the compliance stack are unchanged from the old doc and are repeated here rather than re-derived.
