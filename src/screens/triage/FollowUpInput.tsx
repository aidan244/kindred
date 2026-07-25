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
 *  - `number` / `text`: an inline composer with a Send action. No mic, no
 *    voice note, no Skip — the category-level detail beat (DetailBeat.tsx)
 *    is the one place those live. `text` can be sent empty; `number` keeps
 *    Send disabled until a value is entered, because there is no honest
 *    "blank" number to record (modelling decision (d)).
 *
 * Every widget here calls its `onSubmit`/`onSelect` exactly once, with a
 * fully-formed value — it never partially commits.
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';
import type { RedFlagFollowUp } from '../../data/clinicalContent';
import type { FollowUpAnswerValue } from '../../types';

/** Generalises design-plan.md §14.4's yes/no chip row to any list of
 * `{ value, label }` options. A tap fades the whole row and hands the
 * chosen value upward — nothing here decides what that value means. */
export function TapChipRow({
  options,
  ariaLabel,
  onSelect,
  onMount,
}: {
  options: { value: string; label: string }[];
  ariaLabel: string;
  onSelect: (value: string) => void;
  /** Only supplied when this row is NOT wrapped in a `Beat` (the reask
   * case) — see Beat.tsx's header comment for why that's the only time a
   * caller needs to drive scroll/focus itself. */
  onMount?: (element: HTMLDivElement) => void;
}): ReactElement {
  const [fading, setFading] = useState(false);
  const groupRef = useRef<HTMLDivElement | null>(null);

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
    setFading(true);
    window.setTimeout(() => onSelect(value), 120);
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap justify-end gap-3"
      style={{ opacity: fading ? 0 : 1, transition: 'opacity var(--dur-press) linear' }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => handlePress(option.value)}
          className="tap rounded-pill border border-line bg-surface-hi px-6 text-label text-text"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

function MultiSelectInput({
  options,
  ariaLabel,
  onSubmit,
  onMount,
}: {
  options: { value: string; label: string }[];
  ariaLabel: string;
  onSubmit: (values: string[]) => void;
  onMount?: (element: HTMLDivElement) => void;
}): ReactElement {
  const [selected, setSelected] = useState<string[]>([]);
  const groupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (groupRef.current) {
      onMount?.(groupRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (value: string): void => {
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
    <div ref={groupRef} className="flex flex-col items-end gap-3">
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap justify-end gap-3">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(option.value)}
              data-selected={isSelected}
              className="tap rounded-pill border-2 border-line bg-surface-hi px-6 text-label text-text data-[selected=true]:border-accent"
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSubmit(selected)}
        className="tap rounded-pill bg-accent px-6 text-label text-on-accent"
      >
        Continue
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

  useEffect(() => {
    if (containerRef.current) {
      onMount?.(containerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsed = text.trim() === '' ? null : Number(text);
  const canSend = parsed !== null && Number.isFinite(parsed);

  return (
    <div ref={containerRef} className="flex items-center justify-end gap-3">
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="0"
        className="tap w-28 rounded-chip border border-line bg-surface-hi px-4 text-body text-text"
      />
      <button
        type="button"
        disabled={!canSend}
        onClick={() => canSend && onSubmit(parsed)}
        className="tap flex items-center gap-2 rounded-pill bg-accent px-6 text-label text-on-accent disabled:opacity-55"
      >
        <PaperPlaneRight size={20} weight="light" aria-hidden="true" />
        Send
      </button>
    </div>
  );
}

function TextInput({
  ariaLabel,
  onSubmit,
  onMount,
}: {
  ariaLabel: string;
  onSubmit: (value: string) => void;
  onMount?: (element: HTMLDivElement) => void;
}): ReactElement {
  const [text, setText] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      onMount?.(containerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="rounded-card border border-line bg-surface p-4">
      <label className="sr-only" aria-label={ariaLabel}>
        {ariaLabel}
      </label>
      <textarea
        aria-label={ariaLabel}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
        placeholder="Type here"
        className="w-full resize-none bg-transparent text-body text-text placeholder:text-text-muted focus:outline-none"
      />
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onSubmit(text.trim())}
          className="tap flex items-center gap-2 rounded-pill bg-accent px-6 text-label text-on-accent"
        >
          <PaperPlaneRight size={20} weight="light" aria-hidden="true" />
          Send
        </button>
      </div>
    </div>
  );
}

export interface FollowUpInputProps {
  followUp: RedFlagFollowUp;
  ariaLabel: string;
  onSubmit: (value: FollowUpAnswerValue) => void;
  onMount?: (element: HTMLDivElement) => void;
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
export function FollowUpInput({ followUp, ariaLabel, onSubmit, onMount }: FollowUpInputProps): ReactElement {
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
          ariaLabel={ariaLabel}
          onMount={onMount}
          onSubmit={(value) => onSubmit({ type: 'text', value })}
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
