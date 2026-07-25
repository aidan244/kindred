# Kindred — design plan

**This document is the single source of visual truth.** If a screen you are building needs a
colour, a size, a radius, a duration or a decision that is not in here, the answer is: use the
nearest thing that *is* in here. Do not invent a token. Do not add a hex value anywhere outside
`src/styles/tokens.css`. Do not add a font. Do not add a colour that is not on the ramp.

Read sections 0, 1, 9 and 10 no matter which screen you are building.

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

**Banned motion**: spinners, progress bars, counters, countdowns, skeleton shimmer, pulsing
anything, spring physics, parallax, auto-advancing carousels, staggered list cascades,
attention-seeking bounce. A spinner in this product is a heart-rate cue. Use a static
`text-caption text-text-muted` line instead.

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
  `DownloadSimple`, `ArrowUpRight`. Need something else — pick the plainest Phosphor glyph and
  keep it Light.
- **`Check` may only ever indicate a selected form input** (a chosen radio/answer). It may
  never appear at screen level, never as a status, never green. A tick is a verdict. Rule 6.
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

### 9.1 `CheckInControl` — ⚠️ contains a rule violation to fix

The scaffold's primary variant is currently `bg-emergency px-6 text-lg text-text`
(`src/components/CheckInControl.tsx:45`). **That breaks Rule 5** — red must appear exactly once
in the product, on the emergency call control, and this is not it. It also fails contrast:
`--text` on `--emergency` is **3.00:1**. Whoever owns this file must change it.

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
