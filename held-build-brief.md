# Held: Claude Code build brief

Paste this whole file as the opening message of a fresh Claude Code session, or drop it in the repo root and open with "Read held-build-brief.md and build it."

---

<role>
You are the design lead and senior frontend engineer on a two-person hackathon team. You have shipped consumer health products before and you have been burned by pretty prototypes that fell apart on stage. You have a strong, defensible point of view on visual direction and you argue for it. You treat clinical safety copy as a design problem, not a legal afterthought.
</role>

<task>
Build a working, demo-ready frontend prototype for Held, a pregnancy monitoring and triage app for private maternity clinics. It is a React single-page app with mocked data and no backend. It must run with `npm install && npm run dev` and nothing else: no API keys, no environment variables, no network calls required for the demo to work. Deliver six screens plus a hidden demo control panel, all reachable and all polished.
</task>

<context>
The team is building for a healthcare hackathon judged on four criteria out of ten each: idea, design, code quality, and a one-minute demo. There are bonus marks for evidence of real users and for using sponsor tools where they genuinely help. The judging rubric explicitly calls out that AI-generated design is recognisable now and that standing out requires UX that actually makes sense for the user.

The product. An expectant mother wears a passive abdominal wearable through the third trimester. The wearable streams a binary time series: movement detected or not detected, sampled continuously. Held sits on top of that stream. It does two things: it lets her raise a concern and get it in front of her clinic quickly with structured evidence attached, and it flags possible reductions in movement so the clinic can reach out. Reports are delivered to the private maternity clinic by email or CRM. That backend is out of scope. You are building the patient-facing app only.

Two entry paths, one shared workflow.
Path A, patient-initiated. She is worried at 2am. She opens the app herself and starts a check-in.
Path B, system-initiated. The wearable's anomaly detector fires and sends a push notification. She taps it.
Both paths land in the same triage flow: a structured red flag questionnaire, then a free-text detail step, then submission to her clinic, then a confirmation and status screen. The only difference is the entry point and how the report is prioritised in the clinic queue.

The users. Primary user is a pregnant woman in her third trimester, typically 28 to 40 weeks, using the app while frightened, often at night, often in bed, often alone. Secondary reader is a midwife or obstetrician at a private clinic who receives the report. You are not building the clinician view in this pass.

Why the safety rules below are not negotiable. The dominant harm in consumer fetal monitoring is false reassurance: a woman reads a green state, decides she does not need to call anyone, and does not present when she should have. A large UK trial called AFFIRM tested a reduced fetal movement awareness care package across more than 400,000 pregnancies and found no significant reduction in stillbirth, alongside higher caesarean and induction rates. Separately, the anomaly detector in this product will produce alerts that are frequently false, because the underlying event is rare. Every design decision below follows from those two facts.
</context>

<clinical_safety_rules>
These override any other instruction in this brief, including the design direction. If a design choice conflicts with one of these, the safety rule wins and you say so in your plan.

1. No verdict, ever. No patient-facing screen renders a judgement about the baby's wellbeing. There is no green state, no "normal", no "all good", no reassuring tick, no smiley, no "everything looks fine". The app shows data and offers actions. It never concludes.

2. Her perception always wins. A persistent, always-reachable control to raise a concern is present on every screen, in the same place, regardless of what the sensor says. If the sensor shows activity and she says movement has reduced, the app takes her at her word and escalates without friction or challenge. It never asks her to reconsider, never shows the sensor data as a counterargument.

3. Alerts are written to survive being wrong. The push notification and the alert screen lead with the action and with her own perception, never with a diagnostic assertion. Write "Worth checking on your baby's movements" rather than "Reduced movement detected". The word "detected" does not appear on any patient-facing surface.

4. One emergency route, always visible in the triage flow. A single high-contrast control that dials the maternity triage line, with a secondary route to emergency services. It is never buried behind a confirmation dialog.

4b. The escalation destination is maternity triage, not A&E, and it is time-aware. In the UK a woman past roughly 16 to 20 weeks with reduced fetal movement is told by every NHS trust to call her maternity assessment unit, day assessment unit, or maternity triage line directly, day or night, not to attend A&E. A&E redirects her and the delay is the harm. The word A&E never appears as an escalation instruction.

The private clinic is not staffed 24/7, so the number shown must resolve against the clock:
  - Within clinic hours: the private clinic's own triage line.
  - Outside clinic hours: the maternity unit where she is booked to deliver, which is 24/7.
  - Heavy bleeding, collapse, or fitting: 999, offered as a distinct secondary route, never as the default.
Build this as one function, `getTriageContact(now, patient)`, returning a label, a number, and a one-line reason. It shares the same clock as the theme switch. Never show two numbers of equal weight; resolve to one primary and put the rest below the fold.

4c. Escalation is triggered by the alert path, or by any positive red flag on the ad hoc path. The entry path can escalate but never de-escalate: an alert-path check-in with no positive red flags still escalates. The red flag answers still do real work in both paths, because they decide whether the primary route is the triage call or 999, and they populate what the clinician sees. Only one combination reaches the routine outcome: ad hoc entry with no positive red flags.

4d. The escalation screen says call, not attend. The app decides the urgency of contact. The clinician on the phone decides attendance. This keeps the disposition with a human, which is the product's answer to Rule 11 software classification, and it stops false-positive alerts filling maternity units.

4e. A report goes to the private clinic on every outcome, including escalations, because they hold the continuity-of-care relationship even when they are closed. On an escalation this is background behaviour and the screen does not ask her to wait for it.

5. Safeguarding stays invisible to the patient. The questionnaire and chat may surface concerns that are not pregnancy-related, including safeguarding. The interface never labels, flags, or acknowledges this back to her. Responses stay neutral and supportive. Routing happens silently in the report. Build the free-text capture so this is possible; do not build any UI that announces a flag.

6. The activity visualisation does not imitate hospital equipment. No CTG-style scrolling trace, no waveform, no beeping, no pulsing red line, no numeric "score". Clinical monitor aesthetics are a fear cue for this user. Represent activity ambiently.
</clinical_safety_rules>

<design_direction>
Do not open a design tool or a template. Start from this organising metaphor and derive everything from it.

The metaphor: lamplight. A warm bedside lamp switched on in a dark room at 3am. Not clinical, not cold, not a screen glaring in the dark. That single image resolves the two things this product has to be at once, calming and usable at night, and it is where every colour, type and motion decision comes from.

What that means concretely:
- Warm throughout, in both themes. Warmth is the point. Nothing in this product is neutral grey or clinical blue.
- Two themes, one warm family. Night is the default and the one you demo. Day exists and switches automatically on local time, roughly 07:00 to 20:00. This is cheap to build, one set of CSS custom properties, and it is a five-second demo beat: show the app at 2pm, change the clock, show it at 2am.
- Low stimulation. Desaturated, generous negative space, large type, touch targets at 56px minimum, because she may be shaking or crying.
- Red is reserved. Red appears exactly once in the entire product, on the emergency call control. Not on alerts, not on the questionnaire, not on badges. An alert that looks like an emergency, when most alerts are false, is the design failure this product exists to avoid.
- Motion is slow and ambient. Nothing ticks, pulses, counts, or races. If something moves, it breathes. Respect prefers-reduced-motion.
- Copy is plain, active, and short. Sentence case. No exclamation marks. No brand voice cuteness. No apologising. An action keeps the same name through the whole flow.

Starting tokens. These are contrast-verified against WCAG AA. Use them as the baseline. You may refine hues, but re-verify any value you change and keep every text pairing at 4.5:1 or better.

Night theme, default:
  bg          #1C1619   deep warm plum-black, a lamplit room rather than a black screen
  surface     #292125
  surface-hi  #352B30
  text        #F4EDE8   warm ivory, 15.4:1 on bg
  text-muted  #B3A3A8   7.4:1 on bg
  accent      #E8B478   lamplight amber, 9.5:1 on bg, used sparingly
  emergency   #E5544B   4.8:1 on bg, appears once

Day theme:
  bg          #F3EDEA   warm rose-grey, deliberately not a yellow cream
  surface     #FAF6F4
  text        #2A2226   13.4:1 on bg
  text-muted  #665A60   5.7:1 on bg
  accent      #96601F   4.5:1 on bg
  emergency   #B3302A   5.4:1 on bg

Deliberately avoid these, they are the current AI-design defaults and a judge will recognise them instantly: warm cream backgrounds near #F4F1EA paired with a terracotta or clay accent near #D97757, which is the single most recognisable AI design signature in circulation and the exact trap a warm brief falls into; a high-contrast serif display paired with a generic sans; near-black with an acid-green accent; broadsheet layouts with hairline rules and zero border radius; soft-pink maternity styling; anything resembling a hospital dashboard.

Typography. Avoid the display-serif-plus-neutral-sans pairing. Two workable routes, pick one and justify it in a sentence: a single humanist family carried across both roles with strong weight and size contrast, which is the more disciplined answer; or a genuinely soft, low-contrast display face such as Fraunces with its soft and wonk axes turned up, used only at hero sizes, over a warm humanist sans for body. Set a real type scale with intentional weights and spacing.

Icons. Do not use Lucide. It ships as the shadcn default and its uniform 2px stroke is now an instant tell, and its optical weight fights a calm interface. Use Phosphor Icons at Thin or Light weight, which reads materially quieter, and hand-draw inline SVG for the three or four signature moments, which is a small amount of work at this icon count and removes the tell entirely. Keep one stroke weight across the whole set.

Before writing code, produce a compact token plan: the colour set above with any refinements, two type roles, a layout concept, and one signature element. The signature element is the live activity view. It is the thing the judges remember. Build it from the lamplight metaphor, ambient and physical rather than clinical, and justify your choice in one sentence.

Build to a quality floor without announcing it: responsive to a 390px viewport, visible keyboard focus, prefers-reduced-motion respected, real semantic HTML.
</design_direction>

<screens>
Build all six. Each is reachable from the demo panel so nothing has to be discovered live on stage.

1. Onboarding
Three steps, one question per screen, with progress. Purpose is capturing history that flags risk factors the clinic needs to know early. Use the placeholder questions below and keep them in the data module so they can be swapped without touching components. Ends with a wearable pairing confirmation and lands on home.

2. Home, default state
The resting state, and the entry point for the patient-initiated path. Shows: last 24 hours of activity as the ambient visualisation, and time since the wearable last synced. It does not summarise, score, or interpret those 24 hours in words. It shows the shape of the data and stops.

Actions, in a clear hierarchy:
- Primary CTA, "Check in", full width, high contrast, the most prominent element on the screen after the visualisation. This starts the triage flow and is the ad hoc path. Give it real visual weight; a worried person at 2am should not have to look for it.
- Secondary, "See live view", quieter, text or outline treatment.

Reconcile this with safety rule 2 as follows. The primary CTA and the persistent raise-a-concern control are the same action, so build one component, anchored in the same screen position everywhere. On home it renders at full prominence. On other screens it renders as a quieter persistent bar in that same position. Same label, same destination, same place, different weight. Do not ship two different controls that do the same thing.

3. Home, alert state
Entered from a push notification. Same layout, different framing block at the top. Copy leads with the suggested action, not with a finding. Two actions: start a check-in, or dismiss. Dismissing is one tap and is not punished with a warning dialog. The raise-a-concern control remains in its usual place.

4. Live view
On-demand real-time view of the stream, openable at any time from home. The wearable is always on, so this is a window onto a live feed, not a scan that starts and stops. She opens it, watches, closes it when she wants. No countdown, no session length, no completion state, no result. This is the signature element: make it calm, ambient, and beautiful enough to sit with for ten minutes at 3am.

5. Triage flow
Shared by both entry paths.
   a. Red flag questionnaire. One question per screen, yes or no, with an optional "add detail" free-text field that expands inline. Progress indicator. Back navigation preserved.
   b. Detail step. A conversational free-text capture where she can describe anything else in her own words. Present it as a chat, but drive it from a scripted, deterministic sequence so it cannot fail on stage. See the tech notes on the optional live model.
   c. Review. Shows what will be sent to her clinic, in plain language, before she sends it. She can edit any answer.
   The emergency control is present on every screen of this flow.

6. Outcome
One screen, two states. The routing is fixed:
  - Alert path, any answers, always escalate.
  - Ad hoc path with any positive red flag, escalate.
  - Ad hoc path with no positive red flags, routine.
A report is sent to the private clinic in every case.

State A, escalate. Leads with a single instruction: call, phrased as an action she can take right now. The number is the largest interactive element on the screen and is one tap to dial. It is resolved by `getTriageContact`, so at 3am it shows the 24/7 maternity unit rather than a closed clinic line, with a short plain reason such as "Your clinic is closed until 08:00, call the maternity unit". Beneath it, the report download, labelled as something to bring with her. Below that, quieter, the 999 route for heavy bleeding, collapse, or fitting. A single line confirms the report has also gone to her clinic. The screen does not tell her to attend anywhere and does not use the word A&E.

State B, routine. States what was sent, to which clinic, and when. Sets an expectation for response, honestly: if the clinic is closed, say when they open rather than implying someone is reading it now. Offers the same report download. Carries the triage number, resolved by the same function, so she never has to hunt for it. Includes a plain statement of what to do if anything changes while she waits, and a simple status timeline: sent, received, clinician reviewing.

The report download is available on both states and from both entry paths. It is one of the few things this product does that nothing else does: it hands whoever assesses her a structured summary instead of making her recount everything from memory at 3am.

Report contents: her name and gestation, the entry path and timestamp, every red flag question with her answer and any detail she added, her free-text description, the history captured at onboarding, and the activity trace for the preceding 24 hours with her personal baseline for comparison. Include a line stating the movement data comes from a consumer wearable and is supporting context, not a clinical measurement.

Report contents: her name and gestation, the entry path and timestamp, every red flag question with her answer and any detail she added, her free-text description, the history captured at onboarding, and the activity trace for the preceding 24 hours with her personal baseline for comparison. Include a line stating the movement data comes from a consumer wearable and is supporting context, not a clinical measurement.

Plus: hidden demo control panel.
Toggled by a keyboard shortcut and a small unobtrusive affordance. Lets the operator jump to any screen, fire the simulated push notification, reset state, switch the seeded activity data between a quiet pattern and an active pattern, and override the clock. The clock override drives both the day and night theme and the open or closed state of the clinic, so a single control demonstrates the warm night theme and the out-of-hours fallback number at the same time. This exists so the one-minute demo cannot fail. Build it first.
</screens>

<placeholder_content>
All of this is placeholder written by an engineer, not a clinician. Keep it isolated in a single data module with a comment at the top saying it must be replaced with the team medic's sourced, version-pinned question set before any real use. Do not scatter it through components.

Onboarding history questions, three for now, structure should accept more:
1. How many weeks pregnant are you? (numeric)
2. Has anyone told you this pregnancy needs extra monitoring, or are you under consultant-led care? (yes / no / not sure, with optional detail)
3. Has anything happened in this or a previous pregnancy that your clinic should know about? (multi-select: bleeding, reduced movement before, previous loss, high blood pressure, diabetes, none of these, plus optional detail)

Red flag questions, five for now, structure should accept more:
1. Have you felt your baby move in the last two hours?
2. Have you had any bleeding or fluid loss?
3. Do you have tummy pain that stays rather than comes and goes?
4. Do you have a bad headache, changes in your vision, or sudden swelling in your face or hands?
5. Do you feel unwell in yourself, or have a temperature?

Seed data: fourteen days of binary time-series activity at five-minute resolution, generated with a plausible circadian pattern including a quiet overnight period. Provide two variants for the demo toggle.
</placeholder_content>

<tech_stack>
React with TypeScript, Vite, Tailwind. Client-side routing. State in React, no external state library unless you can justify it in one line.

No backend, no database, no auth. All data comes from the mock module. No network calls are required for any demo path.

The detail-step chat runs from a scripted, deterministic sequence by default. Optionally support a live model call behind an environment variable, but the app must fall back to the scripted path silently and instantly when the variable is absent. The demo runs on the scripted path. Do not make the stage depend on a network round trip.

Generate the downloadable report client-side with jsPDF, laying out text and tables directly rather than screenshotting the DOM with html2canvas. Direct layout is deterministic, works offline, produces a small file, and yields something that reads as a clinical document rather than a picture of an app, which matters because a midwife is the one opening it. Trigger a direct file download rather than a print dialog; a print dialog on stage is a bad demo moment.

Structure the code so the sensor is behind a single interface, something like a `MovementStream` module exposing subscribe, getWindow, and getBaseline. The mock implementation reads seed data. Real hardware would drop in behind the same interface. Say this out loud in the README, because it is a code quality point worth marks.

Keep the disposition logic in one pure, tested function taking the entry path and the red flag answers and returning escalate or routine. Cover these cases in tests: alert path with no red flags escalates; ad hoc with one red flag escalates; ad hoc with none is routine; the function never returns routine for an alert path entry. Keep `getTriageContact` separate and pure too, taking a clock and the patient's clinic hours and booked unit, so the out-of-hours behaviour is testable without waiting until 3am.

Keep components small and typed. No `any`. Write a short README covering how to run it, the architecture, the sensor interface boundary, and a clearly headed section on the clinical safety rules and why the copy is written the way it is.
</tech_stack>

<process>
Work in this order and do not skip the first two steps.

1. Build the demo control panel and the routing shell first, so every subsequent screen is immediately reachable and demoable.
2. Produce the design token system and a one-paragraph plan for the signature live view before writing any screen code. Check it against the list of AI-design defaults above. If any part of it is one of those defaults, revise it and state what you changed and why.
3. Build screens in this order: live view, home default, home alert, triage flow, report sent, onboarding. The live view first, because it is the signature and it will set the visual language for everything else.
4. After each screen, re-read the clinical safety rules and check the screen against them. Report any conflict rather than silently resolving it.
5. Take screenshots as you go if the environment supports it, and critique your own work against the design direction.

Ask before building only if something in this brief is genuinely contradictory. Otherwise make the call, build it, and state the assumption in the README.
</process>

<success_criteria>
The build is done when all of the following hold.

- `npm install && npm run dev` produces a running app with no further setup.
- All six screens plus the demo panel are reachable, and the full path from push notification to outcome can be walked in under sixty seconds without touching the URL bar.
- The disposition function passes its four routing cases, and an alert-path entry never reaches the routine outcome.
- The escalation screen resolves to one primary number against the clock, showing the 24/7 maternity unit when the clinic is closed, with a plain reason.
- The word A&E does not appear as an escalation instruction anywhere, and the escalation screen says call rather than attend.
- A report reaches the private clinic on every outcome, including escalations.
- The report downloads as a PDF from both outcome states and from both entry paths, and it opens as a readable clinical summary rather than a screenshot.
- No patient-facing screen renders a wellbeing verdict, a green state, or the word "detected".
- "Check in" is the single most prominent action on home, and it is the same component, in the same screen position, as the persistent raise-a-concern control everywhere else.
- Red appears exactly once in the product.
- Both themes are warm, night is the default, and the day and night switch can be demonstrated in five seconds from the demo panel.
- Every text and background pairing in both themes meets WCAG AA, and any token you changed from the baseline has been re-verified.
- No Lucide icons anywhere, one consistent stroke weight across the icon set.
- The live view is something a frightened person would willingly sit with, and it looks nothing like a hospital monitor.
- The design token system is documented and no part of it matches the AI-design defaults listed above.
- The placeholder clinical content sits in one module, clearly marked for clinician replacement.
- The README explains the sensor interface boundary and the safety copy rationale.
</success_criteria>
