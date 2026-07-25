/**
 * Triage flow phase c: shows exactly what will be sent to the clinic, in
 * plain language, before she sends it. Every question, her answer and any
 * detail she added, plus her free-text description — each with a way to
 * jump back and edit it directly, rather than replaying the whole flow.
 */

import type { ReactElement } from 'react';
import { NotePencil } from '@phosphor-icons/react';
import { redFlagQuestions } from '../../data/clinicalContent';
import type { RedFlagAnswer } from '../../types';

export interface ReviewStepProps {
  answers: RedFlagAnswer[];
  description: string;
  onEditQuestion: (index: number) => void;
  onEditDescription: () => void;
  onSend: () => void;
}

function answerLabel(answer: 'yes' | 'no'): string {
  return answer === 'yes' ? 'Yes' : 'No';
}

export function ReviewStep({
  answers,
  description,
  onEditQuestion,
  onEditDescription,
  onSend,
}: ReviewStepProps): ReactElement {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title">Check everything</h1>
        <p className="text-lead">This is what goes to your clinic. You can change any answer.</p>
      </div>

      <div className="flex flex-col gap-4">
        {redFlagQuestions.map((question, index) => {
          const answer = answers.find((a) => a.questionId === question.id);
          return (
            <div key={question.id} className="rounded-card bg-surface p-[22px]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-body text-text">{question.question}</p>
                  <p className="text-label text-text">
                    {answer ? answerLabel(answer.answer) : 'Not answered'}
                  </p>
                  {answer?.detail && (
                    <p className="text-caption text-text-muted">{answer.detail}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onEditQuestion(index)}
                  aria-label={`Edit answer to: ${question.question}`}
                  className="tap flex shrink-0 items-center gap-1 px-2 text-label text-accent"
                >
                  <NotePencil size={20} weight="light" aria-hidden="true" />
                  Edit
                </button>
              </div>
            </div>
          );
        })}

        <div className="rounded-card bg-surface p-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-label text-text">What you told us in your own words</p>
              <p className="text-body text-text-muted">{description || 'Nothing added'}</p>
            </div>
            <button
              type="button"
              onClick={onEditDescription}
              aria-label="Edit what you told us in your own words"
              className="tap flex shrink-0 items-center gap-1 px-2 text-label text-accent"
            >
              <NotePencil size={20} weight="light" aria-hidden="true" />
              Edit
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSend}
        className="tap w-full rounded-pill bg-accent px-6 text-label text-on-accent"
      >
        Send to the clinic
      </button>
    </div>
  );
}
