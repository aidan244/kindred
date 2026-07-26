/**
 * The type-appropriate input for one conversational beat — a category's gate
 * question (always `yesno`, held-build-brief.md placeholder_content), or one
 * of its follow-ups (`yesno` | `text` | `number` | `select` | `multiselect`).
 * Generalises design-plan.md §14.4's yes/no `ChipRow` to the amended
 * schema's mixed input types, keeping the same interaction grammar wherever
 * it still applies:
 *
 *  - `yesno` / `select`: a single tap is a complete answer. The row fades
 *    (opacity -> 0 over `--dur-press`, no movement) and her bubble mounts in
 *    its place — identical to today's yes/no chips, just with N options
 *    instead of two.
 *  - `multiselect`: a tap toggles a chip rather than submitting immediately
 *    (there is no single "the" answer to fade out on), so an explicit
 *    "Continue" commits the selection. Always enabled — an empty selection
 *    is a legitimate, non-demanding answer (src/data/clinicalContent.ts
 *    modelling decision (d)).
 *  - `text`: the SHARED composer (src/components/Composer.tsx), Send and mic
 *    included, so a free-text answer can be spoken as well as typed —
 *    wherever she can type in this product she can record instead. No Skip:
 *    it is a question inside the questionnaire, and it can be sent empty,
 *    because a blank answer is legitimate (modelling decision (d)).
 *  - `number`: a numeric field with a Send action, and deliberately NO mic —
 *    a recording is not a number, so a mic here would offer a way to answer
 *    that this input cannot record. Send stays disabled until a value is
 *    entered, because there is no honest "blank" number (modelling decision
 *    (d)).
 *
 * Every widget here calls its `onSubmit`/`onSelect` exactly once, with a
 * fully-formed value — it never partially commits.
 *
 * SURFACE (handoff README 03/04): every option row is LEFT-aligned and wraps
 * at 12px gaps — her answers read as a set of things offered to her, not as
 * a right-hand column of pending replies. A chip is min-height 56 (`tap`),
 * pill, padding 0 24, `surface-hi`, a 1px `line`, label role. There is no
 * tick anywhere in here, in any state: a chosen answer becomes her own
 * message bubble (the caller mounts it), and a selected multiselect chip is
 * marked by a 2px accent edge and `aria-pressed`, never by a glyph.
 *
 * ENTRANCE: each widget staggers its own chips ~60ms apart off the
 * surrounding beat's reveal (`useBeatRevealed`), which is why the caller
 * wraps these in `<Beat entrance="children">`. Under reduced motion the
 * stagger is dropped entirely and everything simply appears. It runs as the
 * shared `beat-in` CSS animation rather than as an inline opacity, because an
 * inline opacity silently beats `press:active` — see `useEnterStyle`.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import {
  CHECK_IN_CONTINUE_LABEL,
  COMPOSER_SEND_LABEL,
  YES_NO_OPTIONS,
} from '../../data/clinicalContent';
import { hapticTick } from '../../logic/haptics';
import { Composer } from '../../components/Composer';
import { usePrefersReducedMotion } from '../../components/usePrefersReducedMotion';
import { STAGGER_MS, useBeatRevealed } from './Beat';
import type { RedFlagFollowUp } from '../../data/clinicalContent';
import type { FollowUpAnswerValue, VoiceNote } from '../../types';

/** One chip, handoff README 03/04: min-height 56, pill, padding 0 24,
 * `surface-hi`, label role, and a 1px `line` seam ("line — seams only, 1px,
 * never a minimum"). The edge is on the base rather than added by the two
 * consts below, because BOTH variants rest at 1px — see MULTI_CHIP_CLASS. */
const CHIP_BASE =
  'tap press flex max-w-full items-center justify-center rounded-pill border border-line bg-surface-hi px-6 text-label text-text';

/** A single-answer chip. */
const CHIP_CLASS = CHIP_BASE;

/**
 * A multiselect chip. README 04: "a 2px accent border for selected, never a
 * tick" — the 2px belongs to the SELECTED state alone, so the resting chip
 * keeps the same 1px `line` seam as the yes/no and select chips it sits
 * beside in the same conversation. It used to carry `border-2` in both
 * states and only swap the colour, which put a 2px `line` edge on every
 * unselected chip.
 *
 * The selected 2px is drawn as the 1px accent border PLUS a 1px inset ring
 * rather than by growing the border, so selecting cannot re-wrap the row
 * under her finger — the same construction OnboardingStep's OptionChip uses,
 * and an inset shadow rather than an outline so it can never collide with the
 * global 2px focus-visible outline.
 */
const MULTI_CHIP_CLASS = `${CHIP_BASE} data-[selected=true]:border-accent data-[selected=true]:shadow-[inset_0_0_0_1px_var(--accent)]`;

/** The accent pill that commits something (Continue, Send). */
const ACCENT_PILL_CLASS =
  'tap press flex max-w-full items-center justify-center gap-2 rounded-pill bg-accent px-6 text-label text-on-accent';

/**
 * The staggered entrance for one element inside a group that arrives
 * together — 420ms on `--ease-soft`, offset by `index * 60ms`. `revealed`
 * comes from the surrounding beat, so the stagger starts when the group's
 * turn comes rather than when it silently mounted. Reduced motion drops the
 * transition, the offset and the movement entirely.
 *
 * WHY THIS IS A CSS ANIMATION AND NOT AN INLINE `opacity` + `transition`.
 * Every element it is applied to also carries `press`, whose only rule is
 * `.press:active { opacity: 0.82 }` — a normal class declaration, which a
 * normal INLINE declaration outranks unconditionally. Setting `opacity: 1`
 * inline once the entrance had run therefore killed press feedback outright
 * on the answer chips and the multiselect Continue pill: the most-tapped
 * controls in the product gave nothing back. The inline `transition` was the
 * second half of the same bug — it replaced press's 120ms/linear with
 * 420ms/ease-soft plus a per-index delay.
 *
 * `beat-in` (src/index.css) was written for exactly this and had never been
 * wired up. `backwards`, not `both`: the fill holds the from-state during the
 * delay, and then the animation RELEASES the property when it ends, so the
 * resting opacity goes back to the cascade and `press:active` can win. `both`
 * would keep the animated value applied forever and reproduce the same bug
 * one layer up.
 */
function useEnterStyle(): (index: number) => CSSProperties {
  const revealed = useBeatRevealed();
  const reduced = usePrefersReducedMotion();
  // Captured at MOUNT, never updated. `useBeatRevealed()` defaults to true for
  // a widget rendered without a Beat around it — the re-ask rows — and those
  // must not animate: a re-ask is a correction she asked for, not a new
  // message arriving (Beat.tsx's own rule). A widget that was already revealed
  // when it mounted therefore gets no entrance at all.
  const [animates] = useState(() => !revealed);

  return (index: number): CSSProperties => {
    // Not revealed yet: genuinely invisible, with no animation running. This
    // is the one state where an inline opacity is correct — the element is
    // not on screen yet, so there is no press feedback to lose.
    if (!revealed) {
      return { opacity: 0 };
    }
    if (reduced || !animates) {
      // No entrance — and, deliberately, no inline opacity either, so press
      // keeps working. Press is an opacity change, not motion, so it stays
      // available to reduced-motion users too.
      return {};
    }
    return {
      animation: `beat-in var(--dur-enter) var(--ease-soft) ${index * STAGGER_MS}ms backwards`,
    };
  };
}

export interface TapChipRowExtraAction {
  label: string;
  onSelect: () => void;
}

/** Generalises design-plan.md §14.4's yes/no chip row to any list of
 * `{ value, label }` options. A tap fades the whole row and hands the
 * chosen value upward — nothing here decides what that value means. */
export function TapChipRow({
  options,
  ariaLabel,
  onSelect,
  onMount,
  extraAction,
}: {
  options: readonly { value: string; label: string }[];
  ariaLabel: string;
  onSelect: (value: string) => void;
  /** Only supplied when this row is NOT wrapped in a `Beat` (the reask
   * case) — see Beat.tsx's header comment for why that's the only time a
   * caller needs to drive scroll/focus itself. */
  onMount?: (element: HTMLDivElement) => void;
  /**
   * The gate row's third chip (handoff README 03): an accent-labelled way to
   * answer in her own words instead of picking one of the options. It never
   * fades the row and never submits a value — it swaps the row for the
   * composer, and the row has to still be there to come back to.
   */
  extraAction?: TapChipRowExtraAction;
}): ReactElement {
  const [fading, setFading] = useState(false);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const enterStyle = useEnterStyle();

  useEffect(() => {
    if (groupRef.current) {
      onMount?.(groupRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = (value: string): void => {
    if (fading) {
      return;
    }
    hapticTick();
    setFading(true);
    window.setTimeout(() => onSelect(value), 120);
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap justify-start gap-3"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity var(--dur-press) linear' }}
    >
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handlePress(option.value)}
          className={CHIP_CLASS}
          style={enterStyle(index)}
        >
          {option.label}
        </button>
      ))}
      {extraAction && (
        <button
          type="button"
          onClick={extraAction.onSelect}
          className={`${CHIP_CLASS} text-accent`}
          style={enterStyle(options.length)}
        >
          {extraAction.label}
        </button>
      )}
    </div>
  );
}

/* YES_NO_OPTIONS is imported from src/data/clinicalContent.ts. It used to be
 * declared here AND, byte-identically, in CheckInConversation.tsx, with bare
 * "Yes"/"No" literals in four more places besides — six sites for one two-word
 * vocabulary, one of which is the review screen whose entire purpose is
 * letting her verify what her clinic will read. */

function MultiSelectInput({
  options,
  ariaLabel,
  onSubmit,
  onMount,
}: {
  options: readonly { value: string; label: string }[];
  ariaLabel: string;
  onSubmit: (values: string[]) => void;
  onMount?: (element: HTMLDivElement) => void;
}): ReactElement {
  const [selected, setSelected] = useState<string[]>([]);
  const groupRef = useRef<HTMLDivElement | null>(null);
  const enterStyle = useEnterStyle();

  useEffect(() => {
    if (groupRef.current) {
      onMount?.(groupRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (value: string): void => {
    hapticTick();
    setSelected((current) => {
      if (value === 'none-of-these') {
        return current.includes('none-of-these') ? [] : ['none-of-these'];
      }
      const withoutNone = current.filter((entry) => entry !== 'none-of-these');
      return withoutNone.includes(value)
        ? withoutNone.filter((entry) => entry !== value)
        : [...withoutNone, value];
    });
  };

  return (
    <div ref={groupRef} className="flex flex-col items-start gap-3">
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap justify-start gap-3">
        {options.map((option, index) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(option.value)}
              data-selected={isSelected}
              // `aria-pressed` carries the selected state for screen
              // readers; there is no glyph, in any state, anywhere.
              className={MULTI_CHIP_CLASS}
              style={enterStyle(index)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {/* Always enabled: an empty selection is a legitimate answer
          (modelling decision (d)), so there is nothing to validate and
          nothing to disable. */}
      <button
        type="button"
        onClick={() => {
          hapticTick();
          onSubmit(selected);
        }}
        className={ACCENT_PILL_CLASS}
        style={enterStyle(options.length)}
      >
        {CHECK_IN_CONTINUE_LABEL}
      </button>
    </div>
  );
}

function NumberInput({
  ariaLabel,
  onSubmit,
  onMount,
}: {
  ariaLabel: string;
  onSubmit: (value: number) => void;
  onMount?: (element: HTMLDivElement) => void;
}): ReactElement {
  const [text, setText] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const enterStyle = useEnterStyle();

  useEffect(() => {
    if (containerRef.current) {
      onMount?.(containerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = text.trim() === '' ? null : Number(text);
  const canSend = parsed !== null && Number.isFinite(parsed);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center justify-start gap-3"
      style={enterStyle(0)}
    >
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="0"
        className="tap w-28 rounded-chip border border-line bg-surface-hi px-4 text-body text-text placeholder:text-text-muted"
      />
      <button
        type="button"
        disabled={!canSend}
        onClick={() => {
          if (!canSend) {
            return;
          }
          hapticTick();
          onSubmit(parsed);
        }}
        className={`${ACCENT_PILL_CLASS} disabled:opacity-55`}
      >
        <PaperPlaneRight size={20} weight="light" aria-hidden="true" />
        {COMPOSER_SEND_LABEL}
      </button>
    </div>
  );
}

/**
 * The `text` follow-up: THE SHARED COMPOSER (src/components/Composer.tsx),
 * not a second text box that looks like it.
 *
 * This used to be a hand-rolled card holding its own growing textarea and its
 * own Send pill — a near-copy of the composer, and the drift showed: the
 * composer had a mic and this did not, so whether she could speak her answer
 * instead of typing it depended on which beat of the same conversation she
 * happened to be in. It is now the same component, so the mic, the
 * hidden-sizer growth (no fixed height, no truncation at 200% text) and the
 * Send treatment cannot diverge again.
 *
 * `allowEmptySend`, because this beat has no Skip: a blank answer to a text
 * follow-up is legitimate (src/data/clinicalContent.ts, modelling decision
 * (d)), and the composer's default would disable Send and strand her on a
 * question she has no answer to.
 *
 * The entrance style stays on a bare wrapper rather than moving onto the
 * composer's own card. `beat-in` releases opacity when it ends — but only for
 * the element it runs on, and the card is the element that CONTAINS the
 * `press` targets (see useEnterStyle's note on why an inline opacity here
 * silently kills press feedback).
 */
function TextInput({
  id,
  ariaLabel,
  onSubmit,
  onMount,
  initialText = '',
  initialVoiceNote = null,
}: {
  /** Namespaces the composer's field ids — unique per mounted follow-up. */
  id: string;
  ariaLabel: string;
  onSubmit: (value: string, voiceNote: VoiceNote | null) => void;
  onMount?: (element: HTMLDivElement) => void;
  initialText?: string;
  initialVoiceNote?: VoiceNote | null;
}): ReactElement {
  const [text, setText] = useState(initialText);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(initialVoiceNote);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const enterStyle = useEnterStyle();

  useEffect(() => {
    if (containerRef.current) {
      onMount?.(containerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} style={enterStyle(0)}>
      <Composer
        id={id}
        value={text}
        onChange={setText}
        voiceNote={voiceNote}
        onVoiceNoteChange={setVoiceNote}
        // Composer trims what it hands up and fires the send haptic itself,
        // so neither is repeated here.
        onSend={onSubmit}
        ariaLabel={ariaLabel}
        allowEmptySend
      />
    </div>
  );
}

export interface FollowUpInputProps {
  followUp: RedFlagFollowUp;
  ariaLabel: string;
  /**
   * `voiceNote` only ever arrives from a `text` follow-up — the one type with
   * a composer, and therefore the one type with a mic. Every other widget
   * omits it, which is why it is a second parameter rather than a member of
   * `FollowUpAnswerValue`: a chip row has no note to report, not a null one.
   */
  onSubmit: (value: FollowUpAnswerValue, voiceNote?: VoiceNote | null) => void;
  onMount?: (element: HTMLDivElement) => void;
  /**
   * What she answered last time, on a RE-ASK — so "Change this" reopens what
   * she already said instead of a blank box (design-plan.md §14.7, "never
   * delete something she said"). `text` only: it is the one type whose widget
   * holds a draft rather than committing on a single tap, and it is now the one
   * type that can hold a recording she would otherwise lose without ever being
   * told. The closing detail beat already worked this way (DetailBeat.tsx).
   */
  initialText?: string;
  initialVoiceNote?: VoiceNote | null;
}

// formatFollowUpAnswerValue moved to src/data/clinicalContent.ts, next to
// overlapRecap — both are "join an answer against the schema for display"
// helpers with no React dependency, and keeping them there means
// src/logic/reportPdf.ts can use the same formatting without a logic ->
// screens import (re-exported here so nothing in this directory needs to
// know it moved).
export { formatFollowUpAnswerValue } from '../../data/clinicalContent';

/** Renders whichever input `followUp.type` calls for — the data-driven
 * switch the brief asks for ("one data-driven component... never touching
 * flow code"). A new follow-up of an existing type needs no change here. */
export function FollowUpInput({
  followUp,
  ariaLabel,
  onSubmit,
  onMount,
  initialText,
  initialVoiceNote,
}: FollowUpInputProps): ReactElement {
  switch (followUp.type) {
    case 'yesno':
      return (
        <TapChipRow
          options={YES_NO_OPTIONS}
          ariaLabel={ariaLabel}
          onMount={onMount}
          onSelect={(value) => onSubmit({ type: 'yesno', value: value as 'yes' | 'no' })}
        />
      );
    case 'select':
      return (
        <TapChipRow
          options={followUp.options ?? []}
          ariaLabel={ariaLabel}
          onMount={onMount}
          onSelect={(value) => onSubmit({ type: 'select', value })}
        />
      );
    case 'multiselect':
      return (
        <MultiSelectInput
          options={followUp.options ?? []}
          ariaLabel={ariaLabel}
          onMount={onMount}
          onSubmit={(values) => onSubmit({ type: 'multiselect', value: values })}
        />
      );
    case 'number':
      return (
        <NumberInput
          ariaLabel={ariaLabel}
          onMount={onMount}
          onSubmit={(value) => onSubmit({ type: 'number', value })}
        />
      );
    case 'text':
      return (
        <TextInput
          id={`fu-${followUp.id}`}
          ariaLabel={ariaLabel}
          onMount={onMount}
          initialText={initialText}
          initialVoiceNote={initialVoiceNote}
          onSubmit={(value, voiceNote) => onSubmit({ type: 'text', value }, voiceNote)}
        />
      );
    default: {
      // Exhaustiveness guard — followUp.type is a closed union, so this can
      // only be reached if the schema grows a type this file hasn't been
      // taught yet, and it must fail loudly in dev rather than render
      // nothing silently.
      const exhaustive: never = followUp.type;
      throw new Error(`Unhandled follow-up type: ${exhaustive}`);
    }
  }
}
