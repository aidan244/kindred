# Held: backend integration map

What the frontend is built to plug into. Nothing here is in the hackathon build. Every item below sits behind a mocked interface in the prototype, and this document exists so whoever builds the backend knows what the contract is, and so a judge can see the architecture was thought through rather than hand-waved.

Confidence note: the technology choices below are my recommendations, not verified vendor decisions. The two you should verify yourselves before quoting them to anyone are the clinic practice management system and the exact regulatory pathway.

---

## Tier 1: required for a real pilot

### 1. Wearable ingest
**What it does.** Receives the binary movement time series from the abdominal wearable and makes it queryable.

**Frontend contract.** `MovementStream` with `subscribe`, `getWindow(from, to)`, `getBaseline(days)`. The mock reads seed data. Real hardware drops in behind the same three methods and no component changes.

**Backend shape.** BLE on-device to the phone, phone to cloud over HTTPS in batches. Sampling at five-minute resolution over a ten-week third trimester is roughly 20,000 points per patient, which is small; do not over-engineer this. A time-series table in Postgres with TimescaleDB, or plain Postgres with a sensible index, is enough. Reach for InfluxDB or Timestream only if the sampling rate goes up by two orders of magnitude.

**Open question for the hardware team.** Does the wearable buffer locally when the phone is out of range, and for how long? That determines whether the app can honestly display "last synced" or has to display "last received".

### 2. Anomaly detection service
**What it does.** Watches the stream against the patient's own rolling baseline and decides when to fire an alert.

**Why it is backend, not on-device.** It needs the baseline history, it needs to be versioned and auditable, and you will want to change its thresholds without shipping an app update. Every alert it fires must be logged with the model version, the input window, and the threshold that triggered it. If this product is ever reviewed, that log is the evidence.

**The honest caveat to carry.** This detector will produce alerts that are frequently false, because the underlying event is rare. That is why the app escalates to a phone call rather than an attendance, and why no screen renders a green state.

### 3. Push notification delivery
**What it does.** Delivers the alert-path entry point.

**Options.** APNs and FCM directly, or a wrapper such as OneSignal or Expo Notifications if the app is React Native. Direct is cheaper at scale and one more thing to maintain; a wrapper is faster to ship.

**Constraint that matters.** The notification body follows the same copy rules as the app. No diagnostic assertion, no "detected", lead with the action. The notification is the single most-read piece of copy in the product and it appears on a lock screen next to whatever else woke her up.

### 4. Report delivery to the private clinic
**What it does.** Gets the structured report in front of a clinician. Fires on every outcome, escalation and routine alike, because the clinic holds the continuity relationship even when closed.

**Transport, in order of preference.** Direct write into the clinic's practice management system, which is the real product. Failing that, transactional email with the PDF attached, using Resend, Postmark, or AWS SES. Email is the pilot answer and the PMS integration is the thing that makes this defensible at scale.

**Requirement.** Delivery must be acknowledged and retried. A report that silently fails to arrive is the worst failure mode in the entire system, worse than a false alert. Build dead-letter handling before you build anything pretty.

### 5. Clinic practice management system
**What it does.** The system of record the private clinic already lives in.

**Candidates in the UK private maternity space.** Semble (formerly Heydoc), Cliniko, Pabau, Meddbase. Larger groups may run Salesforce Health Cloud or a bespoke system.

**Action, and this is a real one.** Ask your first design-partner clinic what they use before assuming any of these. This single answer determines whether your integration is a REST API, an HL7 or FHIR feed, or a human copying a PDF into a folder. A judge who works in private healthcare will ask you this, and "we would integrate with their CRM" is not an answer.

### 6. Clinic directory and contact resolution
**What it does.** Supplies `getTriageContact` with the clinic's opening hours, its in-hours triage number, and the 24/7 maternity unit where the patient is booked to deliver.

**Why it is separate.** It is small, it is boring, and it is the thing that decides which number a frightened person sees at 3am. It needs a named owner and a review cadence, because a wrong or dead number here is a direct patient-safety failure. Store per-patient, verified at onboarding, re-verified if she changes booking.

### 7. Identity, records, and audit
**Identity.** Patient auth, and a clinic association so a report can only reach the clinic she is registered with. Auth0, Clerk, or Supabase Auth are all fine; this is not the interesting part.

**Records.** Patient profile, gestation, onboarding history, every completed triage, every report, every disposition.

**Audit log, and this is the part that matters.** Append-only, immutable. Every alert fired, every questionnaire completed, every disposition returned, every report sent, every delivery acknowledged, with timestamps and the version of the rule set in force. In a clinical product the audit log is not a nice-to-have; it is the artefact you produce when something goes wrong.

---

## Tier 2: makes the product good rather than just functional

### 8. LLM for the free-text step and safeguarding triage
**What it does.** Two jobs. Turns her free-text description into something structured a clinician can scan in ten seconds. And classifies content that is not pregnancy-related, including safeguarding disclosures, so it can be routed appropriately.

**Vendor.** Anthropic API. This is also your sponsor-tools bonus, so use it where it genuinely helps and say so.

**Hard constraints.**
- The model never decides disposition. Escalate or routine comes from the deterministic rule function. The model summarises and classifies; it does not triage.
- Safeguarding classification is invisible to the patient. No flag, no label, no acknowledgement in the interface. Routing happens silently in the report.
- Human review before any safeguarding routing takes effect. A false positive here has serious consequences for a family.
- The prototype runs a scripted deterministic path with the live call behind an environment variable, so the stage demo never depends on a network round trip.

### 9. Server-side PDF generation
**What it does.** Produces the clinical summary.

**Why move it server-side eventually.** Client-side jsPDF is right for the prototype and fine for a pilot. Server-side gives you one canonical rendering, a stored copy attached to the record, and consistency between what she downloaded and what the clinic received. Puppeteer or a hosted service such as DocRaptor.

### 10. Clinician-facing queue
**What it does.** The ranked inbox. Not in this build, but it is where the actual commercial value sits, and worth saying out loud on stage.

**Why it matters.** Email delivery is the pilot. A prioritised queue with the entry path, the red flag answers, the activity trace, and a response SLA is the thing a clinic pays for. It is also where the "triage as less important" question from the original workflow sketch gets answered properly.

### 11. Telephony
**No integration needed.** The call is a `tel:` link. Do not build a dialer, do not route calls through a provider, do not add a vendor here. If someone proposes Twilio for this, the answer is no.

---

## Compliance stack, because it will be asked

**Data protection.** UK GDPR and the Data Protection Act 2018. Health data is special category, so processing needs an Article 9 condition, a DPIA is effectively mandatory for this product, and a Record of Processing Activities is required. Data residency in the UK or EEA.

**Clinical safety.** <cite index="86-1">DCB0129 is the NHS England standard for clinical risk management in the manufacture of health IT systems, supported by DCB0160 for the organisations that deploy and use them.</cite> <cite index="93-1">DCB0129 applies to the manufacturer or supplier and DCB0160 to the deploying organisation, and DCB0129 is a core requirement of the wider NHS Digital Technology Assessment Criteria framework.</cite> Both are under NHS England review, with a public consultation open to 11 September 2026. Compliance means a Clinical Safety Officer, a Hazard Log, and a Clinical Safety Case Report. None of that is hackathon work, but knowing the three deliverables by name is a strong answer if a judge probes.

**Medical device classification.** Under Rule 11, software providing information used for clinical decisions starts at Class IIa, and rises where a wrong output could cause serious or irreversible harm. Held's design answer is that the app decides the urgency of contact and a human clinician decides attendance, which keeps the disposition with a person. A disclaimer does not change intended purpose, so the architecture has to do the work, not the small print. Verify the current MHRA position with a regulatory consultant before making any claim in writing.

**Procurement.** ISO 27001 and the NHS Data Security and Protection Toolkit will be asked for by any clinic group of size. Cyber Essentials Plus is the cheap early signal.

---

## What to say on stage

Three sentences, no more. The sensor sits behind one interface so real hardware drops in without touching the app. Disposition is a deterministic rule function, not a model, so it is auditable and a human still makes the attendance call. Reports reach the clinic on every outcome because they hold the relationship, and the patient always leaves with a copy in her hand.
