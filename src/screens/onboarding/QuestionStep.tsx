import type { ReactElement } from 'react';
import type {
  MultiSelectOnboardingQuestion,
  NumericOnboardingQuestion,
  OnboardingQuestion,
  YesNoUnsureOnboardingQuestion,
} from '../../data/clinicalContent';
import type { HistoryFlag, OnboardingAnswers, YesNoUnsure } from '../../types';

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

/**
 * Renders whichever input the question's `type` calls for. New questions of
 * an existing type need no changes here — only a new entry in
 * `onboardingQuestions` (src/data/clinicalContent.ts).
 */
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
      <div className="mt-8 flex items-center gap-3 rounded-chip">
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
          className="tap w-28 rounded-chip border border-line bg-surface-hi px-4 text-body text-text"
        />
        <span className="text-body text-text-muted">weeks</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yes / no / not sure
// ---------------------------------------------------------------------------

const YES_NO_UNSURE_OPTIONS: { value: YesNoUnsure; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not-sure', label: 'Not sure' },
];

function YesNoUnsureQuestion({
  question,
  answers,
  onChange,
}: {
  question: YesNoUnsureOnboardingQuestion;
  answers: OnboardingAnswers;
  onChange: (next: OnboardingAnswers) => void;
}): ReactElement {
  const detailId = `question-${question.id}-detail`;

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-title text-text">{question.prompt}</legend>

      <div className="mt-8 flex flex-wrap gap-3">
        {YES_NO_UNSURE_OPTIONS.map((option) => (
          <OptionPill
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
      </div>

      <div className="mt-6">
        <label htmlFor={detailId} className="text-label text-text">
          Anything you&rsquo;d like to add (optional)
        </label>
        <div className="mt-3 rounded-chip">
          <textarea
            id={detailId}
            rows={3}
            placeholder="Share as much or as little as you want"
            value={answers.extraMonitoring.detail}
            onChange={(event) =>
              onChange({
                ...answers,
                extraMonitoring: { ...answers.extraMonitoring, detail: event.target.value },
              })
            }
            className="w-full resize-none rounded-chip border border-line bg-surface-hi p-4 text-body text-text"
          />
        </div>
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Multi-select
// ---------------------------------------------------------------------------

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
  const detailId = `question-${question.id}-detail`;

  const toggle = (flag: HistoryFlag): void => {
    onChange({ ...answers, history: { ...answers.history, selected: toggleHistoryFlag(answers.history.selected, flag) } });
  };

  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-title text-text">{question.prompt}</legend>
      <p className="mt-3 text-body text-text-muted">Select all that apply.</p>

      <div className="mt-8 flex flex-wrap gap-3">
        {question.options.map((option) => (
          <OptionPill
            key={option.value}
            id={`question-${question.id}-${option.value}`}
            name={`question-${question.id}-${option.value}`}
            inputType="checkbox"
            value={option.value}
            checked={answers.history.selected.includes(option.value)}
            label={option.label}
            onSelect={() => toggle(option.value)}
          />
        ))}
      </div>

      <div className="mt-6">
        <label htmlFor={detailId} className="text-label text-text">
          Anything you&rsquo;d like to add (optional)
        </label>
        <div className="mt-3 rounded-chip">
          <textarea
            id={detailId}
            rows={3}
            placeholder="Share as much or as little as you want"
            value={answers.history.detail}
            onChange={(event) =>
              onChange({ ...answers, history: { ...answers.history, detail: event.target.value } })
            }
            className="w-full resize-none rounded-chip border border-line bg-surface-hi p-4 text-body text-text"
          />
        </div>
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Shared selectable pill — used by both single-select and multi-select above.
// ---------------------------------------------------------------------------

function OptionPill({
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
  // design-plan.md §6.1 (amended): `Check` no longer appears anywhere in the
  // product. Selection here is the border/fill treatment alone — already
  // the §9.4-mandated "selected" state (2px border-accent + bg-surface-hi)
  // — so removing the tick glyph loses no information; the input's own
  // native checked state still carries it for assistive tech.
  return (
    <label
      htmlFor={id}
      data-checked={checked}
      className="tap relative flex min-w-[104px] flex-1 items-center justify-center gap-2 rounded-pill border-2 border-transparent bg-surface px-4 text-label text-text data-[checked=true]:border-accent data-[checked=true]:bg-surface-hi"
    >
      <input
        id={id}
        name={name}
        type={inputType}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-pill opacity-0"
      />
      <span className="pointer-events-none">{label}</span>
    </label>
  );
}
