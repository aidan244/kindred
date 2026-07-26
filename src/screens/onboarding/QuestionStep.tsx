/**
 * One onboarding question, rendered in whichever input its `type` calls for.
 * New questions of an existing type need no change here — only a new entry in
 * `onboardingQuestions` (src/data/clinicalContent.ts).
 *
 * ON THE HANDOFF'S GRAMMAR (why this looks the way it does). Onboarding is not
 * one of the eight handoff screens, but it is the first surface she ever sees,
 * so it speaks the same language the check-in will speak twenty minutes later.
 * Concretely, from the handoff README:
 *  - the prompt is the screen's ONE `title`; the hint under it is a muted
 *    `caption`; every option is the `label` role. Nothing composes sizes.
 *  - options are the README's answer chips (§03): min-height 56, pill,
 *    padding 0 24, bg surface-hi, 1px line — wrapping, LEFT-aligned, 12px
 *    gaps. Left rather than the conversation's right, because these are form
 *    fields on her side of a page, not her replies in a thread.
 *  - a chosen option is a 2px accent border and NOTHING ELSE. There is no
 *    tick/check glyph anywhere in this product (README, "Marks"), so the
 *    border is the whole of the selected state — see OptionChip.
 *  - the free-text field is the composer's card (§05): radius 22, 1px line,
 *    bg surface, padding 16, body placeholder in muted.
 *
 * NOTHING HERE VALIDATES. `isQuestionAnswered` only reports whether Continue
 * has something to move past; there is no error state, no required-field
 * colour and no red anywhere in this file — the emergency token exists in
 * EmergencyCall alone.
 */

import type { ReactElement } from 'react';
import { hapticTick } from '../../logic/haptics';
import {
  ONBOARDING_MULTI_SELECT_HINT,
  ONBOARDING_OPTIONAL_DETAIL_LABEL,
  ONBOARDING_OPTIONAL_DETAIL_PLACEHOLDER,
  ONBOARDING_WEEKS_UNIT,
  YES_NO_UNSURE_OPTIONS,
} from '../../data/clinicalContent';
import type {
  MultiSelectOnboardingQuestion,
  NumericOnboardingQuestion,
  OnboardingQuestion,
  YesNoUnsureOnboardingQuestion,
} from '../../data/clinicalContent';
import type { HistoryFlag, OnboardingAnswers } from '../../types';

/* Copy is imported from src/data/clinicalContent.ts, which already owned the
 * onboarding QUESTIONS — the questions and the chrome presenting them are one
 * location now rather than two. The rule is "all patient-facing copy", and
 * onboarding is the first surface she ever sees. */

export interface QuestionStepProps {
  question: OnboardingQuestion;
  answers: OnboardingAnswers;
  onChange: (next: OnboardingAnswers) => void;
}

/** Whether the given question currently has a usable answer, for gating "Continue". */
export function isQuestionAnswered(question: OnboardingQuestion, answers: OnboardingAnswers): boolean {
  if (question.type === 'numeric') {
    return answers.weeksPregnant !== null && answers.weeksPregnant > 0;
  }
  if (question.type === 'yes-no-unsure') {
    return answers.extraMonitoring.answer !== null;
  }
  return answers.history.selected.length > 0;
}

export function QuestionStep({ question, answers, onChange }: QuestionStepProps): ReactElement {
  if (question.type === 'numeric') {
    return <NumericQuestion question={question} answers={answers} onChange={onChange} />;
  }
  if (question.type === 'yes-no-unsure') {
    return <YesNoUnsureQuestion question={question} answers={answers} onChange={onChange} />;
  }
  return <MultiSelectQuestion question={question} answers={answers} onChange={onChange} />;
}

// ---------------------------------------------------------------------------
// Numeric
// ---------------------------------------------------------------------------

function NumericQuestion({
  question,
  answers,
  onChange,
}: {
  question: NumericOnboardingQuestion;
  answers: OnboardingAnswers;
  onChange: (next: OnboardingAnswers) => void;
}): ReactElement {
  const inputId = `question-${question.id}`;

  return (
    <div>
      <label htmlFor={inputId} className="text-title text-text">
        {question.prompt}
      </label>

      {/* `items-baseline`, not `items-center`: the unit sits on the number's
          baseline the same way "bpm" does beside the live figure on Home. */}
      <div className="mt-8 flex flex-wrap items-baseline gap-3">
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={45}
          step={1}
          placeholder="0"
          value={answers.weeksPregnant ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onChange({ ...answers, weeksPregnant: null });
              return;
            }
            const parsed = Number(raw);
            onChange({ ...answers, weeksPregnant: Number.isNaN(parsed) ? null : parsed });
          }}
          className="tap w-28 rounded-chip border border-line bg-surface-hi px-4 text-body text-text placeholder:text-text-muted"
        />
        <span className="text-body text-text-muted">{ONBOARDING_WEEKS_UNIT}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yes / no / not sure
// ---------------------------------------------------------------------------

function YesNoUnsureQuestion({
  question,
  answers,
  onChange,
}: {
  question: YesNoUnsureOnboardingQuestion;
  answers: OnboardingAnswers;
  onChange: (next: OnboardingAnswers) => void;
}): ReactElement {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-title text-text">{question.prompt}</legend>

      <ChipRow>
        {YES_NO_UNSURE_OPTIONS.map((option) => (
          <OptionChip
            key={option.value}
            id={`question-${question.id}-${option.value}`}
            name={`question-${question.id}`}
            inputType="radio"
            value={option.value}
            checked={answers.extraMonitoring.answer === option.value}
            label={option.label}
            onSelect={() =>
              onChange({
                ...answers,
                extraMonitoring: { ...answers.extraMonitoring, answer: option.value },
              })
            }
          />
        ))}
      </ChipRow>

      <OptionalDetailField
        id={`question-${question.id}-detail`}
        value={answers.extraMonitoring.detail}
        onChange={(detail) =>
          onChange({ ...answers, extraMonitoring: { ...answers.extraMonitoring, detail } })
        }
      />
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Multi-select
// ---------------------------------------------------------------------------

/** "None of these" is exclusive in both directions: choosing it clears
 * everything else, and choosing anything else clears it. Modelled here rather
 * than in the component so the rule is testable and stated once. */
function toggleHistoryFlag(current: HistoryFlag[], flag: HistoryFlag): HistoryFlag[] {
  if (flag === 'none-of-these') {
    return current.includes('none-of-these') ? [] : ['none-of-these'];
  }
  const withoutNone = current.filter((entry) => entry !== 'none-of-these');
  return withoutNone.includes(flag)
    ? withoutNone.filter((entry) => entry !== flag)
    : [...withoutNone, flag];
}

function MultiSelectQuestion({
  question,
  answers,
  onChange,
}: {
  question: MultiSelectOnboardingQuestion;
  answers: OnboardingAnswers;
  onChange: (next: OnboardingAnswers) => void;
}): ReactElement {
  const toggle = (flag: HistoryFlag): void => {
    onChange({
      ...answers,
      history: { ...answers.history, selected: toggleHistoryFlag(answers.history.selected, flag) },
    });
  };

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-title text-text">{question.prompt}</legend>
      <p className="mt-3 text-caption text-text-muted">{ONBOARDING_MULTI_SELECT_HINT}</p>

      <ChipRow>
        {question.options.map((option) => (
          <OptionChip
            key={option.value}
            id={`question-${question.id}-${option.value}`}
            // Each checkbox is its own control, so each carries its own name —
            // sharing one name across a checkbox group is a radio idiom.
            name={`question-${question.id}-${option.value}`}
            inputType="checkbox"
            value={option.value}
            checked={answers.history.selected.includes(option.value)}
            label={option.label}
            onSelect={() => toggle(option.value)}
          />
        ))}
      </ChipRow>

      <OptionalDetailField
        id={`question-${question.id}-detail`}
        value={answers.history.detail}
        onChange={(detail) => onChange({ ...answers, history: { ...answers.history, detail } })}
      />
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces — used by every question type above.
// ---------------------------------------------------------------------------

/** The README's answer-chip row: wrapping, left-aligned, 12px gaps. */
function ChipRow({ children }: { children: ReactElement[] }): ReactElement {
  return <div className="mt-8 flex flex-wrap gap-3">{children}</div>;
}

function OptionChip({
  id,
  name,
  inputType,
  value,
  checked,
  label,
  onSelect,
}: {
  id: string;
  name: string;
  inputType: 'radio' | 'checkbox';
  value: string;
  checked: boolean;
  label: string;
  onSelect: () => void;
}): ReactElement {
  // NO TICK GLYPH, ANYWHERE (handoff README, "Marks"). The selected state is
  // the 2px accent border and nothing else; the native input underneath still
  // carries `checked` for assistive tech, so nothing is lost by not drawing a
  // mark that the product has decided does not exist.
  //
  // That 2px is built as a 1px accent border PLUS a 1px inset ring rather
  // than by swapping `border` for `border-2`: a chip that grows by 1px on
  // selection can re-wrap the whole row under her thumb. Same drawn weight,
  // no reflow. An inset box-shadow rather than an outline, so it can never
  // collide with the global 2px focus-visible outline.
  return (
    <label
      htmlFor={id}
      data-checked={checked}
      className="press tap relative flex items-center justify-center rounded-pill border border-line bg-surface-hi px-6 text-center text-label text-text data-[checked=true]:border-accent data-[checked=true]:shadow-[inset_0_0_0_1px_var(--accent)]"
    >
      {/* The real control, laid transparently over the whole chip so the hit
          area is the chip and the focus ring follows its shape. */}
      <input
        id={id}
        name={name}
        type={inputType}
        value={value}
        checked={checked}
        onChange={() => {
          // The product's one haptic, on chip select (README,
          // motion_and_accessibility). Never on a call control.
          hapticTick();
          onSelect();
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-pill opacity-0"
      />
      <span className="pointer-events-none">{label}</span>
    </label>
  );
}

/**
 * The optional free-text field, in the composer's card (README §05).
 *
 * The field GROWS with what she writes: a hidden sizer holding the same text
 * shares one grid cell with the textarea, so the browser re-lays the box out
 * for free on a width, font or text-scale change. Same construction as
 * src/components/Composer.tsx — the invariant it exists for ("no fixed-height
 * text containers, no truncation") is the same one, and a `rows={3}` box that
 * scrolls its own contents at 200% text is exactly what it forbids.
 *
 * The sizer falls back to the placeholder while the field is empty, so the
 * resting height is whatever the placeholder actually needs at her text size.
 * The trailing space keeps a final newline from collapsing.
 */
function OptionalDetailField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
}): ReactElement {
  return (
    <div className="mt-6">
      <label htmlFor={id} className="text-label text-text">
        {ONBOARDING_OPTIONAL_DETAIL_LABEL}
      </label>
      <div className="mt-3 grid w-full rounded-card border border-line bg-surface p-4">
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 text-body"
          style={{ whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}
        >
          {value.length > 0 ? `${value} ` : ONBOARDING_OPTIONAL_DETAIL_PLACEHOLDER}
        </span>
        <textarea
          id={id}
          rows={1}
          placeholder={ONBOARDING_OPTIONAL_DETAIL_PLACEHOLDER}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="tap col-start-1 row-start-1 w-full resize-none overflow-hidden bg-transparent text-body text-text placeholder:text-text-muted"
          style={{ overflowWrap: 'break-word' }}
        />
      </div>
    </div>
  );
}
