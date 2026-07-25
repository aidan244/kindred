/**
 * One screen of the red-flag questionnaire (triage flow, phase a). Renders
 * a single question from src/data/clinicalContent.ts, a yes/no choice, and
 * an optional inline "add detail" field. Question text is never hardcoded
 * here — it always comes from the data module so the question set can be
 * swapped without touching this component.
 */

import { useState, type ReactElement } from 'react';
import { Check, NotePencil } from '@phosphor-icons/react';
import type { RedFlagAnswer, RedFlagQuestion } from '../../types';

export interface RedFlagStepProps {
  question: RedFlagQuestion;
  answer: RedFlagAnswer | undefined;
  onSelect: (answer: 'yes' | 'no') => void;
  onDetailChange: (detail: string) => void;
}

export function RedFlagStep({
  question,
  answer,
  onSelect,
  onDetailChange,
}: RedFlagStepProps): ReactElement {
  const [detailOpen, setDetailOpen] = useState((answer?.detail ?? '').length > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title">Check in</h1>
        <p className="text-lead">{question.question}</p>
      </div>

      <div
        role="group"
        aria-label={question.question}
        className="flex flex-col gap-3 sm:flex-row"
      >
        {(['yes', 'no'] as const).map((option) => {
          const selected = answer?.answer === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(option)}
              className={`tap flex flex-1 items-center justify-center gap-2 rounded-pill px-6 text-label ${
                selected
                  ? 'border-2 border-accent bg-surface-hi text-text'
                  : 'border border-line bg-surface text-text'
              }`}
            >
              {selected && <Check size={18} weight="light" aria-hidden="true" />}
              <span>{option === 'yes' ? 'Yes' : 'No'}</span>
            </button>
          );
        })}
      </div>

      {answer !== undefined && (
        <div className="flex flex-col gap-3">
          {!detailOpen ? (
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="tap flex w-fit items-center gap-2 px-2 text-label text-accent"
            >
              <NotePencil size={20} weight="light" aria-hidden="true" />
              Add detail
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-caption text-text-muted" htmlFor="red-flag-detail">
                Anything you want to add about this
              </label>
              <textarea
                id="red-flag-detail"
                value={answer.detail ?? ''}
                onChange={(event) => onDetailChange(event.target.value)}
                rows={3}
                className="w-full rounded-chip border border-line bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted"
                placeholder="Optional"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
