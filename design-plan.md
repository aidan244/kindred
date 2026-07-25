# Kindred — design plan

**This document is the single source of visual truth.** If a screen you are building needs a
colour, a size, a radius, a duration or a decision that is not in here, the answer is: use the
nearest thing that *is* in here. Do not invent a token. Do not add a hex value anywhere outside
`src/styles/tokens.css`. Do not add a font. Do not add a colour that is not on the ramp.

Read sections 0, 1, 9 and 10 no matter which screen you are building.

**Sections 13–17 are the second round of design**, added after the founder's mood board and four
product changes. They are additive: nothing in §0–§12 is repealed. Where §13–§17 needed a rule in
an earlier section loosened or tightened, the change is made **in place** in that section and
marked *(amended §13–§17)* — so §0–§12 remain readable as the current law, not as history.

| New section | What it specifies | Who needs it |
|---|---|---|
| §13 | The ambient moving background — iterations **A: Hearth** and **B: Room breath**, both behind a demo toggle | Whoever owns `Layout` |
| §14 | The conversational check-in — one continuous surface replacing the per-question screens | Whoever owns `/triage` |
| §15 | The auto-opening detail beat and voice notes | Whoever owns `/triage` |
| §16 | Demo-panel movement injection | Whoever owns `DemoPanel` / `MovementStream` |
| §17 | Mood board: what was adopted, what was rejected, and why | Everyone, once |

---

## 0. Rules of engagement

1. **Never hardcode a colour.** Use the Tailwind utilities (`bg-surface`, `text-text-muted`,
   `text-accent`) or `var(--token)` in bespoke CSS. Every value lives in `tokens.css`.
2. **Never compose the type utilities.** `text-body` already carries size, line-height,
   letter-spacing and weight. Do not add `font-medium`, `tracking-tight`, `leading-relaxed`
   on top of it. If you need a different role, use a different role.
3. **Every interactive element carries `tap`** (56×56 minimum). No exceptions, including
   icon-only buttons.
4. **Every scrolling screen carries `dock-safe`** on its scroll container, so content clears
   the docked Check-in control.
5. **Red is `--emergency` and it appears in exactly one place in the entire product** — the
   emergency call control. Nowhere else. Not on alerts, not on badges, not on borders, not on
   icons, not on validation errors.
6. **No verdict, ever.** No green. No tick at screen level. No "normal", "fine", "all clear",
   "looks good", "nothing to worry about". No smiley. No score. No number that summarises the
   baby. The app shows data and offers actions; it never draws a conclusion.
7. **No clinical monitor aesthetics.** No scrolling trace, no waveform, no ECG line, no gauge,
   no dial, no beep, no blinking, no red line, no numeric readout of the baby's state.
8. **Motion breathes.** Nothing ticks, pulses, counts, spins or races. Nothing under
   `--dur-press` except opacity. Every ambient animation checks `prefers-reduced-motion`.

---

## 1. The metaphor and the ramp

**Lamplight.** A warm bedside lamp switched on in a dark room at 3am. Every decision below
derives from it. The app should feel like a warm object on the nightstand, not a screen.

The generative rule behind the palette — this is what keeps it out of "generic warm beige"
territory and is worth understanding rather than just copying:

> **The neutral ramp is not grey. It rotates hue with value: darks carry a trace of violet,
> lights carry a trace of amber.**

That is how warm light actually behaves — the lit side of a room goes amber, the shadow side
goes cool. So `--bg` at night is a violet-black (`#1c1619`, B > G), `--text` is an amber-white
(`#f4ede8`, B < G), and everything between sits on that rotation. Nothing in this product is
`#888888`, and nothing is a flat beige either.

**Elevation is light, not shadow.** A surface nearer the lamp is lighter. The ramp steps *up*
in both themes: `bg` → `surface` → `surface-hi`. There is exactly one shadow in the system
(`shadow-float`) and it exists only for the one control that genuinely floats.

---

## 2. Colour

All values are in `src/styles/tokens.css`. Contrast ratios below are computed WCAG 2.1
(sRGB relative luminance). **Every text pairing the system mandates is ≥ 4.5:1.**

### 2.1 Night (default, and the demo theme)

| Token | Value | on `bg` | on `surface` | on `surface-hi` |
|---|---|---|---|---|
| `--text` | `#f4ede8` | **15.38** | **13.54** | **11.77** |
| `--text-muted` | `#bbaa9c` | **7.93** | **6.98** | **6.07** |
| `--accent` | `#e8b478` | **9.53** | **8.39** | **7.29** |

| Fill pairing | Ratio |
|---|---|
| `--on-accent` `#1c1619` on `--accent` `#e8b478` | **9.53** |
| `--on-emergency` `#1c1619` on `--emergency` `#e85b50` | **5.13** |
| `--focus` `#e8b478` ring on `bg` / `surface-hi` (needs ≥ 3.0) | **9.53** / **7.29** |

Surfaces: `--bg #1c1619` · `--surface #292125` · `--surface-hi #352b30` ·
`--line #3b3035` (decorative seam only, no contrast minimum) ·
`--scrim rgb(12 8 10 / 0.72)`.

### 2.2 Day (07:00–20:00 local, per the shared demo clock)

| Token | Value | on `bg` | on `surface` | on `surface-hi` |
|---|---|---|---|---|
| `--text` | `#2a2226` | **12.60** | **13.61** | **14.43** |
| `--text-muted` | `#665a60` | **5.34** | **5.77** | **6.12** |
| `--accent` | `#8a5717` | **4.94** | **5.34** | **5.66** |

| Fill pairing | Ratio |
|---|---|
| `--on-accent` `#efe6e1` on `--accent` `#8a5717` | **4.94** |
| `--on-emergency` `#efe6e1` on `--emergency` `#b3302a` | **5.06** |
| `--focus` `#8a5717` ring on `bg` / `surface-hi` (needs ≥ 3.0) | **4.94** / **5.66** |

Surfaces: `--bg #efe6e1` · `--surface #f6efe9` · `--surface-hi #fbf6f1` ·
`--line #e1d4cb` · `--scrim rgb(58 40 30 / 0.42)`.

### 2.3 Refinements to the baseline palette — original → new, and why

Four values changed. Each is a **verified** fix to a real failure or a real AI-signature risk,
not a preference.

| Token | Original | New | Reason |
|---|---|---|---|
| night `--text-muted` | `#b3a3a8` (7.40:1) | `#bbaa9c` (**7.93:1**) | `#b3a3a8` has B > G — a magenta/mauve cast. Across a maternity product that reads as the banned soft-pink register, and it fights the amber ramp. `#bbaa9c` is a warm taupe (B < G), on-ramp, and gains contrast. |
| day `--accent` | `#96601f` (4.54:1 on bg) | `#8a5717` (**4.94:1 on bg**) | `#96601f` measured **4.16:1 on `--surface-hi`** — a genuine AA failure for any accent text on an elevated surface. Darkened one step; now 4.94 / 5.34 / 5.66 across all three surfaces. |
| night `--emergency` | `#e5544b` (4.84:1 on bg) | `#e85b50` (**5.13:1 on bg**) | `#e5544b` measured **4.26:1 on `--surface`**, and the emergency confirmation sits on a `surface` sheet. Lightened ~6%; now 5.13 on `bg`, 4.51 on `surface`. Still a saturated vermilion, not a clay. |
| day `--bg` / `--surface` / `--surface-hi` | `#f3edea` / `#faf6f4` / `#f0e2d9` | `#efe6e1` / `#f6efe9` / `#fbf6f1` | Two problems. (a) The old set **inverted its own elevation logic** — `surface` was lighter than `bg` but `surface-hi` was *darker* than both, so "more elevated" meant two different things. (b) `#f3edea` sat close in value and feel to the banned AI-cream. New set is a deeper warm sand that steps monotonically up, and reads as lamplit paper rather than a bright white page. |

Unchanged and re-verified: night `--bg` `--surface` `--surface-hi` `--text` `--accent`, day
`--text` `--text-muted` `--emergency`.

### 2.4 Colour usage law

- `--accent` **is the lamp.** It is light. Use it for: the primary control fill, the focus
  ring, the ambient visualisations, and single small marks. Do **not** use it as a "warning"
  colour, a chart series, or a decorative wash behind text.
- `--emergency` **is fill-only, and appears once.** It is never a text colour, never a border,
  never an icon tint. Its only legal use is `bg-emergency text-on-emergency` on the emergency
  call control. (It is not AA-rated as text on `surface-hi` and must never be used that way.)
- `--text-muted` is for metadata, timestamps and orientation labels. It is **not** for body
  copy she needs to read while frightened, and **not** for control labels (reads as disabled).
- `--line` is a seam between two areas of the same value. It is never a decorative rule.
  Prefer a gap to a line — see §4.
- **There is no green, amber-warning, or blue token, and you must not add one.** Rule 6.

### 2.5 The lamp wash

`--lamp-1` … `--lamp-5` are pre-mixed alpha steps of `--accent` (0.05 / 0.11 / 0.20 / 0.36 /
0.62), for the ambient visualisations. Use these rather than writing your own `rgb(… / …)`.
They resolve correctly in both themes: at night they read as emitted glow on darkness, in day
the same construction reads as warm tone laid onto paper. If you need alpha at a different
level, use `rgb(var(--accent-rgb) / <a>)`.

*(amended §13)* **`--lamp-*` belongs to the two data visualisations only** — the live view (§7)
and the ember band (§8). The full-bleed ambient background (§13) uses a **separate** ramp,
`--wash-0` … `--wash-4`, defined in §13.2. They are deliberately not the same tokens: the lamp
is bounded artwork that may be strong, the wash is the ground the whole product stands on and is
capped by a contrast budget. A change to one must never silently move the other.

Neither ramp is mapped into `@theme`. Both are consumed only as `var(--lamp-N)` / `var(--wash-N)`
inside bespoke gradient CSS. **Do not add `--color-wash-*`** — it would generate a `text-wash-1`
utility, i.e. a 4%-alpha text colour, which is a trap.

---

## 3. Typography

### 3.1 Route and justification

**Route (a): a single humanist family — Alegreya Sans — across both roles, carrying all
contrast in weight and size.**

> One family, because three agents building in parallel cannot mis-pair a family that has no
> pair; and because a display face gives the interface a *voice*, which is precisely what a
> product whose first safety rule is "never draw a conclusion" must not have.

Why Alegreya Sans specifically: it is a genuinely humanist sans with a calligraphic skeleton
and slightly flared stems — the closest a sans gets to a human hand while staying quiet. It has
a real 300 that holds at hero sizes on a dark ground, and it appears essentially nowhere in
generated UI, so it carries no house style with it. Its x-height is modest, which is why the
scale below starts at 19px rather than 16px and leads generously — sizing that the
low-stimulation brief wanted anyway.

**Self-hosted**: `@fontsource/alegreya-sans`, latin subset, weights 300/400/500/700, bundled by
Vite into `dist/assets/`. **Zero network calls at runtime — verified.** Do not add a font.

### 3.2 The scale

Each role is one Tailwind utility carrying size + line-height + letter-spacing + weight.
**Use the utility alone. Never layer `font-*`, `tracking-*` or `leading-*` on top.**

| Utility | Size | Line-height | Tracking | Weight | Use |
|---|---|---|---|---|---|
| `text-display` | 42px | 1.10 | −0.022em | 300 | Onboarding hero. **At most one per screen, and most screens have none.** |
| `text-title` | 30px | 1.20 | −0.016em | 300 | Screen title. One per screen. |
| `text-lead` | 23px | 1.42 | −0.006em | 400 | The sentence under a title. The question in the triage flow. |
| `text-body` | 19px | 1.55 | 0 | 400 | Default. Everything else. |
| `text-label` | 19px | 1.25 | +0.005em | 500 | Control labels, answer options. |
| `text-caption` | 16px | 1.45 | +0.012em | 400 | Timestamps, metadata, device state. |
| `text-micro` | 14px | 1.35 | +0.05em | 400 | **Orientation labels only** (the two ends of the 24h band). Nothing else. |

### 3.3 Type law

- **Weight 300 is only legal at ≥ 30px** (`text-display`, `text-title`). Below that it goes
  thin and haloed against the night background. Body and below are always 400 or 500.
- **Weight 700 does not exist in this system.** It is loaded only so an accidental `font-bold`
  degrades to a real cut instead of a synthesised one. Do not use `font-bold`.
- **No uppercase, anywhere.** Not for labels, not for buttons, not for eyebrows. Tiny
  tracked-out caps are an AI-design tell and this system has none.
- **Sentence case everywhere**, including buttons.
- **No italics.** Not loaded.
- Measure: body text never exceeds ~34 characters per line at 390px — which the 24px gutters
  and `--content-max` give you for free. Do not widen it.
- `h1`–`h3` already default to 300 / −0.016em / `text-wrap: balance`; `p` defaults to
  `text-wrap: pretty`.

---

## 4. Layout

### 4.1 Spacing rhythm

Base 4px. Sanctioned steps: **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96** (Tailwind `1 2 3 4 6
8 12 16 24`). Nothing else. If a gap feels wrong, move a step, don't invent one.

| Relationship | Gap |
|---|---|
| Screen side padding | **24px** (`px-6`) |
| Top of screen → first element | **32px** below the safe area. A title never sits against the top edge. |
| Title → its lead sentence | **12px** |
| Lead → first content block | **32px** |
| Sibling blocks | **24px** |
| Section → section | **48px** |
| Inside a card | **22px** all round |
| Bottom of scroll content | `dock-safe` (112px + safe-area) |

Generous negative space is a requirement, not a style. When in doubt, add a step.

### 4.2 Radius language

Nothing in this product is square. Minimum radius in the system is 14px.

| Utility | Value | Use |
|---|---|---|
| `rounded-chip` | 14px | Inputs, chips, small tiles |
| `rounded-card` | 22px | Cards, list rows, ambient panels |
| `rounded-panel` | 30px | Sheets, full-width panels, the live-view frame |
| `rounded-pill` | 999px | **Every button and control, without exception** |

### 4.3 Surface elevation

Three levels, and elevation is expressed as **value, not shadow**:

- `bg-bg` — the room. The page.
- `bg-surface` — a card, a row, a sheet. `rounded-card`, 22px padding, **no border, no shadow.**
- `bg-surface-hi` — something inside or on top of a card: an inset track, a selected answer,
  the alert block.

Rules:
- **Do not put a shadow on a card.** The value step *is* the elevation. `shadow-float` is
  reserved for the one docked control.
- **Do not use `backdrop-blur` on panels.** Glassmorphism is not in this system.
- **Prefer a gap to a divider.** If two things need separating, use 24px of nothing. Use a
  1px `border-line` only where two areas of the *same* value genuinely abut.

### 4.4 Responsive — 390px first, and that's mostly it

- Everything is designed at **390 × 844**.
- Content column: `max-width: var(--content-max)` = **420px**, centred, at every viewport size.
  A larger window gets **more `--bg` around the column, not a wider column.**
- **Do not add breakpoints. Do not add a desktop layout. No `md:` grids, no two-column
  anything.** This is a bedside object; on a laptop it should look like a phone-shaped app
  centred in a warm dark field. That is deliberate and reads as confidence, not as an oversight.
- The **live view is the single exception**: full-bleed at any size (§7).

### 4.5 Where the Check-in control sits

`CheckInControl` is `position: fixed`, horizontally centred, `bottom: max(16px,
env(safe-area-inset-bottom))`, width `calc(100% - 48px)` capped at `--content-max` minus
gutters. **Both variants occupy the same rectangle in the same place on every screen** — that
consistency is a safety property, not a layout convenience. Do not move it, do not hide it on
scroll, do not shrink it.

Above it, every screen renders a **24px fade** from `--bg` to transparent, so scrolling content
dissolves under the control instead of being sliced by a hard edge:
`background: linear-gradient(to top, var(--bg), transparent)`.

Composition on Home, top to bottom: title → lead → the 24h ember band → the live-view entry →
(spacer) → the docked primary Check-in control. Nothing else competes for the bottom third.

---

## 5. Motion

Slow and ambient. If something moves, it breathes.

| Token | Value | Applies to |
|---|---|---|
| `--dur-press` | 120ms | Press feedback. **Opacity only** — no scale, no ripple, no colour change. |
| `--dur-screen` | 320ms | Route transition: opacity + 8px rise. |
| `--dur-enter` | 420ms | An element or sheet entering. |
| `--dur-settle` | 900ms | Something coming to rest (the live view fading in). |
| `--dur-breath` | 9s | The canonical ambient breath cycle. |
| `--dur-ring` | 7.5s | Live-view movement ring lifetime. |
| `--ease-soft-out` (`ease-soft`) | `cubic-bezier(.22,.61,.36,1)` | Entrances. **No overshoot, ever.** No springs, no bounce. |
| `--ease-breathe` (`ease-breath`) | `cubic-bezier(.37,0,.63,1)` | Sinusoidal; all ambient loops. |
| `--ease-ripple` | `cubic-bezier(.16,.72,.28,1)` | The live-view ring: spreads, then loses energy. |

`animate-breath` is the one shared ambient loop (opacity 0.62 → 1, scale 1 → 1.035, 9s).

**Banned motion**: spinners, **indeterminate** progress indicators, counters, countdowns,
elapsed-time readouts, level meters, skeleton shimmer, pulsing anything, spring physics,
parallax, auto-advancing carousels, staggered list cascades, attention-seeking bounce. A spinner
in this product is a heart-rate cue. Use a static `text-caption text-text-muted` line instead.

*(amended §14.3)* **One determinate position indicator is permitted**, and there is exactly one
in the product: the check-in progress rail (§14.3). The distinction that makes it legal is not
cosmetic — it **never moves on its own**. It moves only in direct response to something she did,
it has no idle animation, it carries no numeral, and it has no completed/reward state. Anything
that advances by itself while she waits is still banned.

*(amended §13.5)* The two ambient loops in §7/§8 are joined by a third, the background wash
(§13). It obeys the same law: long near-coprime periods, `transform`/`opacity` only, sinusoidal
easing, and a JS reduced-motion branch rather than the global duration collapse.

### 5.1 prefers-reduced-motion

A global CSS baseline in `index.css` already collapses all CSS animation and transition
durations to 0.01ms under `prefers-reduced-motion: reduce`. That handles the ordinary UI for
free.

**The two ambient views must additionally branch in JS**, because collapsing their durations
would strobe rather than calm:

```ts
const [reduced, setReduced] = useState(
  () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
);
useEffect(() => {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const on = () => setReduced(mq.matches);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}, []);
```

Per-element reduced-motion behaviour is specified inline in §7 and §8. The rule in both cases:
**opacity may still change slowly; nothing may translate, scale or expand.**

---

## 6. Icons

### 6.1 Phosphor: **Light**, everywhere, no exceptions

`import { X } from '@phosphor-icons/react'` → `<X size={24} weight="light" aria-hidden="true" />`

- **`weight="light"` on every Phosphor icon in the product.** Chosen over Thin because Thin
  renders sub-pixel at 24px and disappears into halation on the night background; Light keeps
  the same delicacy while staying legible to someone whose hands are shaking.
- Never `bold`, `fill`, `duotone` or `regular`. Never mix weights.
- Default size 24px; 28px inside the primary and emergency controls. Always inside a `tap` box.
- `aria-hidden="true"` unless the icon is the only label, in which case the button needs
  `aria-label`.
- **Lucide is banned.**
- Sanctioned set: `X`, `CaretLeft`, `CaretRight`, `PhoneCall`, `Bell`, `Clock`, `NotePencil`,
  `DownloadSimple`, `ArrowUpRight`, and *(added §15)* `Microphone`, `Stop`, `Play`, `Pause`,
  `Trash`, `PaperPlaneRight`. Need something else — pick the plainest Phosphor glyph and keep it
  Light.
- *(amended §14.4)* **`Check` no longer appears anywhere in the product.** It was previously
  permitted on a selected form input; the conversational check-in (§14) removes the last such
  input — a chosen answer is now expressed by becoming her own message, so there is nothing left
  for a tick to mark. Do not add one back. A tick is a verdict. Rule 6.
- **`WarningCircle` / `Warning` / `WarningOctagon` are banned outright.** A caution triangle is
  an emergency cue and most alerts here are false positives.

### 6.2 The four hand-drawn moments

These four get bespoke inline SVG, not icon-set glyphs. They are what makes the product look
drawn rather than assembled. All share the same hand: `fill="none"`, `stroke="currentColor"`,
`stroke-width="1.25"` (scaled proportionally at larger sizes), `stroke-linecap="round"`,
`stroke-linejoin="round"`. **Deliberate imperfection is the point** — arcs must not be exactly
concentric, spacing must not be exactly even, and nothing should be axis-aligned.

**(1) The mark — a cupped hand under a pool of lamplight.** 24×24 (and a 96×96 for onboarding).
The hand is a single shallow open curve: from `(4,13)` sweeping down through `(12,19)` and back
up to `(20,13)`, with two short finger ticks rising off the ends. Above it, **three shallow
arcs** centred near `(12,7)` at radii ≈ 3.2 / 5.4 / 8.1, each spanning only ~70° across the top
— light falling into the hand. Vary each radius by ±0.4 and each end angle by ~8° so they read
as drawn. This is the product's only logo, and it is the glyph inside the Check-in control
(replacing the Phosphor `Hand`). It is the name of the app, drawn.

**(2) The live view surface** — the reflection and its rings. Fully specified in §7.

**(3) The home 24h ember band** — fully specified in §8.

**(4) The band mark — the worn sensor.** 24×24. A single loop drawn *open*: an arc from `(5,9)`
around the bottom to `(19,9)`, a small gap, then a short arc closing the top — the gap is the
clasp. Tilt the whole thing ~8° so it reads as a worn object rather than a symbol. Used wherever
device or connection state appears: onboarding, the alert block, the live view's "no signal"
line. It is never red and never has a status dot on it.

---

## 7. THE SIGNATURE: the live view

### 7.1 Concept

The screen becomes the still surface of a glass of water on the nightstand, with the lamp
reflected in it. The reflection is the only bright thing — a soft, elongated pool of amber low
in the frame, made of three overlapping blurred forms that drift on long, mismatched periods so
the light seems to swim very slowly and never visibly repeats. When the baby moves, a **ring
spreads** from somewhere on the surface: born small, opening outward over seven and a half
seconds, thinning and fading as it loses energy, gathering a little extra light as it goes.
Movements arrive when they arrive. Two or three rings overlap during a busy stretch; during a
quiet stretch there are none and you are left watching the lamp swim. There is no countdown, no
session, no elapsed time, no completion, no result, and no number. She opens it, watches, closes
it when she wants.

> **Why this**: a ripple is the one visual that reads unmistakably as *something moved* rather
> than *something was measured* — it is physical, domestic and warm, it holds attention for ten
> minutes because it never repeats, and its quiet state is a still lamplit surface, which is
> calm without being a reassurance.

The rings are **elliptical** (`rx : ry = 1 : 0.62`), as if you were looking at the surface at an
angle. That single choice is what stops concentric circles reading as radar or sonar — and it is
non-negotiable.

### 7.2 Architecture

Two stacked layers, both `position: absolute; inset: 0`, inside a full-bleed `bg-bg` container.
Split this way for performance: blur is expensive, so only the *static* layer is blurred.

- **Layer A — the reflection.** Three HTML `<div>`s with radial-gradient backgrounds and CSS
  `filter: blur(...)`. GPU-composited, cheap, never re-laid-out.
- **Layer B — the rings.** One `<svg>`. **No SVG filters** — the strokes are already soft at
  these alphas, and `feGaussianBlur` on animating geometry will drop frames.

```
viewBox="0 0 390 780"  preserveAspectRatio="xMidYMid slice"  width/height 100%
```

`slice` means taller or wider viewports crop rather than distort. The visualisation is the
screen — no card, no border, no frame.

*(amended §13.3)* **The ambient background wash (§13) does not render on `/live`.** The live view
already *is* a lamp; a second light source underneath it would double-expose the reflection,
break §7.3's "always at full strength, never changes" invariant, and turn one hue into a
two-source composite that reads as the banned AI-aurora mesh (§11). `Layout` suppresses the wash
on this route explicitly — do not rely on `LiveView`'s own `bg-bg` to cover it.

### 7.3 Layer A — the reflection

Three divs, all centred on **50% / 64%** of the container, each
`border-radius: 50%; background: radial-gradient(closest-side, <fill>, transparent);`

| # | Size (of container) | Fill | Blur | Drift period |
|---|---|---|---|---|
| R1 | 78% × 27% | `var(--lamp-3)` | 30px | **23s** |
| R2 | 54% × 17% | `var(--lamp-4)` | 22px | **31s** |
| R3 | 30% × 9% | `var(--lamp-5)` | 14px | **41s** |

Each drifts on its own keyframe: `translate(±7px, ±4px)` and `scale(1 → 1.05 → 1)`, easing
`var(--ease-breathe)`, `infinite`. **The three periods (23 / 31 / 41s) are near-coprime on
purpose** — the composite takes hours to repeat, which is what makes it watchable.

Behind all three, one static `<div>` filled with
`radial-gradient(60% 45% at 50% 64%, var(--lamp-1), transparent 72%)` — the barely-there sense
that the room has a light in it.

**The reflection is always rendered at full strength. It never dims, never changes colour,
never stops, and never responds to the data.** The lamp does not go out.

### 7.4 Layer B — the rings

Subscribe on mount:

```ts
useEffect(() => getMovementStream(variant).subscribe(handleSample), [variant]);
```

`handleSample(sample)`:
- `sample.moved === true` → push one ring.
- `sample.moved === false` → **do nothing at all.** No state change, no visual change, no
  counter, no timer reset. This is a safety requirement, not an optimisation.

Each ring is `{ id, cx, cy }` where `id` is a monotonically increasing integer (used as the
React key so the element mounts fresh and the animation restarts), and:

- `cx` = random in **[90, 300]**
- `cy` = random in **[400, 620]**

— the lower two-thirds, near the reflection but never centred on it. Never spawn at the exact
centre; an off-centre origin is the second thing that kills the radar read.

Cap concurrent rings at **6** (a guard — samples arrive every 4s against a 7.5s life, so 2–3 is
the natural maximum). Remove a ring in its `onAnimationEnd`; do not run a cleanup interval.

Each ring is a `<g transform="translate(cx cy)">` containing two ellipses sharing one animation:

```
<ellipse rx="170" ry="105" fill="var(--lamp-2)"   class="ring-fill" />
<ellipse rx="170" ry="105" fill="none"
         stroke="var(--lamp-4)" class="ring-stroke" />
```

```css
.ring-stroke, .ring-fill {
  transform-box: fill-box;
  transform-origin: center;
  animation: kindred-ring var(--dur-ring) var(--ease-ripple) forwards;
}

@keyframes kindred-ring {
  0%   { transform: scale(0.06); stroke-width: 26;  opacity: 0;    }
  6%   {                                            opacity: 0.55; }
  22%  { transform: scale(0.42); stroke-width: 3.4; opacity: 0.50; }
  100% { transform: scale(1.00); stroke-width: 0.5; opacity: 0;    }
}
.ring-fill { animation-name: kindred-ring-fill; }
@keyframes kindred-ring-fill {
  0%   { transform: scale(0.06); opacity: 0;    }
  18%  {                         opacity: 0.35; }
  100% { transform: scale(1.00); opacity: 0;    }
}
```

Because `transform: scale()` also scales the rendered stroke, the counter-animated
`stroke-width` produces the taper: rendered width goes 1.56px → 1.43px → 0.5px. The ring gets
finer as it opens, like a real ripple. Keep the numbers as given.

### 7.5 Chrome

Almost none.

- **Close**: top-left, 56px `tap` box, Phosphor `X` Light 26px, `text-text-muted`, no
  background, `aria-label="Close"`.
- **One label**: top-centre, `text-caption text-text-muted`, sentence case: **"Live movement"**.
  It **fades to 0 over 1.2s after 6 seconds**, leaving the screen as pure image. Nothing brings
  it back.
- **The docked Check-in bar** is mounted by `Layout` and stays. Render the 24px `--bg` fade
  above it (§4.5) so it sits on the image cleanly.
- **Nothing else.** No timer, no elapsed time, no counter, no session state, no "done", no
  completion, no share, no settings, no legend.

Entry: previous screen fades out over `--dur-screen`; the surface fades in over `--dur-settle`
with the reflection scaling 0.94 → 1 on `--ease-soft-out`. Exit: opacity only, 320ms.

### 7.6 Reduced motion

- Reflection: rendered exactly as specified, **drift animations removed**. Static.
- Rings: **no expansion.** Each movement sample renders a *stationary* ellipse at the spawn
  point at mid-size (`rx="78" ry="48"`), `stroke="var(--lamp-4)" stroke-width="1.2"
  fill="var(--lamp-1)"`, which fades in over `--dur-settle` and out over 5s, then unmounts.
  **Opacity is the only animated property.**
- Everything else identical. Same colours, same geometry, same absence of chrome.

### 7.7 Quiet and empty data — read this twice

This is where the product's dominant harm lives. Get it wrong and the view becomes either a
false alarm or a false reassurance.

- **There is no branching on movement density.** No threshold, no "quiet mode", no state
  machine, no `if (recentMovements < n)`. Busy and quiet differ *only* in how many rings happen
  to exist, and that emerges from the data. Do not add a code path.
- **The reflection never changes.** It does not dim when the feed is quiet, does not brighten
  when it is busy, does not shift hue. Quiet looks like a still lamplit surface — which is
  neither alarming nor reassuring. It just shows less.
- **No text ever appears in response to movement or its absence.** Not "quiet", not "no
  movement detected", not "all clear", not "settled", not "resting".
- **`moved: false` produces no visual change of any kind.**
- **`getBaseline()` must not be used in this view.** Comparing to baseline is interpretation.
- **The only conditional text in the whole view**: if `subscribe` has delivered *zero samples of
  any kind* for 20 consecutive seconds, show one line at the top in `text-caption
  text-text-muted`, alongside the hand-drawn band mark (§6.2 #4): **"No signal from the band."**
  That is a statement about the hardware, not about the baby. It must disappear the instant any
  sample arrives — **including a `moved: false` sample.** Never phrase it as anything about
  movement.

---

## 8. The home 24-hour ambient band

The live view's quieter sibling: a still record, not a live thing.

### 8.1 Concept

A scattering of warm embers across the card — dense where she was moving, thin where she was
not. It shows the shape of the last day and stops.

### 8.2 Data

```ts
const samples = getMovementStream(variant).getWindow(24); // 5-min resolution
```

Fold into **96 buckets of 15 minutes** (3 samples each), oldest left → now right. Each bucket
holds `movedCount ∈ {0,1,2,3}`.

### 8.3 Geometry

A `bg-surface rounded-card` panel, padding `22px 16px 16px`, containing an `<svg
viewBox="0 0 342 96">` at `width: 100%`.

For bucket `i` (0…95):

- `cx = 1.78 + i * 3.5625`
- `cy = 48 + jitter(i)`, where `jitter(i)` is **deterministic** from the index —
  e.g. `((Math.sin(i * 12.9898) * 43758.5453) % 1) * 26 - 13`, clamped to ±13.
- `movedCount === 0` → **render nothing.** Absence is absence. No faint dot, no placeholder, no
  baseline row.
- `movedCount === 1` → `r=1.1`, `fill="var(--lamp-3)"`
- `movedCount === 2` → `r=1.6`, `fill="var(--lamp-4)"`
- `movedCount === 3` → `r=2.1`, `fill="var(--lamp-5)"`

> **The vertical jitter encodes nothing.** It exists solely to break the row so the band cannot
> read as an axis. Do **not** map `movedCount` — or anything else — to `cy`. The moment height
> means something, this is a bar chart, and then it is a CTG trace, and then it is a hospital
> monitor. Density is the only channel.

Forbidden inside the band: axis, gridlines, ticks, baseline rule, y-scale, area fill,
connecting line, tooltip, hover state, cursor, "now" marker.

### 8.4 Labels

Exactly two, `text-micro text-text-muted`, 12px below the band, one flush left and one flush
right: **"24 hours ago"** and **"now"**.

That is all the text this component may contain. No count, no percentage, no duration, no "most
active around…", no comparison, no `getBaseline()`, no interpretation, no summary sentence
above or below it. It shows the shape and stops.

### 8.5 Motion

Each ember breathes very slightly. To keep it cheap, **assign each circle to one of 6 phase
groups by `i % 6`**, wrap each group in a `<g>`, and give each group one animation: opacity
oscillating ±8% about 1, duration **14s / 16.5s / 19s / 21.5s / 24s / 26s**, delays
**0 / 2.2 / 4.7 / 1.3 / 3.6 / 5.9s**, `var(--ease-breathe)`, `infinite`.

Six animations, not ninety-six. Because the periods differ, nothing sweeps, scans or travels
across the band — it just shimmers faintly, like ash. **A travelling wave would read as a
scanning monitor; do not build one.**

**Reduced motion**: no animation. Static embers. Identical otherwise.

### 8.6 Entry point to the live view

Directly beneath the band, inside the same card: a full-width `tap` row, `text-label
text-accent`, left-aligned label **"Open live view"** with a Phosphor `ArrowUpRight` Light 20px
at the right. `rounded-card`, `bg-surface-hi`, no border. Not a red button, not an alert, not a
badge.

---

## 9. Component mandates

These bind whichever agent owns the component.

### 9.1 `CheckInControl` — ✅ the scaffold's rule violation, fixed

The scaffold shipped the primary variant as `bg-emergency px-6 text-lg text-text`, which broke
Rule 5 (red appears exactly once, on the emergency call control, and this is not it) and also
failed contrast at **3.00:1**. **This has been corrected** in
`src/components/CheckInControl.tsx` — the primary variant is now `bg-accent text-on-accent` at
**9.53:1**. Recorded here so nobody re-introduces it; the table below is the current law.

| | Primary (Home) | Bar (everywhere else) |
|---|---|---|
| Fill | `bg-accent` | `bg-surface` |
| Label | `text-on-accent`, `text-label` | `text-text`, `text-label` (**not** `text-text-muted` — reads as disabled) |
| Border | none | `border border-line` |
| Radius | `rounded-pill` | `rounded-pill` |
| Height | 60px | 56px |
| Shadow | `shadow-float` | `shadow-float` |
| Glyph | hand-drawn mark (§6.2 #1), 24px, `currentColor` | same, 22px |

Both are full width up to `--content-max` minus gutters, in the same fixed position. Press
feedback: opacity 0.82 over `--dur-press`. No scale.

### 9.2 The emergency call control — the one red thing

`bg-emergency text-on-emergency rounded-pill`, min-height **64px**, full width, `text-label`,
Phosphor `PhoneCall` Light 28px. Contrast **5.13:1** night / **5.06:1** day.

It appears **only** on the triage emergency path. It is the only red pixel in the product. It
never gets a shadow, never pulses, never animates, and is never disabled. Label is a plain verb
phrase, resolved from the contact's `kind` — "Call the clinic" in clinic hours, "Call the unit"
out of hours — not "EMERGENCY", not uppercase, not with an icon of a warning triangle.

### 9.3 Alerts / `PushBanner`

**An alert must not look like an emergency.** Most are false positives; a red banner at 3am is
the single most harmful thing this product could render.

`bg-surface-hi rounded-card`, 22px padding, `text-text` body copy, `text-caption text-text-muted`
for the timestamp. The only decoration permitted is the hand-drawn band mark (§6.2 #4) or a
Phosphor `Bell` Light 24px in `text-accent`. **No red, no orange-as-warning, no warning
triangle, no exclamation mark, no badge, no dot, no pulse, no shake, no sound.** The action
inside it is a normal pill control, not a red one.

### 9.4 Cards and rows

`bg-surface rounded-card`, 22px padding, no border, no shadow. Selected/active state is
`bg-surface-hi` plus a 2px `border-accent` — never a fill of accent behind body text, never red.

### 9.5 Focus

Already global: `2px solid var(--focus)`, `outline-offset: 3px`, inheriting the element's
radius. Do not remove it, do not set `outline: none` anywhere.

### 9.6 Components added in round two

Mandated by §13–§16 rather than here, but listed so this section stays the index of what exists.

| Component | Spec | Replaces |
|---|---|---|
| `AmbientBackground` (mounted once in `Layout`) | §13 | — |
| `CheckInConversation` (`src/screens/triage/`) | §14 | **`RedFlagStep.tsx` and `TriageChat.tsx`** — delete both; do not keep two paths alive |
| `DetailBeat` / `VoiceNoteComposer` | §15 | `RedFlagStep`'s inline "Add detail" field |
| `VoiceNoteBubble` / the review attachment row | §15.4, §15.6 | — |

Unchanged and not to be touched by round two: `EmergencyCall` (§9.2), `CheckInControl` (§9.1),
`LiveSurface` (§7), `EmberBand` (§8), `AlertFramingBlock`, `PushBanner` (§9.3).
`ReviewStep` gains only the attachment row (§15.6) — its structure is deliberate (§14.8).

---

## 10. Copy

Plain, active, short, sentence case.

- **No exclamation marks. No emoji. No Title Case. No ALL CAPS.**
- **No verdict words**: normal, fine, healthy, good, all clear, reassuring, nothing to worry
  about, everything looks, don't worry, try not to worry.
- **No hedging or apologising**: sorry, unfortunately, oops, just, simply, please note.
- **No cuteness**: no "little one", no "bump", no "mama", no baby talk, no nicknames.
- **Buttons are verbs**: "Check in", "Call the unit", "Open live view", "Close", "Send to the
  clinic".
- Address her as "you". Say what the app knows and what she can do. Never say what it thinks.
- Numbers only where they are facts she asked for (a time, a date, a week count). Never a score.
- Prefer the shortest true sentence. Second person, present tense, active voice.

*(added §14.2)* **The conversational voice has no first person.** The check-in (§14) speaks in
messages, which is the strongest possible invitation to write "I'll ask you a few questions" or
"I can see you've…". Do not. **The words "I", "I'm", "I'll", "me", "my", "we", "we'll" and "our"
do not appear anywhere in the product.**

> A first person implies a self, a self implies a view, and a view is a verdict. §3.1 already
> refused the interface a *voice* for this reason; a chat surface is where that decision gets
> tested, so it is restated here as a hard lexical rule that a reviewer can grep for.

The presence comes from rhythm and brevity instead: short lines, a pause between them, and never
more than one idea per message. It is warm because it is unhurried, not because it is friendly.

---

## 11. The AI-default audit

Each banned pattern, and the specific thing in this system that prevents it.

| Banned pattern | How this system avoids it |
|---|---|
| **Warm cream ≈ `#f4f1ea` + terracotta/clay ≈ `#d97757`** — the single most recognisable AI signature, and the exact trap a warm brief falls into | Day `--bg` moved `#f3edea` → **`#efe6e1`**: a deeper warm *sand*, not a bright yellow-cream. Day `--accent` moved `#96601f` → **`#8a5717`**: a dark bronze at 4.94:1 — a *text-capable* colour, not a decorative clay. Structurally: the accent here is **light**, not a fill — it is the lamp, used in the ambient views and one control, never as a terracotta wash behind copy. And the default theme is the dark one, so the demo never shows a cream page at all. |
| **High-contrast display serif over a generic sans** | **No serif exists in this product.** One humanist family, Alegreya Sans, across both roles (§3.1). Contrast comes from weight (300 vs 500) and size (42 vs 14), not from a face pairing. |
| **Near-black + acid green** | **There is no green token, and adding one is forbidden** (§2.4) — not because of taste but because of Rule 6: green is a verdict, and this product may not deliver one. Backgrounds are violet-black, not near-black; the ramp is chromatic, not neutral. |
| **Broadsheet layouts, hairline rules, zero border radius** | Minimum radius in the system is **14px**; every control is `rounded-pill`. Dividers are **gaps, not rules** — `--line` is restricted to same-value seams (§4.3). Single centred 420px column, no multi-column grid, no rule-work, no editorial masthead. |
| **Soft-pink maternity styling** | Actively removed: night `--text-muted` moved `#b3a3a8` → **`#bbaa9c`**, because `#b3a3a8` has B > G — a magenta cast that would have tipped the whole muted layer into the maternity-pink register. The remaining violet in `--bg`/`--surface` is a shadow trace below 2% luminance, not a pink. No pastels, no rounded-cute forms, no hearts, no footprints, no baby imagery, no "mama" copy (§10). |
| **Anything resembling a hospital dashboard** | No metric tiles, no gauges, no dials, no status colours, no trace, no waveform, no numbers at all in either data view. The two visualisations are a **reflection on water** and a **scattering of embers**. Rule 7 bans monitor forms outright, §8.3 explicitly forbids mapping anything to height so the ember band cannot drift into a bar chart, and §7.1 mandates elliptical rings so ripples cannot read as radar. |
| *(also caught)* **Blurry multi-hue "AI aurora" mesh gradient** | The blurred layer is **one static light source in a single hue**, not a mesh of three or four. The entire palette is single-hue amber on a chromatic neutral ramp — there is no second hue available to make a mesh out of. All the incident in the live view is in crisp stroked geometry, not in the blur. |
| *(also caught)* **Glassmorphism / `backdrop-blur` cards** | Banned in §4.3. Elevation is a value step; the only shadow is `shadow-float` on one docked control. |
| *(also caught)* **Tiny tracked-out uppercase eyebrow labels** | **No uppercase anywhere** (§3.3). `text-micro` is sentence case and legal only on two orientation labels in the whole product. |
| *(also caught)* **Spinners, shimmer skeletons, pulsing badges, springy motion** | Banned in §5. A spinner is a heart-rate cue in this context. Loading is a static muted line; nothing overshoots; nothing pulses. |

---

## 12. What changed in the scaffold (already done)

- **`src/styles/tokens.css`** — final values for both themes (same variable names, so every
  existing utility keeps working). Added: `--on-accent`, `--on-emergency`, `--line`, `--focus`,
  `--scrim`, `--accent-rgb`, `--text-rgb`, `--lamp-1…5`, `--elev-float`, `--r-chip/card/panel/
  pill`, `--tap-min`, `--gutter`, `--content-max`, `--dock-clearance`, `--dur-*`, `--ease-*`,
  `--font-stack`, and `color-scheme` per theme.
- **`src/index.css`** — `@theme static` mappings for colour, the seven type roles (each
  carrying size + leading + tracking + weight), radii, `shadow-float`, easings and
  `animate-breath`; the `breath` keyframes; `tap` and `dock-safe` utilities; self-hosted font
  imports; base typography, `::selection`, focus-visible, and the reduced-motion baseline.
- **`package.json`** — added `@fontsource/alegreya-sans` (latin 300/400/500/700, bundled by
  Vite; zero network calls at runtime).

Verified: `npm run build` passes, all utilities generate, all fonts emit to `dist/assets/`,
`npm test` passes.

---

# Round two — the mood board changes

---

## 13. The ambient background

The founder's brief: *"warm, dynamically moving background, to induce calm."* The mood board
points at it seven different ways — a single soft bloom filling the frame (Open), a barely-there
warm haze behind an almost-empty screen (Raycast AI), a blurred amber field carrying big type
(pillowtalk), a sunset the interface floats on (TIDE, stoic), a dark field warming toward the
bottom (Calm Sleep).

Every one of those is the same idea: **the app is not a page, it is somewhere.**

Which is exactly the lamplight metaphor (§1), applied one level further out. §7 put a light
inside one screen. §13 puts the room behind all of them.

**Two iterations are specified. Both get built, behind a demo-panel toggle, so the founder can
switch between them live.** They are not variations on a theme — they answer the question
differently, and the founder should be choosing between two positions, not two blur radii:

- **A — Hearth.** There is one light, it is low and off to one side, and the content sits above
  it. Warmth is *located*. You can point at where it comes from.
- **B — Room breath.** There is no visible source. The whole field is faintly, unevenly warm and
  it moves. Warmth is *ambient*. You cannot point at it, and you may not consciously notice it.

A is the braver one and reads instantly on a projector. B is the one that survives being looked
at for ten minutes at 3am. **Recommendation: default the demo to A, and ship whichever the
founder picks after seeing B for a full minute, not five seconds.**

### 13.1 Where it renders — and why not everywhere

**Behind every screen except `/live`.** Mounted once in `src/components/Layout.tsx`, above
`<main>` in DOM order and below it in stacking order.

| Route | Wash | Why |
|---|---|---|
| `/onboarding` | yes | |
| `/home` | yes | |
| `/triage` | yes | The conversation (§14) is the screen it matters most on — it is the longest, and the one she is most frightened during. |
| `/outcome` | yes | |
| `/live` | **no** | §7.2, amended. The live view is already a lamp. Two light sources in one hue composite into a mesh, which is the banned AI-aurora (§11), and it breaks §7.3's "the reflection never changes" invariant. |

> **Why not home + live only.** A background that appears on some screens and not others reads as
> a *screen effect* — something the app does — rather than as a *place* the app is in. The whole
> value of the founder's note is the second reading. Continuity is the feature; the single
> exception is the one screen that already has its own light and would fight it.

**Layering.** Exact z-index contract, so nobody has to guess:

| Layer | z-index | Notes |
|---|---|---|
| Wash root | `0` | `position: fixed; inset: 0; pointer-events: none; overflow: hidden; background: var(--bg);` plus `aria-hidden="true"` and `contain: strict` |
| `<main>` content | `1` | `Layout`'s `<main>` gains `position: relative; z-index: 1` — it must not gain a background |
| The 24px `--bg` dock fade (§4.5) | `20` | unchanged |
| `CheckInControl`, docked `EmergencyCall` | `30` | unchanged — **the wash never renders over a docked control** |
| `PushBanner`, `DemoPanel` | `40` / `50` | unchanged |

`<main>` currently has no background and must keep none. Every card keeps its **opaque**
`bg-surface` / `bg-surface-hi` fill — that is what makes §13.4's contrast contract hold for free.
**Do not make any surface translucent to "let the wash through".** That is glassmorphism, banned
in §4.3, and it is the one change that would break the whole readability argument.

### 13.2 New tokens — `tokens.css`

Add to the theme-independent `:root` block, directly after the `--lamp-*` ramp:

```css
  /* Ambient background wash — design-plan.md §13. --------------------------
   * A ramp SEPARATE from --lamp-* on purpose: --lamp-* is bounded artwork
   * inside the two data visualisations and may be strong; --wash-* is the
   * ground the entire product stands on and is bounded by a contrast budget
   * (§13.4). The two must be able to move independently.
   *
   * --wash-rgb and the five alphas are set per theme below, because the wash
   * inverts between themes: at night it is EMITTED LIGHT (the accent,
   * lightening a dark room); in day it is DAYLIGHT ON PAPER (a warm white,
   * still lightening). It never darkens the page in either theme — a
   * full-bleed darkening wash reads as a stain or a dimmed screen, which is
   * the opposite of "induce calm". This is a deliberate departure from
   * --lamp-*, which does darken in day because it is bounded artwork.
   *
   * Not mapped into @theme. Consumed only as var(--wash-N) inside bespoke
   * gradient CSS, exactly like --lamp-*. Do NOT add --color-wash-*.
   *
   * --wash-0 is currently unused by either iteration. It is defined anyway as
   * the reserve step below --wash-1, so that "make it fainter" has a value
   * already on the ramp instead of someone inventing one inline.
   */
  --wash-0: rgb(var(--wash-rgb) / var(--wash-a0));
  --wash-1: rgb(var(--wash-rgb) / var(--wash-a1));
  --wash-2: rgb(var(--wash-rgb) / var(--wash-a2));
  --wash-3: rgb(var(--wash-rgb) / var(--wash-a3));
  --wash-4: rgb(var(--wash-rgb) / var(--wash-a4));

  /* Wash drift periods. Prime and pairwise coprime: the composite of the
   * three takes 53 x 67 x 89 = 316,039s (~88 hours) to repeat, so the field
   * never visibly loops. Same law as §7.3's 23/31/41. */
  --dur-wash-a: 53s;
  --dur-wash-b: 67s;
  --dur-wash-c: 89s;

  /* The silent pause between conversational messages (§14.5). */
  --dur-beat: 700ms;
```

Add to the **night** block:

```css
  --wash-rgb: 232 180 120; /* = --accent-rgb. The lamp, emitting into the room. */
  --wash-a0: 0.02;
  --wash-a1: 0.04;
  --wash-a2: 0.1;
  --wash-a3: 0.14;
  --wash-a4: 0.22;
```

Add to the **day** block:

```css
  /* Warm white, not bronze: in daylight, added light does not darken paper.
   * Alphas run higher than night because white-on-sand is a smaller
   * perceptual delta than amber-on-black, and because lightening an already
   * light background only ever RAISES contrast for dark text (§13.3) — the
   * whole day column is free, so the only day constraint is elevation. */
  --wash-rgb: 255 244 228;
  --wash-a0: 0.03;
  --wash-a1: 0.06;
  --wash-a2: 0.14;
  --wash-a3: 0.2;
  --wash-a4: 0.26; /* at the elevation ceiling, not a taste boundary — see below */
```

No `@theme` additions. No `index.css` changes for §13 except the keyframes in §13.5/§13.6, which
may live in a `<style>` block inside the wash component (the precedent is `LiveSurface.tsx`).

**Day sanity check — elevation must not invert.** Day is free on contrast (§13.3), so its only
constraint is that the washed background must never rise above `--surface` `#f6efe9`, or a card
would stop reading as elevated and §4.3's whole "elevation is value, not shadow" system collapses.

The absolute day peak is iteration A's bottom edge: composite α ≈ **0.35** of `#fff4e4` over
`--bg` `#efe6e1`, which resolves to **`#f5ebe2`** — below `#f6efe9` on all three channels and in
luminance. Iteration B's day peak (α ≈ 0.169) resolves to `#f1e8e2`, comfortably below.

Both pass — but only because `--wash-a4` is `0.26` in day rather than the `0.3` the ramp's shape
would suggest. **`--wash-a4` sits at the elevation ceiling, not at a taste boundary. Do not raise
the day alphas.** If a day card ever stops reading as elevated, the cause is here.

### 13.3 The readability contract — this is the load-bearing part

Anything that goes behind text has to prove it. Here is the proof, once, for both iterations.

The wash composites `--wash-rgb` over `--bg` at some alpha α. Below are the measured WCAG 2.1
contrast ratios of every text pairing the system mandates, against a background washed at α.

**Night is the binding theme, and it is the only one.** This falls out of §13.2's decision that
the wash *lightens* in both themes:

- At **night** the wash lightens a dark ground, so the background moves *towards* the light text
  sitting on it. Every ratio falls as α rises. This is where the budget is spent.
- In **day** the wash lightens an already-light ground, so the background moves *away* from the
  dark text sitting on it. **Every ratio rises as α rises.** Day is free, and that is the payoff
  for inverting the wash rather than reusing `--lamp-*`.

| composite α | night `--text` | night `--text-muted` | night `--accent` as text | day `--text` | day `--text-muted` | day `--accent` as text |
|---|---|---|---|---|---|---|
| 0.00 | 15.38 | 7.93 | 9.53 | 12.60 | 5.34 | 4.94 |
| 0.06 | 13.82 | 7.12 | 8.56 | 12.70 | 5.38 | 4.98 |
| 0.115 *(iteration B peak)* | 12.27 | 6.32 | 7.59 | 12.79 | 5.42 | 5.01 |
| **0.16 — the cap** | **11.06** | **5.70** | **6.86** | 12.86 | 5.45 | 5.04 |
| 0.20 | 10.03 | 5.17 | 6.21 | 12.92 | 5.48 | 5.07 |
| 0.245 | 9.02 | 4.65 | 5.59 | — | — | — |
| 0.27 *(iteration A peak — bottom edge, behind the dock, no text)* | 8.36 | **4.31** ✗ | 5.18 | — | — | — |
| 0.28 | 8.16 | **4.21** ✗ | 5.06 | — | — | — |

*(Night rows composite `--accent` `#e8b478` at the stated α over `#1c1619`. Day rows composite
`#fff4e4` at the stated α over `#efe6e1`. Ratios are sRGB relative luminance, computed exactly as
in §2. The night `--text-muted` column is the one that decides everything: it crosses 4.5:1 at
**α ≈ 0.25**.)*

From which:

> ### THE CAP
> **The wash's composite alpha may not exceed `0.16` anywhere a text-bearing element sits
> directly on `--bg`.** At 0.16 every mandated pairing clears AA in both themes, worst case
> **5.70:1** (night `--text-muted`) — a 27% margin over the 4.5 threshold, which is the room
> needed for a future token adjustment not to silently break the page.
>
> The cap is 0.16 and not 0.24 on purpose. 0.24 is where the arithmetic actually fails; leaving
> no headroom between the spec and the failure point means the first small palette change breaks
> accessibility with nothing to warn you.

Two mechanisms enforce it, and **an implementer never has to judge which applies** — §13.5 and
§13.6 each state exactly where their construction stands relative to 0.16:

1. **Opaque surfaces.** Every card, row, bubble, chip and control has an opaque `--surface` /
   `--surface-hi` / `--accent` fill. Text on those is unaffected by the wash at any α. This
   covers the overwhelming majority of text in the product, and §14 deliberately moves the last
   holdouts (bot messages, quick replies) onto opaque fills for exactly this reason.
2. **Geometry.** Where text *does* sit on bare `--bg` — screen titles, lead sentences,
   `text-caption` metadata such as Home's "Synced 4 minutes ago" — the wash is constructed so its
   composite alpha in that band is ≤ 0.16 by construction, not by tuning.

Two supporting rules:

- **`--accent`-coloured text never sits on bare washed `--bg`.** It always sits inside a filled
  surface. This is already true everywhere in the product (the "Open live view" row is on
  `surface-hi`, "Edit" is inside a review card, §14/§15's controls are inside bubbles and
  composers) and it is now written down, so that a future control cannot quietly become the one
  exception. It is not the pairing with the least headroom — night `--text-muted` is — but it is
  the one most likely to be added carelessly.
- **Never composite the wash *over* content.** No overlay, no `mix-blend-mode`, no
  `backdrop-filter`. The wash is strictly a layer below. `mix-blend-mode` in particular would
  make every ratio above meaningless.

### 13.4 Iteration A — "Hearth"

> **One low light, and the content sits above it.** A single warm pool anchored below the fold,
> drifting on long periods, with the interface arranged in the lit air above it — the way a room
> looks when the only lamp is on the floor.

**Toggle label:** `A: Hearth`

**The line that decides the geometry.** `dock-safe` is `112px` (§4.2 tokens), which on an 844px
viewport is **13.3vh** — so on a fully-scrolled `dock-safe` screen, the last line of text can sit
as low as **y ≈ 87vh**. Not 75vh. Everything below is built around that number:

> **Iteration A's bright forms must reach α = 0 at or above `y = 87vh`.**

**Construction.** Inside the wash root (§13.1), five elements: three drifting forms, and two
static elements behind them. All are `<div>`s with CSS gradient backgrounds — no SVG, no canvas.

Every drifting form is:

```css
position: absolute;
border-radius: 50%;
transform: translate(-50%, -50%);   /* baked into every keyframe, see §13.5 */
background: radial-gradient(closest-side, <fill>, transparent 62%);
will-change: transform;
```

The `transparent 62%` stop is load-bearing, not a taste call: it makes each form's alpha reach
**exactly zero** at 62% of its own radius, which is what turns the argument below into arithmetic
instead of eyeballing. **Do not change it to `transparent` (100%)** — that would push every
form's falloff 38% further up the screen and break the 87vh line.

| # | Size (vw × vh) | Centre (x / y of viewport) | Fill | Blur | Period |
|---|---|---|---|---|---|
| **H1** | 150 × 48 | 46% / **107%** | `var(--wash-4)` | `56px` | `var(--dur-wash-a)` — 53s |
| **H2** | 96 × 36 | 68% / **102%** | `var(--wash-3)` | `40px` | `var(--dur-wash-b)` — 67s |
| **H3** | 62 × 24 | 30% / **107%** | `var(--wash-2)` | `28px` | `var(--dur-wash-c)` — 89s |

All three centres sit **below the bottom edge of the viewport**. Only the upper falloff of each is
ever visible. That is what makes the light read as coming from somewhere off-screen and low,
rather than as three blobs parked at the bottom of a phone.

Behind them, two **static** elements — no blur, no animation, `position: absolute; inset: 0`:

```css
/* S1 — the floor pool, directly under the drifting forms. */
background: radial-gradient(120% 46% at 50% 116%, var(--wash-1), transparent 74%);

/* S2 — a wide, very low lift across the whole lower half, so the pool has
   somewhere to fade into instead of ending. Deliberately weak enough to be
   legal anywhere on screen (see the table below). */
background: linear-gradient(to top, var(--wash-1), transparent 42%);
```

S2 is what stops the three forms reading as separate blobs, and it is the only part of iteration A
that reaches above 87vh at all.

**Why these numbers.** H1 is wider than the viewport (150vw) so its horizontal falloff never
enters frame — the light comes from *below*, not from a spot. The three centres are offset
horizontally (46% / 68% / 30%) and vertically (107 / 102 / 107vh) so the composite is asymmetric;
a symmetric bloom reads as a vignette, which is a photographic effect, not a lamp. H2 is the
shallowest and the highest, which puts the brightest point slightly right of centre and off the
midline.

**Where each element reaches zero.** With `transparent 62%`, a form reaches α = 0 at a vertical
distance of `0.62 × half-height` from its centre. Worst case adds the upward drift translate and
the `scale()` from §13.5:

| Element | half-height | centre | α = 0 at | worst case (drift + scale) | margin over 87vh |
|---|---|---|---|---|---|
| H1 | 24vh | 107vh | y = 92.1vh | y = **90.5vh** ✓ | 3.5vh |
| H2 | 18vh | 102vh | y = 90.8vh | y = **90.3vh** ✓ | 3.3vh |
| H3 | 12vh | 107vh | y = 99.6vh | y = 99.3vh ✓ | 12.3vh |
| S1 | 46vh | 116vh | y = 82.0vh | — (static) | reaches above, but see below |
| S2 | — | — | y = 58.0vh | — (static) | reaches above, but see below |

**Iteration A therefore has two zones, and this is the whole safety argument:**

> **At `y = 87vh` — the lowest any text can be — the composite alpha is `0.034`.** H1, H2 and H3
> contribute **exactly zero** there, with 3.3vh to spare on the tightest of them. Only S1 (0.006)
> and S2 (0.028) reach that high, and both were sized so that they can: their combined 0.034 is
> **five times inside the 0.16 cap** (§13.3), which puts night `--text-muted` at better than
> **7.5:1** at the worst pixel on the worst-case screen.
>
> **Any text may sit anywhere `dock-safe` permits.** No screen needs a special case, no component
> needs a readability scrim, and no implementer has to think about it.
>
> **Below 87vh the composite climbs to ≈ 0.27 at the very bottom edge.** Over the cap,
> deliberately — that is the visible pool, and it is the only part of iteration A anyone will
> point at. Nothing text-bearing is there: `dock-safe` reserves it on every scrolling screen,
> `/triage` reserves 268px ≈ 32vh, and what does sit there is the docked control — an opaque
> `bg-accent` / `bg-surface` pill, unaffected by anything behind it.

**If you change any number in the geometry table, recompute the 87vh row.** It is the only
number in §13 that a careless edit can silently break, because the failure is a contrast
regression on a screen nobody thought to scroll to the bottom of.

**Does it get cut off by the dock?** No, and this is the nice part: the dock's 24px `--bg` fade
(§4.5) sits at z-20 with the wash at z-0, so the pool dissolves *into* `--bg` right where the
control floats. The control appears to sit on the lit floor. Do not extend the fade to hide it.

### 13.5 Iteration A — motion

Three keyframe sets, one per form. **`transform` only** — nothing animates layout, colour,
filter, or box-shadow. `filter: blur()` is set once, statically, and never animated.

```css
@keyframes kindred-wash-h1 {
  0%   { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
  50%  { transform: translate(-50%, -50%) translate(10px, -6px) scale(1.06); }
  100% { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
}
@keyframes kindred-wash-h2 {
  0%   { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
  50%  { transform: translate(-50%, -50%) translate(-8px, 5px)  scale(1.05); }
  100% { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
}
@keyframes kindred-wash-h3 {
  0%   { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
  50%  { transform: translate(-50%, -50%) translate(6px,  4px)  scale(1.04); }
  100% { transform: translate(-50%, -50%) translate(0px,  0px)  scale(1);    }
}
```

Applied as `animation: kindred-wash-h1 var(--dur-wash-a) var(--ease-breathe) infinite;` (and
`-b` / `-c` for H2 / H3).

- **Easing is `var(--ease-breathe)` on all three**, never `linear`. Linear drift reads as a
  scanning machine; sinusoidal reads as breathing.
- **H1's `-6px` is the only upward drift in iteration A**, and it is the term §13.4's worst-case
  row accounts for. H2's `+5px` and H3's `+4px` move *down*, away from the text line. **Do not
  flip a sign** — making H2 or H3 drift upward invalidates the 87vh argument without changing
  anything you can see.
- **Displacements are tiny** (4–10px against forms 400–580px across). The perceived motion comes
  from the *scale* term and from the three forms sliding out of phase with each other, not from
  anything travelling. If you can watch an edge move, it is too fast.
- **Periods 53 / 67 / 89s are prime and pairwise coprime.** Composite repeat ≈ 88 hours. Same law
  as §7.3. Do not round them to 50 / 70 / 90.
- **No opacity animation, no hue animation, no filter animation, no rotation.** A rotating blur
  is the AI-aurora tell.
- No `animation-delay` is needed — the periods do the decorrelating.

**Reduced motion.** Branch in JS with the existing `usePrefersReducedMotion()` hook
(`src/components/usePrefersReducedMotion.ts`) and set `animation: 'none'` on all three forms.
They render at their 0% position — identical geometry, identical colour, identical alphas,
completely still. Do not rely on the global 0.01ms collapse in `index.css`: it would snap the
forms to their 100% keyframe, which happens to be the same position here, but relying on that is
an accident waiting to be broken by a keyframe edit. §5.1 mandates the JS branch for ambient
views; this is one.

### 13.6 Iteration B — "Room breath"

> **No visible source. The whole field is faintly, unevenly warm, and it moves.** You should not
> be able to say where the light is, or — for the first few seconds — that there is any.

**Toggle label:** `B: Room breath`

**Construction.** Three forms, no static base, **all at `var(--wash-1)`**. Each is larger than
the viewport, so no edge is ever visible and the field has no shape of its own; what you perceive
is the slow interference between them.

```css
position: absolute;
border-radius: 50%;
transform: translate(-50%, -50%);
background: radial-gradient(closest-side, var(--wash-1), transparent);
will-change: transform;
```

Note: `transparent` (100%), **not** `transparent 62%` — B wants soft, edgeless falloff across the
whole frame, and it can afford it because its alpha budget is fixed by the token, not by geometry.

| # | Size (vw × vh) | Centre | Blur | Period |
|---|---|---|---|---|
| **R1** | 170 × 120 | 28% / 22% | `72px` | `var(--dur-wash-a)` — 53s |
| **R2** | 140 × 150 | 82% / 58% | `72px` | `var(--dur-wash-b)` — 67s |
| **R3** | 190 × 110 | 50% / 95% | `72px` | `var(--dur-wash-c)` — 89s |

**Where it crosses the cap (§13.3).** It does not — anywhere, at any instant, at maximum overlap.
B needs no geometry argument at all, and that is precisely its virtue:

> Three fully overlapping layers at night α 0.04 composite to `1 − 0.96³ = 0.1153`.
> **Under the 0.16 cap, with margin, everywhere on screen.**
>
> Day's three at 0.06 composite to `1 − 0.94³ = 0.1694`, which is *above* the numeric cap — and
> harmless, because in day the wash lightens a light ground and **every day ratio rises with α**
> (§13.3). The cap is a night constraint; the day figure is recorded here only so nobody
> "corrects" it later.
>
> **Therefore: any text may sit anywhere on iteration B, at any scroll position, in either
> theme.** Worst case is night `--text-muted` at **6.32:1**; day is better than unwashed
> everywhere.
>
> Day elevation check: 0.169 of `#fff4e4` over `#efe6e1` resolves to `#f1e8e2`, still clearly
> below `--surface` `#f6efe9`, so cards keep reading as elevated.

**Do not add a fourth form.** Four at night 0.04 lands at `1 − 0.96⁴ = 0.1507` — technically
inside the cap, with essentially nothing left. **Do not promote a form to `--wash-2`**
(`1 − 0.90·0.96² = 0.1706`, over). If B looks too subtle on the projector, **the answer is longer
travel and larger forms, not more alpha** — B's perceptibility is a motion property, not a
brightness one, and trading the one for the other turns it into a worse copy of A.

**Motion.** Same keyframe shape as §13.5, same easings, same periods — but B's forms travel
**much further**, because that is where all of its perceptible life comes from:

```css
@keyframes kindred-wash-r1 {
  0%   { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
  50%  { transform: translate(-50%, -50%) translate(-46px, 34px) scale(1.10); }
  100% { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
}
@keyframes kindred-wash-r2 {
  0%   { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
  50%  { transform: translate(-50%, -50%) translate(38px, -42px) scale(1.08); }
  100% { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
}
@keyframes kindred-wash-r3 {
  0%   { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
  50%  { transform: translate(-50%, -50%) translate(-30px, -26px) scale(1.12); }
  100% { transform: translate(-50%, -50%) translate(0px,   0px)  scale(1);    }
}
```

30–46px over 53–89s is roughly **0.7px per second**. Below the threshold at which motion is
consciously tracked, above the threshold at which a still image and a moving one feel different.
That is the entire design of B.

**Reduced motion.** Identical treatment to §13.5: JS branch, `animation: 'none'`, forms render
static at their 0% positions. Because B has no bottom-anchored structure, the static version is
still a warm uneven field — B degrades better than A does.

### 13.7 Whether the background acknowledges live movement

**It does not, and I recommend shipping it that way.**

§7.7 is the most carefully-argued rule in this document, and its core is: *the ambient light never
responds to the data.* A background that brightens when the baby moves has, by construction, a
dimmer state when the baby does not — and a room that goes dim at 4am while she is watching it is
the single most harmful thing this product could render. It is also, precisely, a monitor.

**However**, the founder asked for it to be evaluated, so it is specified — **off by default,
behind its own demo-panel toggle**, and built the only way I would allow:

> **The field changes shape, never brightness.**

- On a `moved: true` sample, and only iteration A, and only while the wash is mounted: write a
  CSS custom property `--h3-nudge` onto **H3 only** (the smallest, dimmest form), with a value
  deterministically derived from the sample timestamp in the range **±10px**, and let H3's
  keyframes read `translate(calc(6px + var(--h3-nudge, 0px)), 4px)` at their 50% stop.
- Transition it over `2700ms` (`--dur-settle` × 3) with `var(--ease-breathe)`.
- Cap the accumulated nudge at ±10px absolute. It does not integrate; each sample replaces the
  previous value.
- **`moved: false` does nothing.** No state change, no reset, no decay timer. Same rule as §7.4.
- **Nothing dims, ever.** When samples stop arriving, H3 simply keeps drifting from wherever it
  is. There is no quiet state to notice, because there is no state.

Why this is defensible where brightness is not: **brightness is ordinal and phase is not.** More
light plausibly means more movement, so a brightening field is a reading. Two positions of a
blurred form 62vw across cannot be ranked, compared, or counted — there is nothing for her to
conclude. And with no dimming and no decay, absence produces no signal at all.

**Demo toggle label:** `Background reacts to movement` — a two-state row, **default off**.
State: `ambientReactsToMovement: boolean` in `AppStateContext`; `resetState()` sets it `false`.

### 13.8 Demo panel — the background section

New section in `src/components/DemoPanel.tsx`, placed directly above "Seeded activity data":

- Heading: `Ambient background`
- Three mutually exclusive options, styled exactly like the existing quiet/active pair
  (`min-h-14 flex-1 rounded-lg`, selected = `bg-accent text-bg`, unselected = `bg-surface-hi`),
  with `aria-pressed`:
  - `Off`
  - `A: Hearth`
  - `B: Room breath`
- Below them, the §13.7 row: `Background reacts to movement`, same styling, `aria-pressed`,
  **default off**. Disabled and visually at `opacity-55` when the selection is `Off` or
  `B: Room breath` (the behaviour is A-only).

State in `AppStateContext`:

```ts
export type AmbientBackground = 'off' | 'hearth' | 'room';

ambientBackground: AmbientBackground;
setAmbientBackground: (value: AmbientBackground) => void;
ambientReactsToMovement: boolean;
setAmbientReactsToMovement: (value: boolean) => void;
```

Initial value and `resetState()` value: **`'hearth'`** and **`false`**. Switching between A and B
must be instant — unmount one component, mount the other. No cross-fade: a cross-fade between two
ambient fields is a third ambient field, and the founder is trying to compare two.

### 13.9 Performance

Four (A) or three (B) GPU-composited layers, animating `transform` only, on a `contain: strict`
fixed root. Cheap. But:

- **`filter: blur()` is set once and never animated.** Animating a blur radius re-rasterises every
  frame and will drop frames on the demo laptop.
- **No `backdrop-filter` anywhere.** Banned by §4.3 and it is the single most expensive property
  available.
- `will-change: transform` on the drifting forms only, never on the root.
- The wash root must not be re-rendered by React on route change. Mount it once in `Layout`,
  outside anything keyed by pathname, and let it persist across navigations — that continuity *is*
  the point (§13.1).

---

## 14. The conversational check-in

*(amended — held-build-brief.md's amended `placeholder_content`)* The founder's build brief was
amended after this section was first written: the red-flag questionnaire is now six *categories*
(Bleeding, Fluid, Pain, Collapse/seizure/trauma, Vomiting, Movement — see the ordering note below),
each a gate question plus follow-ups that only appear once the gate is answered yes, mixed input
types (yes/no, select, multiselect, number, text), and a hard-stop interrupt. **This section is
updated in place to describe that**, rather than left describing a flat six-question set that no
longer exists in `src/data/clinicalContent.ts`. The gate decision behind doing this as an amendment
rather than a rebuild: the conversation's underlying idioms — `Beat`'s delayed reveal, the
monotonic "how far has this been unlocked" high-water mark, a chip row that fades and hands its
value to her bubble, a detail beat gated on "does this answer need more" — all generalise from "one
flat question" to "one category, which may itself contain several follow-ups" without contradicting
any of their original assumptions. Nothing below this paragraph describes a rebuild; it describes
the same conversation, carrying more.

The mood board's chat screens (Cleo AI, pillowtalk) are doing something the current triage flow
is not: **they make answering feel like being asked, rather than like filling something in.**
Cleo in particular is the structural reference — quick-reply chips sitting above a persistent
composer, with the whole exchange scrolling as one surface.

**What changes: the feel. What does not change: anything that decides anything.**

- Category and follow-up text stays **verbatim** from `redFlagCategories` in
  `src/data/clinicalContent.ts` *(amended — was `redFlagQuestions`)*.
- The gate answer still drives everything. `disposition()` and the new `getEscalationTier()`
  (`src/logic/escalationTier.ts`) read only gate answers and two named Bleeding follow-ups — see
  §14.10 for the no-downgrade guarantee this gives structurally, not just by discipline.
- The flow stays deterministic and offline. **No model, no network, no randomness, no streaming.**
- The emergency call control stays docked, in the same rectangle, on every beat of the flow.
- The review step stays a structured screen (§14.8), now one card per **category** rather than per
  question. **A transcript is not a safe review.**

### 14.1 Shape

`/triage` keeps one route and internal step state. Phases (a) and (b) merge into **one continuous
conversation**; phase (c) stays separate — except when a hard stop fires, in which case phase (c)
is skipped entirely (§14.10).

*(amended)* **Category walking order is not the brief's listing order.** The brief lists the six
categories as Bleeding, Fluid, Movement, Vomiting, Pain, Collapse. This section's conversation asks
them as **Bleeding, Fluid, Pain, Collapse, Vomiting, Movement** instead — every category's own
content (gate question, follow-ups, options) is verbatim from the brief; only the walking order
changed, for two structural reasons documented in full in `src/data/clinicalContent.ts`'s header
comment: (1) the cross-category overlap rule (§14.11) needs Bleeding and Fluid asked before Pain,
and Pain asked before Vomiting, or the overlap it names is unsatisfiable by construction; (2) the
hard stop is meant to interrupt "wherever it falls in the sequence" (placeholder_content) — putting
Collapse last would mean it never actually has anything left to skip, which defeats its own point
on stage and in the UI test (§14.10).

```
[ header: back caret · progress rail ]

  bot   A few short questions, then you can add anything in your own words.
  bot   Are you bleeding?
                                                    [ Yes ] [ No ]   <- chips
  her                                                          Yes
  bot   How much?
                                    [ Spotting ] [ Like a period ]
                          [ Heavier than a period ] [ Soaking a pad within an hour ]  <- select, §14.4
  her                                          Heavier than a period
  bot   How long?
        [ composer: textarea · Send ]                                <- text follow-up, §14.4
  her                                          (her words)
  bot   Any clots or tissue?
                                                    [ Yes ] [ No ]
  her                                                          No
  bot   Any pain or dizziness?
                                                    [ Yes ] [ No ]
  her                                                          Yes
  bot   Anything you want to add about that?
        Type it, or record a voice note. This is optional.
        [ composer: textarea · mic · Send · Skip this ]              <- §15, once per category,
                                                                          after its follow-ups
  her                                              (her words / voice note)
  bot   Thank you. Here is the next one.
  bot   Any gush or leaking fluid?
  ...                                                       <- Fluid, then Pain, then Collapse, ...
  bot   Any seizure, fainting, collapse, or head injury?
                                                    [ Yes ] [ No ]
  her                                                          Yes
                                              <- HARD STOP (§14.10): submits and navigates to the
                                                 emergency outcome immediately. Nothing below this
                                                 line renders — no more categories, no closing beat,
                                                 no review.
  ...
  bot   Those are the questions. Anything else your clinic should know,
        in your own words?
        [ composer ]
  bot   Thank you. You can look everything over before you send it.
        [ Continue to review ]

[ docked: EmergencyCall + 999 note — fixed, never moves ]
```

Component: `src/screens/triage/CheckInConversation.tsx`, rendered by `TriageFlow` for every step
before review. `RedFlagStep.tsx` and `TriageChat.tsx` are **replaced** by it — do not keep both
paths alive. *(amended)* Follow-up rendering for a yes-gated category is data-driven off
`RedFlagCategory.followUps` via a new `src/screens/triage/FollowUpInput.tsx`, which switches on
each follow-up's `type` (`yesno` | `select` | `multiselect` | `number` | `text`) — see §14.4.

### 14.2 The bot voice

Governed by §10 as amended. Restated here because this is where it will be broken:

- **No first person.** Not "I", "I'll", "we", "our". §10.
- Never evaluative. Never cheery. No exclamation marks, no emoji, no Title Case.
- No verdict words, no reassurance, no "don't worry", no "well done", no "great".
- One idea per message. If a message needs a semicolon, it is two messages.
- Never reacts to *content*. Acknowledgements are structural ("here is the next one"), never
  responsive ("that sounds difficult"). Safeguarding stays invisible (build brief rule 5): the
  interface must behave identically whatever she writes.
- No avatars, no name label, no "Kindred is typing".

**New constants for `src/data/clinicalContent.ts`** — add a section under the existing
patient-facing clinical copy block. These are the *only* conversational strings; nothing else may
be written in a component.

```ts
// ---------------------------------------------------------------------------
// Conversational check-in framing (design-plan.md §14.2). Patient-facing, so
// it lives here with the rest of the clinical copy — never in a component.
//
// Voice rules these obey (design-plan.md §10, §14.2): second person only, no
// first person anywhere, sentence case, no exclamation marks, never
// evaluative, never responsive to what she wrote. Structural only.
// ---------------------------------------------------------------------------

/** Opens the conversation, before the first category's gate question.
 * (amended — was "Six short questions...": a category can expand into
 * several follow-ups once its gate is answered yes, so promising a fixed
 * count of six would be broken the first time she answers one yes.) */
export const CHECK_IN_OPENING =
  'A few short questions, then you can add anything in your own words.';

/** The one acknowledgement inside the category run. Appears exactly once,
 * after the first category resolves, so she learns the rhythm — not after
 * every category, which would become identical lines of noise. */
export const CHECK_IN_FIRST_ACK = 'Thank you. Here is the next one.';

/** Opens the auto-detail beat after a category's gate is answered yes and
 * its follow-ups are complete (design-plan.md §15, amended — generalised
 * from "per question" to "per category"). */
export const CHECK_IN_DETAIL_INVITE = 'Anything you want to add about that?';

/** Rendered as a caption directly beneath CHECK_IN_DETAIL_INVITE, inside the
 * same bubble. The only place voice notes are introduced. */
export const CHECK_IN_DETAIL_HINT =
  'Type it, or record a voice note. This is optional.';

/** Opens the closing free-text beat, after the last category. */
export const CHECK_IN_CLOSING_INVITE =
  'Those are the questions. Anything else your clinic should know, in your own words?';

/** Closes the conversation, whether she wrote something or skipped. Only
 * shown when review is still ahead of her — see CHECK_IN_HARD_STOP_CLOSING_ACK
 * below for the hard-stop path, where it is not. */
export const CHECK_IN_CLOSING_ACK =
  'Thank you. You can look everything over before you send it.';

/** Shown inline, quietly, only when she asked to record and the browser
 * refused or has no microphone. Never a dialog, never a toast, never a retry
 * button (design-plan.md §15.5). */
export const CHECK_IN_MIC_UNAVAILABLE =
  'Voice notes are not available on this device. You can type instead.';
```

*(amended — see §14.10)* Three more constants exist for the hard-stop path, where there is no
review to send her to: `EMERGENCY_ADD_MORE_LABEL` (the quiet link on the emergency outcome screen),
`CHECK_IN_HARD_STOP_CLOSING_ACK` (replaces `CHECK_IN_CLOSING_ACK` on that path — it does not promise
a review screen that will not appear), and `CHECK_IN_RETURN_TO_EMERGENCY_LABEL` (replaces "Continue
to review" on that path).

`CHECK_IN_CLOSING_ACK` is the current `TriageChat` `CLOSING` string, moved verbatim — it was
already right. The old `PROMPT_1` and `ACK_1` are superseded by `CHECK_IN_CLOSING_INVITE` and
`CHECK_IN_FIRST_ACK`; delete them with the component.

### 14.3 Header and the progress rail

The mood board shows a thin top progress bar three times (Alan, Future, Calm Sleep). Adopted,
adapted, and de-gamified.

**Header**, `pt-8` below the safe area, `px-6`, inside the `--content-max` column:

- **Back caret**, left, unchanged: `tap -ml-4`, `CaretLeft` Light 24px, `text-text-muted`,
  `aria-label="Back"`. Behaviour in §14.7.
- **The progress rail**, occupying the remaining width, vertically centred against the caret,
  with 16px between them. **This replaces the six dots.**

*(amended — held-build-brief.md placeholder_content)* The rail now tracks **categories**, not raw
question count — "progress indicator reflects categories, not raw question count" is the brief's
own words. One category with three follow-ups still counts as one step, the same as a category
with none; a category counts as answered once its gate has an answer, independent of whether its
follow-ups or detail beat are still in progress (so answering a gate advances the rail immediately,
rather than her watching it stall while she works through follow-ups).

```
track:  height 3px · rounded-pill · bg-line · width 100% of the remaining row
fill:   height 3px · rounded-pill · bg-accent
        width: (answeredCount / redFlagCategories.length) * 100%
        transition: width var(--dur-enter) var(--ease-soft)
```

- `role="progressbar"`, `aria-valuemin={0}`, `aria-valuemax={redFlagCategories.length}`,
  `aria-valuenow={answeredCount}`, `aria-label="Check-in progress"`.
- **No numeral.** No "3 of 6", no percentage, no label. §10: numbers only where they are facts she
  asked for.
- **No gradient**, no glow, no rounded cap animation, no shimmer, no colour change at 100%.
- **It never moves on its own** — only when `answeredCount` changes. See §5 as amended: this is
  the one determinate indicator the system permits, and that property is what makes it legal.
- It **can go down**, when she changes an earlier answer (§14.7). That is correct and must not be
  special-cased; the transcript above it is unchanged, so nothing is lost.
- Hidden entirely once the last category is answered — during the closing beat and review there is
  nothing left to indicate. Render the row with the caret alone; **do not** leave a full rail
  sitting at 100%, which is a reward state. On the hard-stop path it never gets the chance to reach
  100% at all — see §14.10.

`<h1 className="sr-only">Check in</h1>` immediately after the header, so the screen has an
accessible name. The conversation itself is an `aria-live="polite"` region (§14.9).

### 14.4 Bubbles and chips

The conversation is a `flex flex-col gap-4` column inside the standard `px-6` /
`max-w-[var(--content-max)]` frame, `pt-8`.

**Bubbles.** Both sides get an opaque fill. This is deliberate: it is what makes §13.3's
readability contract hold on this screen for free, and it is also simply better — bare text on
bg for the bot (the current `TriageChat` behaviour) reads as UI copy, not as something said.

| | Bot | Her |
|---|---|---|
| Alignment | `mr-auto` (left) | `ml-auto` (right) |
| Max width | `85%` | `85%` |
| Fill | `bg-surface` | `bg-surface-hi` |
| Text colour | `text-text` | `text-text` |
| Type role | `text-body` — **every bot bubble, question or otherwise** *(amended)* | `text-body` |
| Padding | `16px` *(amended — was `24px` for a `text-lead` question bubble)* | `16px` |
| Radius | `var(--r-card) var(--r-card) var(--r-card) var(--r-chip)` | `var(--r-card) var(--r-card) var(--r-chip) var(--r-card)` |
| Border | none | none |
| Shadow | none | none |

The asymmetric corner (22 / 22 / 22 / 14) is the only piece of chat grammar retained. **No tails,
no pointers, no avatars, no names, no timestamps, no read receipts.** A tail is cute, and §10's
ban on cuteness applies to form as well as words.

*(amended — founder request: consistent chat font size)* **Gate and follow-up questions no longer
render at `text-lead`.** They previously did — the paragraph below is kept, struck through in
spirit, to record why the founder asked for it to change rather than deleting the reasoning
outright: a category's gate question sitting at 23px while its own follow-ups (asked moments later,
in the same conversation) sit at 19px read as two different type ROLES doing one job — asking her
something — and the founder's ask was one type role for all of it. Every bot bubble, her bubble,
and question now renders at `text-body` (19px), with `16px` padding throughout. Chips and captions
(`text-label`, `text-caption`) keep their existing roles — this only touches the sentences
themselves.

~~The question at `text-lead` (23px) is the mood board's "big friendly type" note, honestly
translated: the question is the largest thing on the screen, it needs no illustration beside it,
and 23px inside a 24px-padded bubble at 85% of a 420px column holds ~28 characters per line —
inside §3.3's measure rule.~~

**Quick-reply chips.** A right-aligned row directly beneath the current gate/follow-up question
bubble, `gap-3`.

```
tap · rounded-pill · px-6 · bg-surface-hi · text-text · text-label · border border-line
min-height 56px  (the `tap` utility — she may be shaking)
```

- For a `yesno` gate or follow-up: exactly two, always, **"Yes"** and **"No"**, in that order. No
  "not sure" — `disposition()` and `getEscalationTier()` read gate answers as binary, and offering a
  third answer that the logic discards would be a lie.
- **No tick glyph, in any state.** §6.1 as amended: selection is expressed by the answer becoming
  her own message, so there is nothing for a tick to mark.
- Press feedback: opacity `0.82` over `--dur-press`. No scale, no ripple, no colour change.
- On press, the whole chip row unmounts (opacity → 0 over `--dur-press`, **no movement**) and her
  bubble mounts in its place.
- The chip row is never disabled, never greyed, never shows a "selected" state — it does not
  survive being answered.

*(amended — held-build-brief.md placeholder_content: "mixed input types")* The chip grammar above
was written for a binary yes/no set and now has to answer for four more shapes. Rather than invent
a second grammar, each generalises the same one as narrowly as it can:

- **`select`** (e.g. Bleeding's "How much?"): the identical chip row, just with the follow-up's own
  option labels instead of "Yes"/"No" — one tap is still a complete answer, the row still fades and
  hands its value to her bubble exactly as above. Wraps onto a second line (`flex-wrap`) rather than
  compressing four options onto one.
- **`multiselect`** (e.g. Pain's "Any bleeding, fluid, contractions, or urinary symptoms?"): the one
  genuine exception to "never shows a selected state" above. A single tap can no longer be read as a
  complete answer, so a chip toggles (a 2px `border-accent` on the selected chip — still no tick
  glyph, a border is not one) and an explicit **"Continue"** pill commits the set, including empty —
  an empty selection is a legitimate, non-demanding answer, not something to block on.
- **`number`** (e.g. Vomiting's "How many times?"): an inline `input[type=number]` beside a compact
  Send control, not a chip row — there is no finite option set to offer as chips. Send stays
  disabled until a value is entered; there is no honest "blank" number to record.
- **`text`** (e.g. Bleeding's "How long?"): the same composer shape as §15.2's detail beat —
  textarea plus Send — but without the mic, the voice note, or a Skip control. It can be sent empty,
  which is the non-demanding equivalent of skipping.
- None of the four new input widgets is docked. Like the detail beat (§14.6), they scroll with the
  conversation; the dock belongs to the emergency control alone.

### 14.5 Timing — what happens between messages

**Nothing happens between messages. That is the specification.**

No typing indicator. No animated dots. No "Kindred is typing". No placeholder bubble, no skeleton,
no shimmer, no reserved space. The gap is empty and then a message is there.

| Event | Delay before it mounts | Entrance |
|---|---|---|
| A bot message | `--dur-beat` (**700ms**) after the previous element settled | opacity 0 → 1 and `translateY(6px) → 0`, over `--dur-enter` (420ms), `var(--ease-soft)` |
| A chip row | **220ms** after its bot message finished entering | same |
| Her bubble | **0ms** — immediately on press | same |
| The detail beat's bot bubble (§15) | `--dur-beat` after her bubble | same |
| A composer | **220ms** after its bot message finished entering | same |

- `--dur-beat: 700ms` is added to `tokens.css` (§13.2). Mirror it as `const BEAT_MS = 700;` in the
  component with a comment pointing at the token — the same pattern `LiveSurface.tsx` already uses
  for `DUR_SETTLE_MS`.
- The 220ms chip delay exists so her eye reaches the question before the answer appears. It is not
  a stagger; there is exactly one of them, and §5's ban on staggered cascades stands.
- **`translateY(6px)` is the entire movement budget for this screen.** Nothing slides in from the
  side, nothing scales, nothing overshoots, nothing bounces. `var(--ease-soft)` has no overshoot
  by construction (§5) — do not substitute a spring.
- Messages never re-animate. Once mounted, an element is static until it is removed.

**Reduced motion.** The 700ms beat is **kept** — it is a pause, not an animation, and a pause is
calming rather than vestibular. Only the entrances change: elements appear at full opacity with no
transition and no translate. Branch with `usePrefersReducedMotion()`; do not rely on the global
0.01ms collapse, which would produce a flash.

### 14.6 Scrolling, and how it coexists with the docked control

**The page scrolls. The conversation is not an inner scroll container.** Document scroll, one
column, `padding-bottom: calc(268px + env(safe-area-inset-bottom, 0px))` — the existing
`CONTENT_BOTTOM_PADDING` from `TriageFlow.tsx`, unchanged. That value already clears the two-
control emergency stack plus its fade at every step.

**The docked `EmergencyCall` is untouched.** Fixed, z-30, same rectangle, same position, on every
beat of the conversation. It does not move, hide on scroll, shrink, fade, or gain a compact
variant. The conversation scrolls *beneath* it and dissolves into the 24px `--bg` fade above it
(§4.5). Safety rule 3 — this is not negotiable and it is why the composer is inline (§15.2)
rather than docked: **there is one dock and the emergency control owns it.**

**Auto-scroll.**

- After any element mounts, scroll so that the **new element's bottom edge sits 24px above the top
  of the docked emergency stack**.
- `window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })`. Explicitly pass `'auto'`
  under reduced motion — the global baseline forces `scroll-behavior: auto` in CSS but does not
  affect the `behavior` option passed to `scrollTo`.
- **Never scroll while she is reading.** If she has scrolled more than **48px** up from the
  bottom, suppress auto-scroll entirely until she returns to within 48px of the bottom. Yanking
  the view away from someone re-reading an earlier answer at 3am is the worst thing this screen
  can do. Track it with a scroll listener; no library.
- Never scroll horizontally. Never accelerate the scroll. No scroll-linked animation of any kind
  (§5 bans parallax).

**Keyboard.** When the composer's textarea is focused, iOS moves the visual viewport and the fixed
dock will appear to sit above the keyboard. Accept that. **Do not chase the keyboard with
`100dvh`, `visualViewport` listeners, or a repositioned dock** — a docked control that moves is
worse than one that is temporarily obscured by the keyboard she opened herself. Do not auto-focus
the textarea (§15.2).

### 14.7 Going back and changing an answer

Three ways, all of which must exist.

*(amended — edit granularity)* Everything below was written for one flat question per answer. With
categories, the scope decision is: **editing operates at category-gate and at follow-up
granularity, but not at a finer grain than that.** "Change this" exists on a category's gate bubble
and, independently, on each of its answered follow-ups — but there is no partial re-walk of "just
the third follow-up's wording without touching the fourth." This is a documented scope reduction,
not an oversight: it keeps the review screen's one-card-per-category shape (§14.8) and the
in-conversation edit mechanic mutually consistent, at the cost of not being able to correct one
follow-up in isolation from the gate that governs it without also being able to leave the follow-up
alone if she reconfirms the same gate value (see the "no actual change" case below).

**1. Header back caret** — one step back in the conversation.

- If nothing is answered yet: exits the flow (existing `exitFlow()` — clears entry path, alert,
  answers, description, navigates to `/home`). Unchanged.
- Otherwise: pops the most recently answered **category** back to fully unanswered — its gate,
  follow-ups, detail text, and voice note included — and re-presents that category's gate chip row.
  *(amended)* This is category granularity, not per-follow-up: pressing back mid-way through a
  category's follow-ups re-asks that category's gate from scratch, rather than undoing one
  follow-up at a time. The transcript above the popped category is untouched.
- The rail (§14.3) drops by one and comes back when she answers. Correct, not a bug.

**2. "Change this" on any of her bubbles** — the important one.

Beneath every one of her *answer* bubbles (a category's gate answer, or an individual follow-up
answer), right-aligned, 8px below, a `tap` control: `text-caption text-accent`, label **"Change
this"**, `aria-label="Change your answer to: {question}"`.

Pressing it **re-asks that one gate or follow-up in place**:

- Her bubble is replaced, in position, by the matching chip row / input. Everything after it stays
  exactly where it is — **the transcript is not truncated**.
- Answering re-inserts her bubble in the same position and the conversation continues from
  wherever it already was. She does not re-walk the flow.
- This is safe because `disposition()` and `getEscalationTier()` evaluate answers as a **set**, not
  a sequence (`answers.some(...)` in `src/logic/disposition.ts`) — order carries no meaning, so
  editing one in place cannot change how any other is interpreted.

Rules for what happens to attached content when a **gate** answer changes (amended for categories —
follow-up edits never touch this, they only ever replace their own single value):

- Re-confirming the **same** gate value she already gave → nothing changes structurally: her
  follow-ups, detail text, and voice note stay exactly as they were. Only the reask itself resolves.
- Gate flips **no → yes** → a fresh follow-up sequence opens (there was nothing to preserve — a
  'no' category structurally has no follow-ups), and the detail beat (§15) opens once they complete,
  exactly as it would have the first time.
- Gate flips **yes → no** → follow-up answers are cleared (a 'no' category cannot carry follow-ups —
  the schema's own rendering rule), but **any detail text or voice note she already gave is
  preserved**, exactly as it was. **Never delete something she said because she changed a
  checkbox.** Build brief rule 5 (safeguarding travels silently) and rule 2 (her perception wins)
  both depend on this — it is the one place this rework kept the letter of the original rule despite
  the schema underneath it changing shape.

**3. "Edit" from the review screen** — returns to the conversation, scrolls to that category's gate
bubble, and puts it into the same in-place re-ask state. Keeps the existing `jumpTo` /
`returnToReview` mechanic in `TriageFlow.tsx`: after answering, she goes straight back to review.
*(amended)* Review only ever edits a category's **gate** — there is no per-follow-up "Edit" from
review, matching its one-card-per-category shape (§14.8).

### 14.8 The review step stays structured — and here is why

**Do not turn the review into a transcript.** `ReviewStep.tsx` keeps its current shape, *(amended)*
now one `bg-surface rounded-card` per **category**: the gate question, her gate answer directly
beneath it, each answered follow-up with its formatted answer, her detail text, an attachment row if
there is one (§15.6), and one "Edit" control per card (which re-asks the category's gate — §14.7).
*(amended)* Never reached on the hard-stop path at all — review is skipped entirely there (§14.10),
so this screen still only ever shows categories that were genuinely, completely walked.

The reasoning, so nobody re-litigates it:

1. **A transcript is chronological, not current.** After one edit, an answer appears twice. The
   reader has to work out which one counts. On the last screen before something reaches a
   clinician, that is unacceptable.
2. **A transcript has no stable question→answer adjacency.** Once detail beats and voice notes
   interleave, the answer to question 3 can be three elements away from question 3.
3. **It cannot be scanned.** Someone frightened will give this screen a few seconds. A structured
   list can be scanned in that time; a conversation cannot — you have to read a conversation.
4. **Scannability here is a safety property, not a preference.** This is the last point at which
   she can correct something. The conversation exists to make *answering* feel human; the review
   exists to make *checking* fast. Those are different jobs and they get different screens.

The switch from conversation to review is a normal route-level transition (§5, `--dur-screen`,
opacity + 8px rise). It should feel like arriving somewhere else. That contrast is the point.

### 14.9 Accessibility

- `<h1 className="sr-only">Check in</h1>`.
- The conversation column is `aria-live="polite"` and `aria-relevant="additions"`, so each new
  message is announced as it mounts. Not `assertive` — nothing here interrupts.
- Move focus to the **first chip** when a chip row mounts, so a keyboard or switch user is not
  stranded. Do not move focus for a message with no controls.
- Each chip row (and the multiselect/number/text inputs, §14.4) is a `role="group"` with
  `aria-label` set to the gate question or follow-up prompt it answers *(amended for categories)*.
- Every control keeps `tap` (56×56) and the global focus ring (§9.5). No `outline: none`.
- Her bubbles are plain text with an accessible "Change this" control; they are not buttons
  themselves (a bubble-sized tap target that does something surprising is a hazard).

### 14.10 The hard-stop interrupt *(new — held-build-brief.md placeholder_content, "Hard-stop rule")*

The Collapse/seizure/trauma category is not an ordinary category. The instant either of its two
gate questions is answered yes, wherever it falls in the sequence (§14.1's ordering note), the
conversation ends and routes straight to the emergency outcome:

- `submitReport({ endedEarly: true })` fires immediately — rule 4e ("a report goes to the private
  clinic on every outcome") applies even here, with whatever exists at that moment.
- `navigate('/outcome')` follows in the same handler. No remaining categories are asked. The closing
  free-text beat never opens. **Review is skipped entirely** — `TriageFlow.tsx` never sets
  `phase: 'review'` on this path.
- This is imperative, not derived: the navigation happens once, inside the click handler that
  receives the "yes" answer, not as a `useEffect` reacting to stored state. That is what makes
  resuming the conversation afterward (below) safe — re-rendering a category whose stored answer
  already says "yes" must not re-trigger the interrupt a second time.

**The number is never gated behind finishing the form** (the brief's words) — she can keep adding
detail afterward if she wants, but nothing about getting the phone number in front of her waits for
that. The mechanism, chosen for being the simplest honest one available: a quiet, unstyled-as-a-CTA
link on the emergency outcome screen, **"Add more detail for your clinic"**
(`EMERGENCY_ADD_MORE_LABEL`), beneath the download button and the "your clinic has also received a
copy" line. Pressing it:

- Navigates back to `/triage` carrying `{ state: { continueAfterHardStop: true } }`, which tells
  `TriageFlow.tsx` NOT to reset her answers as it would for a genuinely fresh check-in.
- The conversation resumes exactly where the high-water mark says it is — the categories she already
  answered (including the hard-stop yes) render as resolved history; whichever category comes next
  in the walking order asks normally.
- The closing beat's final button and acknowledgement line swap for this path
  (`CHECK_IN_HARD_STOP_CLOSING_ACK`, `CHECK_IN_RETURN_TO_EMERGENCY_LABEL`) — there is no review to
  send her to, and pretending there is would be a lie the moment she pressed the button.
- Pressing it resubmits (`submitReport({ endedEarly: true })` again) and returns to `/outcome`.
  **This never changes the number already shown** — no-downgrade means nothing gated yes and nothing
  she adds afterward can move her out of the emergency tier (`getEscalationTier` reads only gates and
  the two named Bleeding follow-ups; see §15.6's report-shape note and `src/logic/escalationTier.ts`).

**The PDF must say what actually happened**, not merely what is technically true (`src/logic/
reportPdf.ts`): a category with no answer, on a hard-stop submission, renders as *"not asked — check-
in ended early to show emergency contact"* — not "not answered", which would read as a "no" a
clinician could reasonably (and wrongly) infer meant reassurance. `ReportData.hardStopEndedEarly`
carries this distinction from `AppStateContext`'s `ReportSubmission` through to the PDF.

### 14.11 Cross-category overlap *(new — held-build-brief.md placeholder_content)*

Pain's "Any bleeding, fluid, contractions, or urinary symptoms?" follow-up and Vomiting's "Any
abdominal pain, fever, dark urine, dizziness, or weight loss?" follow-up both re-ask about facts that
may already be sitting in the transcript above them (Bleeding, Fluid, and — for Vomiting's mention of
abdominal pain — Pain). The brief's requirement is narrow and explicit: **no cross-category
inference, no scoring — if a fact was already captured this session, show what was recorded and let
her confirm or add, rather than a blank prompt.**

Built as data, not logic: an optional `overlapsWith: string[]` field on a `RedFlagFollowUp`
(`src/data/clinicalContent.ts`) names the OTHER categories it re-asks about. When the follow-up's
prompt bubble is about to render, `overlapRecap(overlapsWith, categoryAnswers)` looks up whether
those categories have already been answered this session and, if so, returns one plain sentence —
*"Already recorded this session — Are you bleeding? — Yes."* — rendered as a caption beneath the
prompt, inside the same bubble (the same visual grammar as the detail beat's hint line, §15.2). If
none of the named categories have been answered yet (this can happen — see §14.1's ordering note:
walking order guarantees Bleeding/Fluid precede Pain and Pain precedes Vomiting, so this is not
expected in practice, but the function degrades to it safely regardless), the follow-up renders as
an ordinary blank prompt. Either way, her answer to the follow-up itself — confirming, adding to, or
contradicting the recap — is what actually gets recorded; the recap is read-only memory, never a
default or a suggestion she has to override.

---

## 15. The detail beat and voice notes

### 15.1 When it opens

*(amended — held-build-brief.md's amended `placeholder_content`)* The flat six-question set's
`flagWhen` field (which answer counted as concerning, per question — "no" for movement, "yes" for
the rest) is gone along with the flat set itself. Every category's gate is a plain yes/no question
now, and **"yes" is uniformly the answer that opens the detail beat** — there is no more
question-by-question exception to remember or get backwards, because there is no more per-question
polarity to track. (Rule 2, "her perception always wins", still does the real work here: "yes,
something is different" is what she is describing, whichever category asked it.)

**Automatically, as the next conversational beat, once a category's gate is answered yes and its
follow-ups (if any) are all answered.** For a category with no follow-ups this is immediate; for one
with several, the beat opens after the last follow-up resolves, not after the gate itself — she
finishes describing what happened before being asked whether she wants to add anything to it.

It does **not** open for a gate answered no. She can still add detail to any category via "Change
this" → flip the gate to yes → answer again, and via the closing free-text beat, which is enough.

### 15.2 The beat

`--dur-beat` (700ms) after her bubble:

1. A **bot bubble** containing `CHECK_IN_DETAIL_INVITE` at `text-body`, and 8px beneath it
   `CHECK_IN_DETAIL_HINT` at `text-caption text-text-muted`, inside the same bubble.
2. 220ms later, the **composer**.

**The composer is inline and scrolls with the conversation. It is never docked.** The dock belongs
to the emergency control (§14.6). This is a deliberate departure from every chat UI on the mood
board and it is a safety decision, not an aesthetic one.

```
container:  rounded-card · bg-surface · border border-line · p-4   (16px)
            full width of the content column
  textarea: rows={3} · bg-transparent · text-body text-text
            placeholder "Type here" in text-text-muted · no border · no ring of its own
            (the container carries the border; the focus ring lands on the container)
  row:      mt-4 · flex items-center justify-between
    left:   the mic control (§15.3)
    right:  [ Skip this ]  [ Send ]
```

- **Send**: `tap rounded-pill bg-accent text-on-accent text-label px-6`, `PaperPlaneRight` Light
  20px. `disabled` at `opacity-55` when there is neither text nor a voice note.
- **Skip this**: `tap px-2 text-label text-accent`. Sits on the composer's `bg-surface` fill, so
  §13.3's "no accent text on bare washed bg" rule holds.
- **Do not auto-focus the textarea.** Raising the keyboard unasked obscures the emergency control
  and makes an optional step feel required.
- **Nothing is ever marked missing.** No asterisk, no "required", no red, no validation message,
  no nag if she skips, no second ask. `Skip this` removes the composer and the flow moves on, with
  no acknowledgement line — silence is the least demanding response available.

On **Send**: her typed text mounts as her bubble; if a voice note is attached it mounts as a
second bubble directly beneath (§15.4). Both attach to the same `CategoryAnswer` *(amended — was
`RedFlagAnswer`)*. The composer unmounts. The next category arrives after `--dur-beat`.

The **closing** free-text beat (§14.1, after the last category) uses the identical composer, with
`CHECK_IN_CLOSING_INVITE` above it and `Nothing to add` as its skip label instead of `Skip this`.
Its output goes to `triageDescription` / `triageVoiceNote` rather than to an answer.

### 15.3 The mic

A `tap` (56×56) circular control at the composer's bottom-left:

```
rounded-pill · bg-surface-hi · Microphone (Phosphor, Light, 24px) · text-accent
aria-label="Record a voice note"
```

**Capability check at mount**, before rendering it:

```ts
const canRecord =
  typeof MediaRecorder !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia;
```

If `canRecord` is false, **do not render the mic and do not render any explanatory line.** An
affordance that was never offered needs no apology.

On press: `await navigator.mediaDevices.getUserMedia({ audio: true })`, then
`new MediaRecorder(stream)`, `recorder.start()`. Record `performance.now()` as the start mark.

### 15.4 Recording, stopping, playing back

**Recording state.** The mic control stays exactly where it is and stays 56×56. It gains:

- Glyph swaps to `Stop` Light 24px, still `text-accent`. `aria-label="Stop recording"`.
- A **breathing ring**: an absolutely positioned `rounded-pill inset-0` element,
  `border: 1.5px solid var(--lamp-4)`, carrying the existing **`animate-breath`** utility —
  opacity 0.62 → 1, scale 1 → 1.035, over `--dur-breath` (**9s**), `var(--ease-breathe)`.
  **Reuse `animate-breath`. Do not write a new keyframe and do not shorten the period.** A 9s
  breath means a 4-second recording shows less than half a cycle: it cannot read as a tick.
- Beside the control, `text-caption text-text-muted`: **"Recording"**. Static.

**Forbidden in the recording state, explicitly:**

- **Red.** `--emergency` appears exactly once in the product (§0 rule 5) and this is not it. A red
  recording dot is a convention, and it is the wrong one here.
- **A live duration.** §5 bans counters and elapsed-time readouts. A clock running while she talks
  about her baby's movements is a stress cue. She gets the duration when she stops (§15.4,
  playback), as a settled fact.
- **A waveform or level meter.** §0 rule 7 — that is a monitor, and it is the exact form the mood
  board's "yap" glyph takes. Banned.
- Pulsing, flashing, scaling faster than the breath, or any colour change.

**Reduced motion**: drop `animate-breath` and render the ring static at `opacity: 1`, no scale.
Branch with `usePrefersReducedMotion()` — the global 0.01ms collapse would freeze it at the dim
end of the cycle.

**Stopping.** On press:

1. `recorder.stop()`, collect chunks into a `Blob`, `URL.createObjectURL(blob)`.
2. **Duration comes from `performance.now()` deltas, never from `audio.duration`.** Chrome reports
   `Infinity` for the duration of a `webm` blob it recorded itself. Round to whole seconds; floor
   at 1.
3. **Release the stream immediately**: `stream.getTracks().forEach((t) => t.stop())`. Leaving it
   open keeps the OS microphone indicator lit, which is alarming and looks like surveillance.

**Playback bubble.** Rendered as one of *her* bubbles (right-aligned, `bg-surface-hi`, same
geometry as §14.4), containing a single `flex items-center gap-3` row:

- `tap` circular control, `rounded-pill bg-surface`, `Play` / `Pause` Light 22px `text-accent`,
  `aria-label="Play voice note"` / `"Pause voice note"`.
- `text-body text-text`: **"Voice note"**.
- `text-caption text-text-muted`: the duration as `m:ss` — e.g. `0:14`. Static, a settled fact.

**No scrubber, no waveform, no elapsed-time readout, no progress bar during playback.** Playback
is play or pause. A bar filling while audio plays is precisely the "something races" pattern §5
exists to prevent, and there is nothing in a 15-second note worth seeking to.

Beneath the bubble, right-aligned, 8px below, `gap-4`, both `tap`, both `text-caption text-accent`:

- **"Record again"** — revokes the object URL, clears the attachment, restarts recording.
- **"Delete"** — revokes the object URL, clears the attachment, restores the composer's mic.
  **No confirmation dialog.** A modal at 3am asking "are you sure?" is worse than an accidental
  delete she can redo in four seconds.

### 15.5 When the microphone is refused

The graceful path, exactly:

- Any failure — permission denied, no device, `NotAllowedError`, `NotFoundError`, a throw from
  `getUserMedia`, a throw from the `MediaRecorder` constructor — is caught and produces **one
  quiet inline change**: the mic control unmounts, and in its place, inside the composer, a
  `text-caption text-text-muted` line reads:

  > **"Voice notes are not available on this device. You can type instead."**
  > (`CHECK_IN_MIC_UNAVAILABLE`)

- No dialog, no toast, no banner, no icon change, no retry button, no red, no warning glyph
  (§6.1 bans `Warning*` outright), no console-visible drama.
- The textarea stays exactly as it was, with whatever she had already typed. Nothing is lost.
- The line persists for the rest of that beat and does not reappear on the next one — asking again
  and being refused again is worse than not asking.

### 15.6 What travels: state, review, report

**`src/types.ts`:**

```ts
export interface VoiceNote {
  /** Object URL for local playback only. Never persisted, never uploaded in
   * the prototype — the demo is offline and this is a browser Blob. */
  url: string;
  /** Whole seconds, measured with performance.now() at start and stop.
   * Never read from audio.duration, which reports Infinity for a webm blob
   * the browser recorded itself. */
  durationSeconds: number;
  /** The MIME type the recorder actually produced, e.g. 'audio/webm'. */
  mimeType: string;
}

export interface RedFlagAnswer {   // superseded — see below
  questionId: string;
  answer: 'yes' | 'no';
  detail?: string;
  voiceNote?: VoiceNote;   // NEW
}
```

*(amended — held-build-brief.md's amended `placeholder_content`)* `RedFlagAnswer` above described
the flat six-question set and no longer exists. Its replacement, `CategoryAnswer`
(`src/types.ts`), carries the same two fields this section cares about (`detail?: string`,
`voiceNote?: VoiceNote`) at the CATEGORY level rather than the question level, alongside the gate
answer(s) and an array of typed follow-up answers:

```ts
export interface FollowUpAnswer {
  followUpId: string;
  value: FollowUpAnswerValue;   // tagged by type: yesno | text | number | select | multiselect
}

export interface CategoryAnswer {
  categoryId: string;
  gateAnswer: 'yes' | 'no';
  additionalGateAnswers?: ('yes' | 'no')[];   // the Collapse category's second question only
  followUpAnswers: FollowUpAnswer[];
  detail?: string;
  voiceNote?: VoiceNote;
}
```

Everything else in this section — the composer, the mic, recording/playback, the review row, the
PDF line — is unaffected by this: `detail` and `voiceNote` still mean exactly what they meant
before, just attached to a category instead of a question.

**`AppStateContext`** gains, alongside `triageDescription`:

```ts
triageVoiceNote: VoiceNote | null;
setTriageVoiceNote: (note: VoiceNote | null) => void;
```

`resetState()` clears it, and **revokes any live object URLs first** (both the closing note and
every `categoryAnswers[].voiceNote` *(amended — was `redFlagAnswers[].voiceNote`)*) so a long demo
session does not leak blobs.

**Review screen (`ReviewStep.tsx`).** Where a category's answer or the description has a voice
note, add an **attachment row** inside that card, beneath the detail text, 12px below:

```
rounded-chip · bg-surface-hi · p-3 (12px) · flex items-center gap-3
  Microphone (Light, 20px, text-accent)
  text-body text-text        "Voice note"
  text-caption text-text-muted   "0:14"
  (right) tap Play/Pause control, rounded-pill bg-surface, text-accent
```

It is a **row, not a bubble** — the review screen carries no chat grammar (§14.8). It is not
deletable from here; editing is via the card's existing "Edit" control.

**PDF (`src/logic/reportPdf.ts`).** One plain line, factual, no interpretation, and it must not
contain either forbidden word ("A&E", "detected") — it contains neither:

```ts
/** Appended to a report section when a voice note is attached. Factual only:
 * it states that a recording exists and where the clinic can get it. It never
 * describes, transcribes, or characterises the recording. */
export const REPORT_VOICE_NOTE_NOTE =
  'A voice note was recorded and is available to the clinic.';
```

- In `buildRedFlagParagraphs`, when `answer.voiceNote` is present, push
  `REPORT_VOICE_NOTE_NOTE` as its **own paragraph immediately after** that category's lines
  *(amended — was "that question's line")* — not parenthesised into any of them, which would read
  badly at the end of a sentence containing detail text.
- In `buildDescriptionParagraphs`, when `triageVoiceNote` is present, push it as the paragraph
  after the description.
- Nothing else changes in the PDF. No duration, no filename, no attachment count, no link.
- *(amended)* The PDF also renders category-by-category now — gate question and answer, any
  additional gate questions, each answered follow-up, detail, voice note — and an unasked category
  honestly as "not asked" or, on the hard-stop path, "not asked — check-in ended early to show
  emergency contact" (§14.10). None of that is a voice-note concern; it is documented in full where
  it belongs, §14.10, not duplicated here.

Extend `src/test/reportPdf.test.ts`'s forbidden-word assertions to cover the new paragraphs —
the existing test walks all sections, so it should catch this for free; verify rather than assume.

### 15.7 Demo safety

> **Nothing on the happy path may depend on microphone permission.** The one-minute stage demo
> must be walkable end to end with the microphone blocked, missing, or in use by the conferencing
> software.

Which is guaranteed by three things:

1. The detail beat is **skippable and optional at every appearance**. The demo script types.
2. If the mic is unavailable it silently does not render (§15.3); if it is refused it produces one
   caption (§15.5). Neither blocks anything.
3. **The demo panel can inject a voice note without touching `getUserMedia` at all.**

**Demo panel — "Attach a demo voice note".** A new row in the demo panel that attaches a
synthetic `VoiceNote` to the most recently answered `CategoryAnswer` *(amended — was
`RedFlagAnswer`)* (or to `triageVoiceNote` if the conversation is past the last category):

- `url`: a **data URL** for a valid, silent WAV, built as a constant in the demo-panel module —
  a 44-byte RIFF/WAVE header (PCM, mono, 8 kHz, 8-bit) followed by 8000 bytes of `0x80`, i.e. one
  second of silence, base64-encoded. It plays, it is seekable, it needs no network and no
  permission.
- `durationSeconds`: `12` — a plausible-looking figure for the review row and nothing more.
- `mimeType`: `'audio/wav'`.
- Never call `URL.revokeObjectURL` on it (it is not an object URL); `resetState()` must skip
  revocation for any `url` that does not start with `blob:`.

Label it plainly in the panel. It is a demo affordance and it should look like one.

---

## 16. Manufactured live movement for the demo

The live view (§7) shows a ring per `moved: true` sample, and samples arrive every 4 seconds from
the seeded generator. On stage that means waiting, and waiting on a probability. The demo needs
movement **on cue**.

### 16.1 Keep the interface clean

`MovementStream` is the sensor boundary (`src/sensors/MovementStream.ts`) and a real hardware
implementation will have to satisfy it. **Injection is a capability of the mock, not part of the
interface.**

```ts
export interface MovementStream {
  subscribe(cb: (sample: ActivitySample) => void): () => void;
  getWindow(hours: number): ActivitySample[];
  getBaseline(): number;
}
// ^ UNCHANGED. Do not add injection here.

/**
 * Demo-only capability, implemented by the mock stream so the demo panel can
 * put samples on the wire on cue. A real hardware stream will not implement
 * it. Nothing outside src/components/DemoPanel.tsx may call these.
 */
export interface InjectableMovementStream {
  /** Emits one `moved: true` sample to every subscriber, right now. */
  injectSample(): void;
  /**
   * Emits a scripted, deterministic burst. Returns a cancel function.
   * Calling it again cancels any burst already in flight, so a double-press
   * on stage does not stack two bursts.
   */
  injectBurst(options?: { count?: number; seed?: number }): () => void;
}

/** Narrows a stream to its injectable capability, or null if it has none. */
export function asInjectable(stream: MovementStream): InjectableMovementStream | null;
```

`asInjectable` duck-types on the two method names and returns `null` otherwise, so the demo panel
degrades to hiding its buttons rather than crashing when a real stream is swapped in.

### 16.2 What the mock has to change

`MockMovementStream.subscribe()` currently creates **one interval per subscriber** and closes over
its own callback, so there is no way to reach subscribers from outside. Refactor:

- Hold a `Set<(sample: ActivitySample) => void>` of subscribers.
- Start the 4000ms interval when the set becomes non-empty; clear it when the set empties.
- `subscribe(cb)` adds and returns a remover. Existing behaviour is otherwise unchanged: the
  interval still emits the latest sample from `getWindow(1)`.
- One private `emit(sample)` fans out to every subscriber.

This is a prerequisite, not an optional cleanup — with per-subscriber intervals an injected sample
can only reach one listener, and both `LiveSurface` and (if §13.7 is enabled) the background need
to see it.

### 16.3 `injectSample()`

Emits `{ timestamp: new Date(), moved: true }` to every subscriber immediately. Does not disturb
the running 4s interval. Does not touch the seed.

One ring, now. That is all it is.

### 16.4 `injectBurst()` — the "active spell"

A burst that reads as a baby having a wriggle, not as a machine firing:

| Parameter | Value | Why |
|---|---|---|
| `count` | **7** (default) | Against a 7.5s ring life (§7.4) and a 6-ring cap, 7 samples over ~8s yields **4–6 concurrent rings** at the midpoint — visibly busy, never saturated. |
| Base spacing | **1100ms** | |
| Jitter | `delay_i = 1100 × (0.55 + 1.05 × r_i)` → **605–1760ms**, mean ≈ 1180ms | Even spacing reads as a metronome, which is a monitor. Uneven spacing reads as a body. |
| `r_i` | `mulberry32(seed ?? 0x4b494e44)` | **Deterministic.** `Math.random` is banned here as everywhere in this codebase (see `seedActivity.ts`, `LiveSurface.tsx`). Same seed, same burst, every run. |
| Total span | ≈ **8.3s** | |
| `moved` | **`true` for every sample in the burst** | A `moved: false` sample produces no visual change of any kind (§7.4), so emitting filler would be dead weight. |

Implementation: a chain of `setTimeout`s; the returned cancel function clears the pending one.
Calling `injectBurst` again cancels the in-flight burst first.

**Do not "improve" the numbers.** Raising `count` past ~9 saturates the 6-ring cap and the surface
starts to look like weather; tightening the spacing below ~600ms makes it look mechanical. Both
failure modes are the exact readings §7.1 was designed to avoid.

### 16.5 Demo panel — the movement section

New section, placed directly above "Seeded activity data" (the two are related and should read
together):

- Heading: `Live movement`
- **`Movement`** → `injectSample()`. Sub-label, `text-sm text-text-muted`: `one sample now`.
- **`Active spell`** → `injectBurst()`. Sub-label: `7 samples over ~8 seconds`.
- Both close the panel on press (`setIsOpen(false)`), so the stage sees the live view immediately.
- Both rows use the existing demo-panel button styling (`min-h-14 rounded-lg bg-surface-hi
  px-3 py-2 text-left`).
- If `asInjectable(getMovementStream(activityVariant))` returns `null`, **render neither button**
  and omit the heading.

### 16.6 The quiet/active toggle needs no changes

Confirmed, and here is the boundary so nobody blurs it:

- The **quiet/active toggle** selects which 14-day seeded dataset backs `getWindow()`. That is
  what the ember band (§8) and the PDF's 24-hour activity summary read. It is *history*.
- **Injection** puts samples on the live subscription only. That is what the live view (§7) reads.
  It is *now*.

They are orthogonal and both are needed: the founder picks the history that suits the story with
the toggle, then makes something happen on cue with the buttons.

**Injected samples deliberately do not enter `getWindow()`.** So the ember band will not gain
embers and the PDF will not gain movements when "Active spell" is pressed. That is correct: the
band is "a still record, not a live thing" (§8), the report must match the band, and making
injection rewrite history would have two demo controls silently fighting over the same data.
**Do not add a "write injected samples into the seed" option.**

### 16.7 A note on the demo panel's own styling

`src/components/DemoPanel.tsx` uses `uppercase tracking-wide`, `text-sm font-semibold`,
`rounded-lg` and `bg-black/50` — all of which the type and radius law (§3.3, §4.2) forbids in the
product.

**That is fine and deliberate. The demo panel is a tool, not the product.** It is explicitly
exempt from §3 and §4.2, and it should look like a control surface so that if it is opened on
stage nobody mistakes it for part of the app. Match the existing panel styling when adding to it;
do not restyle it to the design system, and do not file it as a bug.

---

## 17. The mood board: adopted and rejected

42 references, mostly Mobbin captures. What follows is what was taken, what was refused, and the
rule that decided each. **Where the mood board conflicts with a clinical safety rule or the
anti-AI-default stance, the rule wins** — every refusal below names the rule it is enforcing.

### 17.1 Adopted

| From the board | What was taken | Where it lands |
|---|---|---|
| **Open** — one huge soft bloom filling the frame under a single line of calm copy | A single soft radial bloom as the entire visual event of a screen. One source, one hue. | §13.4 H1, §13.6 |
| **Raycast AI** — a near-empty screen with a barely-there warm haze behind it | That a background can be almost imperceptible and still change how a screen feels. | §13.6, iteration B in its entirety |
| **pillowtalk** — a blurred amber field carrying large friendly type, with the interface floating in it | Warmth as the *ground* rather than as decoration; big type doing the work with no illustration beside it. | §13, §14.4 (question at `text-lead`, no accompanying artwork) |
| **TIDE** — controls docked at the bottom over an image that dissolves under them | Confirmation of §4.5's dock + 24px fade. The wash now dissolves into it too. | §13.4 |
| **Calm Sleep** — a dark field warming toward the bottom, questions above it | The bottom-anchored light with content in the lit air above it. This is iteration A's whole thesis. | §13.4 |
| **Cleo AI** — quick-reply chips above a persistent composer, one scrolling exchange | The structural pattern of the conversational check-in: chips as her side of the conversation, a composer that is always available, one continuous surface. | §14 |
| **Alan / Future / Calm Sleep** — a thin determinate progress bar pinned to the top | The rail. 3px, `--accent` on `--line`, no numeral, moves only when she does. | §14.3 |
| **pillowtalk / Cleo / Raycast** — voice offered as a peer of typing, inside the composer | One mic, inside the composer, alongside the textarea. Not a mode, not a separate screen. | §15.3 |
| **Pixar *Soul* stills / neon line-drawings** — figures drawn as a single glowing line | Reinforcement of §6.2's hand-drawn moments: light *as a drawn line*, 1.25 stroke, round caps, deliberate imperfection. No new artwork commissioned from this. | §6.2 (unchanged, confirmed) |

### 17.2 Rejected

| From the board | Refused | The rule |
|---|---|---|
| **Flo** — soft-pink maternity palette, a rendered embryo, "Your baby's growth diary", "2 weeks" over a fetal image | All of it. Three separate violations on one screen: pink pastels, baby imagery, and a card that narrates the baby back to her. | §11 (soft-pink maternity styling), §0 rule 6 |
| **Flo / Future / Breathwrk** — teal accents, a green tick on the selected option, green calendar dots, a teal→cyan gradient CTA | Green in every form. **There is no green token and adding one is forbidden.** Green is a verdict, and this product may not deliver one. | §2.4, §0 rule 6 |
| **Breathwrk** — "55 out of 100 · Breath Score" | Scores. No number summarises anything here. | §0 rule 6 |
| **Opal** — "Your digital health score is **intermediate**", a curve rising from "Now" to "Goal", "90–100" | Scores, verdict adjectives, trajectories, goal states, and the whole grammar of progress-toward-health. The most dangerous single reference on the board, and it is on there twice with Breathwrk. | §0 rule 6, §10 |
| **Google Fit** — a full-red measuring screen with a live ECG trace and "Measuring your heart rate. Hold still…" | The clinical-monitor screen entirely, including the instruction pattern. It is also *red*, which is reserved for one control. | §0 rule 7, §0 rule 5 |
| **Google Fit** — a determinate "29%" percentage ring | Percentage rings and any waiting indicator. | §5 as amended |
| **Hypelist** — a particle cloud with "Hold on tight.. Putting the best recs together for you" | Loading theatre. A spinner in this product is a heart-rate cue. Loading is a static muted line. | §5 |
| **Ahead / Opal / Cleo** — a purple ghost mascot, a smiling blob, a waving-hand emoji | Mascots, faces, and emoji. A face implies an entity with a view, which is exactly what a product that must never draw a conclusion cannot have. | §10, §0 rule 6 |
| **Alan** — emoji as list iconography | Emoji, anywhere. | §10 |
| **Cleo / Opal / pillowtalk** — "Hey you 👋", "No sweat!", "I can also see you've…", "yap" | The cheery first-person assistant voice. The bot speaks in second person, never says "I" or "we", never evaluates, never cheers. | §10 as amended, §14.2 |
| **TIDE / Breathwrk** — frosted glass panels floating over imagery | Glassmorphism. Elevation is a value step; the wash sits *behind* opaque surfaces instead. It is also the change that would break §13.3's contrast contract. | §4.3, §13.1 |
| **TIDE / stoic** — photographic sunsets as the background | Photographs. A photograph of someone else's sunset is someone else's room. The wash is generated from `--accent`, so it is the same lamp in both themes, needs no asset, no licence and no network call, and cannot drift out of the palette. | §1, §11 |
| **Opal / Calm Sleep** — blue→purple and navy→blue→peach mesh gradients | Multi-hue mesh. The palette has exactly one hue, so there is no second hue to build a mesh from — which is why §13's wash is a single hue at low alpha and not an aurora. | §11 |
| **pillowtalk** — the animated waveform "yap" glyph | A live waveform or level meter during recording. That is a monitor, and it is a counter. Recording shows a 9s breath and the word "Recording". | §0 rule 7, §5 |
| **Open** — the acid chartreuse bloom | The colour, not the form. Near-black + acid green is a named AI-default pairing, and green is a verdict. The form is adopted; the hue is `--accent`. | §11, §2.4 |

### 17.3 The one place the board changed a rule

The mood board's thin top progress bar (Alan, Future, Calm Sleep) is a genuinely good idea for a
six-question flow, and §5 banned progress bars outright.

That ban was written against *indeterminate* indicators — spinners and loaders, things that move
while she waits. §5 has been amended to say so, and to permit **exactly one** determinate position
indicator, on the condition that distinguishes the two: **it never moves on its own.** The rail
moves only in response to something she did, carries no numeral, and has no completed state.

That is the only rule in this document the mood board moved. Everything else in §17.2 stands.
