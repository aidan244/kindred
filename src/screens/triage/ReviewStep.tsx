/**
 * Triage flow phase c: shows exactly what will be sent to the clinic, in
 * plain language, before she sends it. One card per category — the gate
 * question and her answer, each answered follow-up with its answer, any
 * detail text or voice note — with an "Edit" control per card that returns
 * to the conversation and re-asks that category's gate in place (§14.7).
 *
 * Deliberately NOT a transcript (design-plan.md §14.8): current state only,
 * so it can be scanned in a few seconds rather than read. This screen is
 * never reached on a hard-stop path (review is skipped entirely per
 * held-build-brief.md placeholder_content's hard-stop rule), so unlike the
 * PDF (src/logic/reportPdf.ts) it never needs to render "not asked — ended
 * early" wording — every category here was genuinely walked.
 *
 * EDIT GRANULARITY (see CheckInConversation.tsx's header comment): "Edit"
 * re-asks the category's gate question, not an individual follow-up. That
 * mirrors this screen's own one-card-per-category shape.
 */

import type { ReactElement } from 'react';
import { NotePencil } from '@phosphor-icons/react';
import { redFlagCategories } from '../../data/clinicalContent';
import { formatFollowUpAnswerValue } from './FollowUpInput';
import { VoiceNoteAttachmentRow } from '../../components/VoiceNoteBubble';
import type { CategoryAnswer, VoiceNote } from '../../types';

export interface ReviewStepProps {
  answers: CategoryAnswer[];
  description: string;
  voiceNote: VoiceNote | null;
  onEditCategory: (categoryId: string) => void;
  onEditDescription: () => void;
  onSend: () => void;
}

function gateAnswerLabel(answer: 'yes' | 'no'): string {
  return answer === 'yes' ? 'Yes' : 'No';
}

export function ReviewStep({
  answers,
  description,
  voiceNote,
  onEditCategory,
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
        {redFlagCategories.map((category) => {
          const answer = answers.find((a) => a.categoryId === category.id);
          return (
            <div key={category.id} className="rounded-card bg-surface p-[22px]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-body text-text">{category.gateQuestion}</p>
                  <p className="text-label text-text">
                    {answer ? gateAnswerLabel(answer.gateAnswer) : 'Not answered'}
                  </p>

                  {category.additionalGateQuestions?.map((prompt, index) => {
                    const value = answer?.additionalGateAnswers?.[index];
                    if (value === undefined) {
                      return null;
                    }
                    return (
                      <p key={prompt} className="mt-2 text-caption text-text-muted">
                        {prompt} — {gateAnswerLabel(value)}
                      </p>
                    );
                  })}

                  {answer?.gateAnswer === 'yes' &&
                    category.followUps.map((followUp) => {
                      const fuAnswer = answer.followUpAnswers.find((f) => f.followUpId === followUp.id);
                      if (!fuAnswer) {
                        return null;
                      }
                      return (
                        <p key={followUp.id} className="mt-2 text-caption text-text-muted">
                          {followUp.prompt} — {formatFollowUpAnswerValue(fuAnswer.value, followUp.options)}
                        </p>
                      );
                    })}

                  {answer?.detail && <p className="mt-2 text-caption text-text-muted">{answer.detail}</p>}
                  {answer?.voiceNote && (
                    <div className="mt-3">
                      <VoiceNoteAttachmentRow voiceNote={answer.voiceNote} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onEditCategory(category.id)}
                  aria-label={`Edit answer to: ${category.gateQuestion}`}
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
              <p className="text-label text-text">What you added in your own words</p>
              <p className="text-body text-text-muted">{description || 'Nothing added'}</p>
              {voiceNote && (
                <div className="mt-3">
                  <VoiceNoteAttachmentRow voiceNote={voiceNote} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onEditDescription}
              aria-label="Edit what you added in your own words"
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
