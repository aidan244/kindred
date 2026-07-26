# Handoff: Kindred patient app — 8 core screens

## Overview
Kindred is a maternity remote-monitoring app for a pregnant patient wearing a movement/heart-rate band.
This package covers the eight core patient-facing screens: Home (steady), Home entered from a push
notification, the three-step triage check-in conversation, the pre-send review, the emergency outcome,
and the live view. Every screen sits on an animated "aura" backdrop and carries two always-reachable
call controls.

## About the Design Files
The file in this bundle (`Kindred UI.dc.html`) is a **design reference created in HTML** — a prototype
showing intended look and behaviour, not production code to copy directly. All eight screens live in one
file as 390×844 phone frames on a single board.

The task is to **recreate these designs in the target codebase's existing environment** (React Native,
React + Tailwind, SwiftUI, etc.) using its established patterns, component library and tokens. If no
environment exists yet, choose the most appropriate framework and implement the designs there. Do not ship
the HTML.

Component names referenced below (CheckInControl, EmergencyCall, AlertFramingBlock, PushBanner,
KindredMark / BandMark / KindredAvatar, EmberBand → now HeartRateTrace, CheckInConversation, FollowUpInput)
come from the Kindred design system and should map onto real components in the codebase.

## Fidelity
**High-fidelity.** Final colours, type, spacing, radii and interaction states. Recreate pixel-perfectly
using the codebase's existing libraries. The one exception: the heart-rate trace geometry is sample data —
wire it to the real movement/heart-rate stream.

## Design Tokens

### Colour — Day theme (07:00–20:00)
| Token | Hex | Use |
| --- | --- | --- |
| bg | #efe6e1 | the room / screen background |
| surface | #f6efe9 | cards, bot bubbles, bar-variant control |
| surface-hi | #fbf6f1 | inset / selected / her bubbles / chips |
| line | #e1d4cb | seams only, 1px, never a minimum |
| text | #2a2226 | body text (12.6:1 on bg) |
| text-muted | #665a60 | timestamps, metadata, device state (5.34:1) |
| accent | #8a5717 | the lamp — primary fills, links, marks (4.94:1) |
| emergency | #b3302a | fill-only, EmergencyCall **only** |
| on-accent / on-emergency | #efe6e1 | labels on those fills |

Night theme (for later): bg #1c1619, surface #292125, surface-hi #352b30, text #f4ede8,
text-muted #bbaa9c, accent #e8b478, emergency #e85b50, line #3b3035, on-accent/on-emergency #1c1619.

Lamp ramp (accent 138 87 23 at alpha): lamp-1 .05, lamp-2 .11, lamp-3 .2, lamp-4 .36, lamp-5 .62.

**Red is used in exactly one component** (EmergencyCall) and nowhere else — no red badges, borders,
icons or validation states.

### Typography
One family: **Alegreya Sans** (300, 400, 500 loaded; 700 loaded only so an accidental bold renders a real
cut). Each role carries its own size + line-height + letter-spacing + weight; never compose on top.

| Role | Size / line-height / tracking / weight | Use |
| --- | --- | --- |
| display | 42 / 1.10 / −0.022em / 300 | greeting, onboarding hero — max one per screen |
| title | 30 / 1.20 / −0.016em / 300 | screen title — one per screen |
| lead | 23 / 1.42 / −0.006em / 400 | the sentence under a title |
| body | 19 / 1.55 / 0 / 400 | default, every conversation bubble |
| label | 19 / 1.25 / +0.005em / 500 | control labels, answer options |
| caption | 16 / 1.45 / +0.012em / 400 | timestamps, metadata, device state |
| micro | 14 / 1.35 / +0.05em / 400 | the two ends of the 24h band only |

Two ad-hoc numeric sizes for the live data: **56px / 1.0 / −0.03em / 300** (Home card) and
**96px / 1.0 / −0.032em / 300** (Live view).

### Spacing, radii, geometry
- Screen gutter 24px; content max-width 420px; dock clearance 112px (content must never enter it).
- Radii: chip 14, card 22, panel 30, pill 999.
- Minimum tap target 56px (min-height and min-width).
- Bubble radii: bot `22 22 22 14`, hers `22 22 14 22`; padding 16; max-width 85%.
- Elevation is light, not shadow. Only float shadow: `0 10px 30px -12px rgb(90 60 35 / 0.28)`.
- Frame in this prototype: 390×844, radius 44, 1px line, board shadow `0 26px 64px -28px rgb(90 60 35 / .45)`.

### Motion
- press 120ms (opacity → 0.82, no scale, no colour change), screen 320ms, enter 420ms, settle 900ms.
- breath 9s, ring 7.5s. Easings: soft-out `cubic-bezier(.22,.61,.36,1)`,
  breathe `cubic-bezier(.37,0,.63,1)`, ripple `cubic-bezier(.16,.72,.28,1)`.

## The aura backdrop (every screen)
Five absolutely-positioned, heavily-blurred radial blooms inside the screen (`overflow:hidden`,
`pointer-events:none`, behind all content), each drifting on its own slow loop. Percentages are of the
screen box; each bloom is `border-radius:50%`, anchored with `left/top` + `translate(-50%,-50%)`.

| # | Size (w×h) | left / top | Fill (radial, closest-side → transparent at) | Blur | Animation |
| --- | --- | --- | --- | --- | --- |
| 1 | 170% × 58% | 50% / 30% | rgb(255 246 232 / 0.72) → 0 @76% | 34px | aura-a 46s |
| 2 | 150% × 52% | 26% / 66% | rgb(138 87 23 / 0.34) → 0 @72% | 58px | aura-b 61s |
| 3 | 120% × 44% | 82% / 18% | rgb(28 22 25 / 0.11) → 0 @70% | 52px | aura-c 74s |
| 4 | 112% × 38% | 16% / 8% | rgb(138 87 23 / 0.17) → 0 @70% | 44px | aura-d 67s |
| 5 | 150% × 52% | 62% / 96% | rgb(216 196 182 / 0.95) → 0 @72% | 46px | aura-d 53s |

Keyframes (all `cubic-bezier(.37,0,.63,1)`, infinite, 0%/100% at rest):
- aura-a: 50% `translate(-54%,-58%) scale(1.16)`
- aura-b: rest `scale(1.04)`, 50% `translate(-44%,-42%) scale(1.2)`
- aura-c: 50% `translate(-58%,-46%) scale(1.24)`
- aura-d: rest `scale(1.06)`, 50% `translate(-46%,-56%) scale(0.92)`

Respect `prefers-reduced-motion`: hold the blooms static (do not remove them).

## Shared controls

### CheckInControl — "Speak to Kindred"
Same rectangle, same position on every screen. Two weights, one label, one behaviour:
- **Primary** (Home's own CTA): 60px, full width minus 24px gutters, pill, bg accent, label on-accent,
  float shadow, KindredMark 24px + 12px gap.
- **Bar** (every other screen): 56px, bg surface, 1px line, text colour `text` (never muted — reads as
  disabled), float shadow, KindredMark 22px.
Press feedback: opacity 0.82 over 120ms. No scale, no colour change.

### Operator route — "Call an operator" (added on every screen)
Quiet accent row directly beneath the primary/bar control (and beneath the 999 note on triage screens):
min-height 56, full width, pill hit area, no fill, no border, colour accent #8a5717, PhoneCall glyph 20px
+ 10px gap, label role. `tel:08000551122`. Never red.

### EmergencyCall (triage + outcome screens only)
- **Standard**: min-height 64, pill, bg emergency, label on-emergency, PhoneCall Light 28px,
  "Call the clinic" in clinic hours / "Call the unit" out of hours → `tel:02079460523`.
  Beneath it, muted caption-weight row: "Heavy bleeding, collapse, or fitting: call 999".
- **Lead** (outcome): same pill, column layout, "Call 999" label + the numeral 999 at title size — the
  number is the largest interactive element on the screen. Secondary route drops to a muted row.
Never a shadow, never pulses, never animates, never disabled, never uppercase, never a warning triangle.

### Docks
Absolute, bottom 16px, 24px gutters, column, centred, gap 4px (non-triage) or 12px (triage/outcome).
Behind them a fade `linear-gradient(to top, #efe6e1, transparent)` — 184px tall on non-triage screens;
on triage/outcome the dock itself carries `padding:48px 24px 16px` and
`linear-gradient(to top,#efe6e1 66%,transparent)`.

### Marks (bespoke inline SVG, not an icon set)
`fill:none; stroke:currentColor; stroke-width:1.25; round caps/joins`; deliberately imperfect, nothing
axis-aligned. KindredMark (cupped hand under lamplight) 22/24px in controls, 96px in onboarding;
BandMark (open loop, tilted −8°) for device state; KindredAvatar (single flowing stroke, viewBox 0 0 60 104)
at 45×79 on Home under the greeting, inside a 96px breathing lamp-3 glow. No mark is ever red; none carries
a status dot. **No tick/check glyph exists anywhere in the product** — a chosen answer becomes her own
message instead.
Phosphor Light is used for the utility glyphs: PhoneCall 20/28px, Bell 22/24px, Microphone 24px,
PaperPlaneRight 20px, CaretLeft 24px, ArrowUpRight 20px, Stop 24px.

## Screens

### 01 Home — steady
**Purpose:** reassurance at a glance, and one tap to raise a concern.
**Layout:** column, padding `32px 24px 0`.
1. Greeting, display role: "Welcome back, Amara."
2. KindredAvatar centred (96px box, breathing lamp-3 glow), margin `20px auto 4px`.
3. Captions, muted: "Last 24 hours" then "Synced 4 minutes ago" (4px apart), 20px above.
4. **Live-data card** — radius 22, bg surface, padding `22px 16px 16px`:
   - Row: "142" at 56px/300 + "bpm" caption baseline-aligned (8px gap); right-aligned muted caption
     "Baby's heart rate".
   - **HeartRateTrace**: SVG `viewBox="-6 8 354 100"`, width 100%, height 100. One polyline,
     `stroke-width:1.6`, round caps/joins, no fill, stroked with a horizontal linear gradient of accent
     #8a5717 at opacity 0.07 → 0.28 @40% → 0.85 @82% → 1.0 (old to now). A 3.2r accent dot marks the live
     edge at the last sample. No axis, no gridlines, no baseline row — absence is absence.
   - Row of micro labels: "24 hours ago" / "now" (space-between, 12px above).
   - "Open live view" row-button: min-height 56, radius 22, bg surface-hi, label accent, ArrowUpRight
     accent, space-between, 24px above → navigates to 08.
   - Offline variant (band has no signal): the number row and trace are replaced by a centred 96px block
     with BandMark 34px and the muted caption "No signal since 06:20. Check the band is on."
5. Dock: primary CheckInControl + operator row.

### 02 Home — opened from the notification
Same screen with **AlertFramingBlock** inserted under the greeting, 24px stack gaps, and bottom padding
112px to clear the dock. The live-data card here shows the trace and micro labels only (no number row —
the alert is the focus).
- **AlertFramingBlock**: radius 22, bg surface-hi, padding 22. Bell 24px accent (2px top offset) + 12px
  gap. Two body lines: "Worth checking on your baby's movements." / "You know your baby best. Speak to
  Kindred if anything feels different." Then, 24px below, two full-width 56px pills stacked 12px apart:
  "Speak to Kindred" (accent fill, KindredMark 24px + 12px gap) and "Dismiss" (bg surface, 1px line).
  No red, no orange-as-warning, no triangle, no exclamation mark. Dismiss is one tap, never a dialog.
- Dock here is the **bar** variant + operator row.
- **PushBanner** (optional overlay, top 20px, 16px insets): radius 22, bg surface-hi, 1px line, padding 22,
  float shadow, Bell 22px accent + 12px gap; title row "Kindred" (body, 500) and muted caption
  "Worth checking on your baby's movements. Open when you're ready." No badge, no dot, no pulse, no sound.
  Copy leads with the action and her own perception — the word "detected" never appears patient-facing.

### 03 Check-in — the first gate
**Header:** back CaretLeft (56px target, −16px left margin, muted) + **progress rail** — 3px, pill,
accent on line, 16% here. No numeral, no gradient, no glow, no colour change at 100%; counts categories,
not questions; may go down if she changes an answer; hidden once the last category is answered.
**Conversation** (24px below header, 16px gaps):
- Bot bubble: "A few short questions, then you can add anything in your own words."
- Bot bubble: "Are you bleeding?"
- **Answer chips, left-aligned**, wrapping, 12px gaps: "Yes", "No", and "Add more info" (accent label).
  Chip = min-height 56, pill, padding 0 24, bg surface-hi, 1px line, label role.
- Tapping **Add more info** replaces the chip row with the composer (see 05 for the identical component),
  whose left action reads "Back to the options" and returns to the chips.
**Dock:** EmergencyCall standard + 999 note + operator row.

### 04 Check-in — answered, follow-up
Rail at 33%. Bot "Are you bleeding?" → her bubble "Yes" (right, surface-hi) → "Change this" (caption,
accent, right-aligned, 56px target) — 8px gaps. Then bot "How much?" and the follow-up option set,
left-aligned wrapping chips: "Spotting", "Like a period", "Heavier than a period",
"Soaking a pad within an hour". Multiselect variants use a 2px accent border for selected (never a tick)
plus a "Continue" accent pill; empty is a legitimate answer. Dock as 03.

### 05 Check-in — in her own words (the detail beat)
Rail at 83%. Inline, scrolls with the conversation — never docked; the dock belongs to the emergency
control alone.
- Bot bubble, two stacked lines: "Anything you want to add about that?" + muted caption "Type it, or
  record a voice note. This is optional."
- **Composer** (also used on 03): radius 22, 1px line, bg surface, padding 16. Placeholder line
  "Type here" (body, muted). 16px below, a space-between row: mic button on the left (56×56, pill,
  bg surface-hi, Microphone 24px accent) and on the right, 16px apart, "Skip this" (label, accent) and
  "Send" (pill, accent fill, PaperPlaneRight 20px + 8px gap, opacity 0.55 while empty).
- Recording state: the mic becomes Stop and gains a 1.5px lamp-4 ring breathing on the same 9s cycle.
  No red, no live duration, no waveform.
- Recorded state: a right-aligned voice-note bubble (surface-hi, radius `22 22 14 22`) with a play button.
Dock as 03.

### 06 Review — what goes to the clinic
Title "Check everything", lead "This is what goes to your clinic. You can change any answer." Then three
surface cards (radius 22, padding 16, 12px apart), each: muted caption label, body answer, and a
"Change this" caption-accent button (56px target, −8px left margin):
- Bleeding — "Yes — like a period, since this morning"
- Movements — "Fewer than usual today"
- In your own words — "It started after I got up. No pain, just the bleeding."
**Dock:** accent pill 60px "Send this to your clinic", muted caption "A midwife reads it. If it can't
wait, call instead.", then the operator row.

### 07 Outcome — emergency tier
Title "Please call 999 now.", lead "Tell them you are 31 weeks pregnant and bleeding heavily." Then a
surface card (radius 22, padding 22, 8px gaps): "Stay where you are, lie on your left side, and unlock the
front door if you can." + muted "Your answers have gone to Thornfield Maternity. They know you are calling."
**Dock:** EmergencyCall **lead** variant (Call 999 + the numeral), muted secondary route "For anything
else, call Thornfield Maternity on 020 7946 0523", then the operator row.

### 08 Live view — listening now
Back CaretLeft + title "Live view". Centred column: "142" at 96px/300 and muted caption
"bpm · baby's heart rate". Then the large trace: SVG `viewBox="-6 20 354 130"`, height 150, same polyline
treatment but the gradient runs accent 0.06 → 0.34 @30% → 0.95 @60%, then hard-switches at 62% to
text-muted #665a60 at 0.3 → 0.2 — the greyed part is the incoming edge, with a 3.6r accent dot at the
switch point (the live sample). Micro labels "2 minutes ago" / "now".
**Session ring** (centred, 132×132): line-coloured track and an accent arc, both 3px round-capped,
`stroke-dasharray 364.4` / `dashoffset 277` (≈24% elapsed), rotated −90° from centre; a breathing
lamp-3 glow sits 14px outside it. Inside, a surface-hi disc (inset 12px) with "04:11" at lead size and a
pause glyph (two 4×16 accent bars, radius 2, 4px apart). Below, centred muted caption
"Listening since 09:14. The band is connected."
**Dock:** bar CheckInControl + operator row.

## Interactions & Behaviour
- **Add more info (03):** `moreOpen` boolean. Chip row and composer are mutually exclusive; "Back to the
  options" returns. The composer is full width; the mic is inside it.
- **Open live view (01 → 08)** and **back (08 → 01)**.
- **Alert (02):** "Speak to Kindred" starts the check-in; "Dismiss" removes the block in one tap.
- **Answer chips:** a tap turns into her own message bubble plus a "Change this" affordance; changing an
  answer may reduce the progress rail — correct, not special-cased.
- **Send (05/03):** disabled look at opacity 0.55 while empty; "Skip this" is always available for the
  optional beat.
- **Emergency and operator controls** are always enabled and never animate.
- Press feedback everywhere: opacity 0.82 / 120ms.
- Reduced motion: freeze the aura, the breath glows and the ember/ring animations.

## State Management
| State | Type | Notes |
| --- | --- | --- |
| `clinicHours` | boolean | resolves the EmergencyCall label: "Call the clinic" vs "Call the unit" |
| `showPush` | boolean | simulated push banner on Home |
| `bandOffline` | boolean | swaps the live-data card for the no-signal state |
| `moreOpen` | boolean | 03's chips ↔ composer |
| answers | map of category → value | drives 04's bubbles, the rail, and 06's review rows |
| trace samples | array | 24h window for Home, live window for 08 |
| session elapsed | seconds | 08's ring + timer |
Data: `getMovementStream(variant).getWindow(24)` in the design-system reference; a bucket with no
movement renders nothing.

## Assets
No bitmaps. All marks are inline SVG (Kindred bespoke) plus Phosphor Light glyphs. Font: Alegreya Sans
(300/400/500, plus 700 loaded-but-unused) — self-host or use the codebase's existing loader; the prototype
pulls it from Google Fonts.

## Files
- `Kindred UI.dc.html` — all eight screens, inline-styled, opens in any browser.
  Screens are labelled with `data-screen-label` ("01 Home" … "08 Live view"); the tweak props
  (`clinicHours`, `showPush`, `bandOffline`) are declared on the script tag at the end of the file.
- Source design system: Kindred (colours day/night, type scale, marks, radii/elevation, ambient wash,
  conversation grammar, EmergencyCall, PushBanner, AlertFramingBlock, EmberBand).
