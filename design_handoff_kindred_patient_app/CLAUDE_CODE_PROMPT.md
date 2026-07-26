# Claude Code prompt — Kindred patient app

Copy everything inside the block below into Claude Code, after unzipping the handoff folder into the repo.

---

<task>
Implement the eight Kindred patient-app screens documented in
`design_handoff_kindred_patient_app/README.md` in this codebase, then update the existing UI to match.
Read the README in full before writing code — it is the source of truth for colours, type, spacing,
motion and copy. `design_handoff_kindred_patient_app/Kindred UI.dc.html` is a visual reference only:
open it to see the intended result, do not port its markup.
</task>

<context>
Kindred is a maternity remote-monitoring app. A pregnant patient wears a band; the app shows her
movement/heart-rate data, runs a short triage check-in conversation when something needs checking, and
keeps a clinic call and an operator call always one tap away. The audience is a worried person, often at
night, often one-handed. Calm and legibility beat density and delight.
</context>

<what_to_build>
1. All eight screens: Home (steady), Home entered from the push notification, the three check-in
   conversation steps, the review screen, the emergency outcome, and the live view.
2. Replace/refresh the existing screens so the whole app follows this system — do not leave old styling
   in place beside the new screens.
3. Wire the live-data trace to the real band stream. Sample geometry in the reference is placeholder.
</what_to_build>

<requirements>
<dynamic_background>
- Implement the five-layer aura exactly as tabulated in the README (sizes, positions, fills, blurs,
  keyframes, 46–74s durations, `cubic-bezier(.37,0,.63,1)`).
- Mount it ONCE above the navigator/router as a persistent layer, not per screen, so it keeps drifting
  continuously through navigation instead of restarting on every push.
- It must sit behind all content, ignore pointer events, and never clip or scroll with content.
- Keep the blooms low-alpha as specified: all body text must stay at or above 4.5:1 on top of it.
- Use GPU-friendly transforms only (translate/scale/opacity). No layout-affecting animation, no
  per-frame JS.
</dynamic_background>

<page_transitions>
- Gentle, one visual language for the whole app: 320ms, `cubic-bezier(.22,.61,.36,1)`, opacity plus a
  short 12–16px directional slide. Forward slides in from the trailing edge, back reverses it.
- The aura, the dock and the emergency control must not animate or reflow during a transition — they are
  fixed reference points. Ideally the dock is hoisted and shared across routes so it appears not to move at all.
- Conversation bubbles and answer chips enter at 420ms with the same easing, staggered ~60ms, once —
  never on re-render.
- No spring bounce, no scale-in, no fade-through-white, no cross-dissolve of whole screens.
</page_transitions>

<motion_and_accessibility>
- Press feedback everywhere: opacity to 0.82 over 120ms. No scale, no colour change.
- Under `prefers-reduced-motion`: hold the aura and breath glows static (do not remove them), drop screen
  transitions to a ≤120ms opacity fade, and disable the staggered bubble entrance.
- Every control is at least 56×56. Text must scale to 200% without clipping or overlap — no fixed-height
  text containers, no truncation of copy.
- Screen-reader labels: the trace exposes a plain-language summary, not a data dump; each call control
  states what it calls; the progress rail exposes progress; decorative marks and the aura are hidden.
- Visible focus ring: 2px accent, 3px offset.
- Light haptic tick on chip select and on send. No haptic on the emergency or operator controls.
</motion_and_accessibility>

<theming>
- Implement both the day and night palettes from the README as tokens, switching automatically at 07:00
  and 20:00, with a manual override if the codebase already has one. Never hard-code hex values in
  components.
</theming>

<invariants>
These are safety and trust properties, not preferences. Enforce them in code review terms:
- `emergency` red appears in the EmergencyCall component only — never on badges, borders, icons, alerts
  or validation.
- No tick/check glyph anywhere in the product. A chosen answer becomes her own message bubble instead.
- The Speak-to-Kindred control occupies the same rectangle in the same position on every screen, and the
  emergency control is never disabled, never animated, never shadowed.
- Content never enters the 112px dock clearance.
- Empty data renders nothing — no baseline row, no zero state dressed up as data. Handle stale sync and
  band-offline states as specified.
- Patient-facing copy never uses the word "detected", never uppercase warnings, never an exclamation mark.
</invariants>
</requirements>

<process>
1. Read the README, then inventory what already exists in this repo: theming/token setup, navigation,
   component library, animation primitives, and any current versions of these screens. Report what you
   plan to reuse versus add.
2. Land the foundations first — tokens, type roles, the persistent aura layer, the transition config,
   the shared dock — then the shared components (CheckInControl, EmergencyCall, operator route,
   AlertFramingBlock, PushBanner, marks, HeartRateTrace, composer), then the eight screens.
3. Use this codebase's existing patterns, state management and libraries. Do not add a new animation or
   styling dependency without telling me why first.
4. Keep the check-in conversation data-driven (categories, questions, follow-ups) rather than hard-coding
   screens 03–05.
</process>

<output>
Working code in the app, plus a short summary of: files added/changed, which existing components you
reused, where you deviated from the README and why, and anything in the design that the current
architecture can't support cleanly.
</output>

---

## Notes for you (not part of the prompt)

- If Claude Code asks which framework: it should follow whatever the repo already uses; the README says
  the same.
- If the repo has no design-token layer yet, expect the foundations step to take the longest — that is
  the right place for it to spend time.
