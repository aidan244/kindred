/**
 * The conversational check-in surface (design-plan.md §14, amended for the
 * six-category schema in held-build-brief.md placeholder_content). Renders
 * the red-flag questionnaire and the closing free-text beat as one
 * continuous, scrolling exchange of bubbles.
 *
 * GATE DECISION: this is a generalisation of the existing per-question
 * conversation, not a rebuild from scratch. The idioms that already existed
 * — Beat's delayed reveal, a monotonic "how far has the conversation been
 * unlocked" high-water mark, a chip row that fades and hands its value to
 * her bubble, a detail beat gated on "was this answer the one that needs
 * more" — all generalise cleanly from "one flat question" to "one category,
 * which may itself contain several follow-up questions of different types"
 * without contradicting any of their original assumptions. What is
 * genuinely new: (1) a category can expand into a variable-length run of
 * follow-up beats before its detail beat, driven entirely by
 * `RedFlagCategory.followUps` (src/data/clinicalContent.ts) — see
 * `renderFollowUps`; (2) the hard-stop interrupt, which is a new early-exit
 * branch in the gate-answer handlers, not a change to how anything renders;
 * (3) the cross-category overlap recap, a read-only caption computed from
 * already-recorded answers (`overlapRecap`, src/data/clinicalContent.ts).
 *
 * What changes: the feel. What does not change: anything that decides
 * anything. Category and follow-up text is verbatim from `redFlagCategories`;
 * `disposition()` and `getEscalationTier()` are untouched by this file —
 * they read `categoryAnswers` from context after this component writes to
 * it, using the same shapes those already had.
 *
 * EDIT GRANULARITY (documented scope decision): "Change this" exists for a
 * category's gate question and for each of its follow-ups independently —
 * but there is no partial-category edit UI beyond that. Editing a gate to
 * the SAME value it already had changes nothing (her follow-ups and detail
 * stay exactly as they were). Editing it to a DIFFERENT value resets that
 * category's follow-up answers (a 'no' category structurally has none —
 * held-build-brief.md's rendering rule) but preserves any detail text or
 * voice note she already gave, per design-plan.md §14.7's "never delete
 * something she said because she changed a checkbox" — the one place this
 * file deliberately keeps that rule despite the schema change underneath it.
 *
 * State ownership: `categoryAnswers` / `triageDescription` / `triageVoiceNote`
 * live in AppStateContext, as before. Presentation-only flags that
 * TriageFlow's header (the progress rail) and ReviewStep's "Edit" controls
 * also need to see are lifted to TriageFlow and passed down as props —
 * see CheckInConversationProps below.
 */

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react';
import { revokeVoiceNoteUrl, useAppState } from '../../context/AppStateContext';
import {
  CHECK_IN_CLOSING_ACK,
  CHECK_IN_CLOSING_INVITE,
  CHECK_IN_DETAIL_HINT,
  CHECK_IN_DETAIL_INVITE,
  CHECK_IN_FIRST_ACK,
  CHECK_IN_HARD_STOP_CLOSING_ACK,
  CHECK_IN_OPENING,
  CHECK_IN_RETURN_TO_EMERGENCY_LABEL,
  overlapRecap,
  redFlagCategories,
  type RedFlagCategory,
} from '../../data/clinicalContent';
import { hasHardStopFired } from '../../logic/escalationTier';
import { usePrefersReducedMotion } from '../../components/usePrefersReducedMotion';
import { VoiceNoteBubble } from '../../components/VoiceNoteBubble';
import { Beat } from './Beat';
import { DetailBeat } from './DetailBeat';
import { FollowUpInput, TapChipRow, formatFollowUpAnswerValue } from './FollowUpInput';
import type { CategoryAnswer, FollowUpAnswerValue, VoiceNote, YesNo } from '../../types';

/** Mirrors `--dur-beat` (tokens.css) — the silent pause between messages
 * (§14.5), same pattern LiveSurface.tsx uses for DUR_SETTLE_MS. */
const BEAT_MS = 700;
/** A chip row / composer follows its bot message by this much (§14.5). */
const CHIP_DELAY_MS = 220;

const YES_NO_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

export interface BackRequest {
  nonce: number;
  categoryId: string;
}

export interface CheckInConversationProps {
  dockRef: RefObject<HTMLDivElement | null>;
  reaskCategoryId: string | null;
  onChangeThisGate: (categoryId: string) => void;
  onGateReaskResolved: () => void;
  /** `${categoryId}::${followUpId}` — see the header comment's "edit
   * granularity" note. */
  reaskFollowUpKey: string | null;
  onChangeThisFollowUp: (categoryId: string, followUpId: string) => void;
  onFollowUpReaskResolved: () => void;
  closingReask: boolean;
  onClosingReaskResolved: () => void;
  skippedDetailFor: Set<string>;
  setSkippedDetailFor: Dispatch<SetStateAction<Set<string>>>;
  closingSkipped: boolean;
  setClosingSkipped: Dispatch<SetStateAction<boolean>>;
  onReachedReview: () => void;
  /** Fired by "Change this" (gate flips to yes) or an additional gate
   * question (either answered yes) on a hard-stop category — see
   * TriageFlow.tsx's `handleHardStop`. */
  onHardStop: (finalAnswer: CategoryAnswer) => void;
  /** The end of the closing beat, when a hard stop already fired this
   * session (design-plan.md-style "quiet way to add more" —
   * held-build-brief.md placeholder_content "Hard-stop rule"): there is no
   * review to send her to, so this returns straight to the outcome screen
   * instead. */
  onReturnToEmergencyOutcome: () => void;
  backRequest: BackRequest | null;
}

function BotBubble({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="mr-auto max-w-[85%] bg-surface p-4 text-body text-text"
      style={{ borderRadius: 'var(--r-card) var(--r-card) var(--r-card) var(--r-chip)' }}
    >
      {children}
    </div>
  );
}

function HerBubble({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="ml-auto max-w-[85%] bg-surface-hi p-4 text-body text-text"
      style={{ borderRadius: 'var(--r-card) var(--r-card) var(--r-chip) var(--r-card)' }}
    >
      {children}
    </div>
  );
}

function ChangeThisButton({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Change your answer to: ${label}`}
      className="tap self-end px-2 text-caption text-accent"
    >
      Change this
    </button>
  );
}

/** A category is "substantively resolved" once there is nothing left to ask
 * for it this pass — used both to advance the high-water mark and to gate
 * the once-only "first ack" line. Deliberately ignores any in-flight reask;
 * callers that need to freeze progress during a reask check that
 * separately (see the unlocking effect below), because a resolved category
 * being re-examined is still, substantively, resolved. */
function isCategoryResolved(
  category: RedFlagCategory,
  answer: CategoryAnswer | undefined,
  skippedDetailFor: Set<string>
): boolean {
  if (!answer) {
    return false;
  }
  if (category.hardStop) {
    if (answer.gateAnswer === 'yes') {
      return true;
    }
    if (answer.additionalGateAnswers?.includes('yes')) {
      return true;
    }
    const needed = category.additionalGateQuestions?.length ?? 0;
    return (answer.additionalGateAnswers?.length ?? 0) >= needed;
  }
  if (answer.gateAnswer === 'no') {
    return true;
  }
  if (answer.followUpAnswers.length < category.followUps.length) {
    return false;
  }
  const hasContent = Boolean(answer.detail) || Boolean(answer.voiceNote);
  return hasContent || skippedDetailFor.has(category.id);
}

/** Whether the gate question itself (as opposed to the whole category) is
 * done being asked — i.e. whether "Change this" may render on it yet. For a
 * hard-stop category this means every additional gate question has also
 * been asked; for every other category the gate is a single yes/no
 * question, so it is complete the moment it has an answer at all —
 * deliberately independent of whether her follow-ups/detail beat are done,
 * so she can correct a gate answer without first finishing the rest of the
 * category. */
function gateSequenceComplete(category: RedFlagCategory, answer: CategoryAnswer | undefined): boolean {
  if (!answer) {
    return false;
  }
  if (!category.hardStop) {
    return true;
  }
  if (answer.gateAnswer === 'yes' || answer.additionalGateAnswers?.includes('yes')) {
    return true;
  }
  const needed = category.additionalGateQuestions?.length ?? 0;
  return (answer.additionalGateAnswers?.length ?? 0) >= needed;
}

export function CheckInConversation({
  dockRef,
  reaskCategoryId,
  onChangeThisGate,
  onGateReaskResolved,
  reaskFollowUpKey,
  onChangeThisFollowUp,
  onFollowUpReaskResolved,
  closingReask,
  onClosingReaskResolved,
  skippedDetailFor,
  setSkippedDetailFor,
  closingSkipped,
  setClosingSkipped,
  onReachedReview,
  onHardStop,
  onReturnToEmergencyOutcome,
  backRequest,
}: CheckInConversationProps): ReactElement {
  const {
    categoryAnswers,
    setCategoryAnswers,
    triageDescription,
    setTriageDescription,
    triageVoiceNote,
    setTriageVoiceNote,
  } = useAppState();
  const reduced = usePrefersReducedMotion();
  const lastRevealedElRef = useRef<HTMLElement | null>(null);

  const findAnswer = (categoryId: string): CategoryAnswer | undefined =>
    categoryAnswers.find((a) => a.categoryId === categoryId);

  // A monotonic high-water mark of how far the conversation has ever been
  // reached — slot i (0-indexed) is "category i is visible", and slot
  // redFlagCategories.length is "the closing beat is visible". See
  // CheckInConversation's predecessor for the original rationale (§14.7);
  // unchanged here except "question" -> "category".
  const TOTAL_SLOTS = redFlagCategories.length + 1;
  const [unlockedCategoryCount, setUnlockedCategoryCount] = useState(1);

  useEffect(() => {
    setUnlockedCategoryCount((current) => {
      let next = current;
      while (next < TOTAL_SLOTS) {
        const category = redFlagCategories[next - 1];
        if (reaskCategoryId === category.id) {
          break;
        }
        if (reaskFollowUpKey?.startsWith(`${category.id}::`)) {
          break;
        }
        const answer = findAnswer(category.id);
        if (!isCategoryResolved(category, answer, skippedDetailFor)) {
          break;
        }
        next += 1;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryAnswers, skippedDetailFor, reaskCategoryId, reaskFollowUpKey]);

  useEffect(() => {
    if (!backRequest) {
      return;
    }
    const poppedIndex = redFlagCategories.findIndex((c) => c.id === backRequest.categoryId);
    if (poppedIndex === -1) {
      return;
    }
    setUnlockedCategoryCount((current) => Math.min(current, poppedIndex + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backRequest?.nonce]);

  // Auto-scroll (§14.6): unchanged from the predecessor.
  const handleReveal = (el: HTMLDivElement): void => {
    const dockEl = dockRef.current;
    if (dockEl) {
      const restLine = dockEl.getBoundingClientRect().top - 24;
      const prev = lastRevealedElRef.current;
      const suppressed = prev ? prev.getBoundingClientRect().bottom - restLine > 48 : false;
      if (!suppressed) {
        const delta = el.getBoundingClientRect().bottom - restLine;
        if (delta > 0) {
          window.scrollTo({ top: window.scrollY + delta, behavior: reduced ? 'auto' : 'smooth' });
        }
      }
    }
    lastRevealedElRef.current = el;
  };

  const handleChipRowReveal = (el: HTMLDivElement): void => {
    handleReveal(el);
    el.querySelector<HTMLButtonElement>('button')?.focus();
  };

  // ---------------------------------------------------------------------
  // Gate answers (primary + the collapse category's additional gate)
  // ---------------------------------------------------------------------

  const handleGateAnswer = (category: RedFlagCategory, value: YesNo, isReask: boolean): void => {
    const existing = findAnswer(category.id);

    if (isReask && existing && existing.gateAnswer === value) {
      // No actual change — resolve the reask, keep everything exactly as it
      // was (design-plan.md §14.7's "never delete something she said").
      onGateReaskResolved();
      return;
    }

    if (category.hardStop && value === 'yes') {
      const finalAnswer: CategoryAnswer = {
        categoryId: category.id,
        gateAnswer: 'yes',
        additionalGateAnswers: existing?.additionalGateAnswers ?? [],
        followUpAnswers: [],
      };
      setCategoryAnswers([...categoryAnswers.filter((a) => a.categoryId !== category.id), finalAnswer]);
      onHardStop(finalAnswer);
      return;
    }

    const wasYes = existing?.gateAnswer === 'yes';
    const next: CategoryAnswer = {
      categoryId: category.id,
      gateAnswer: value,
      additionalGateAnswers: [],
      // A 'no' category structurally has no follow-ups (rendering rule). A
      // fresh 'yes' (from 'no', or brand new) starts its follow-up sequence
      // clean. Only a 'yes' that WAS already 'yes' keeps them — but that
      // case already returned above.
      followUpAnswers: value === 'no' || !wasYes ? [] : existing.followUpAnswers,
      detail: value === 'no' ? existing?.detail : wasYes ? existing?.detail : undefined,
      voiceNote: value === 'no' ? existing?.voiceNote : wasYes ? existing?.voiceNote : undefined,
    };
    setCategoryAnswers([...categoryAnswers.filter((a) => a.categoryId !== category.id), next]);
    if (isReask) {
      onGateReaskResolved();
    }
    if (value === 'yes') {
      // A fresh yes with no existing content reopens the detail beat once
      // follow-ups complete — clear any stale skip marker.
      setSkippedDetailFor((prev) => {
        if (!prev.has(category.id)) {
          return prev;
        }
        const copy = new Set(prev);
        copy.delete(category.id);
        return copy;
      });
    }
  };

  const handleAdditionalGateAnswer = (category: RedFlagCategory, index: number, value: YesNo): void => {
    const existing = findAnswer(category.id);
    if (!existing) {
      return;
    }
    const priorAdditional = (existing.additionalGateAnswers ?? []).slice(0, index);

    if (value === 'yes') {
      const finalAnswer: CategoryAnswer = {
        ...existing,
        additionalGateAnswers: [...priorAdditional, 'yes'],
      };
      setCategoryAnswers([...categoryAnswers.filter((a) => a.categoryId !== category.id), finalAnswer]);
      onHardStop(finalAnswer);
      return;
    }

    const nextAnswer: CategoryAnswer = { ...existing, additionalGateAnswers: [...priorAdditional, 'no'] };
    setCategoryAnswers([...categoryAnswers.filter((a) => a.categoryId !== category.id), nextAnswer]);
  };

  // ---------------------------------------------------------------------
  // Follow-ups
  // ---------------------------------------------------------------------

  const handleFollowUpAnswer = (
    category: RedFlagCategory,
    followUpId: string,
    value: FollowUpAnswerValue,
    isReask: boolean
  ): void => {
    const existing = findAnswer(category.id);
    if (!existing) {
      return;
    }
    const alreadyAnswered = existing.followUpAnswers.some((f) => f.followUpId === followUpId);
    const nextFollowUpAnswers = alreadyAnswered
      ? existing.followUpAnswers.map((f) => (f.followUpId === followUpId ? { followUpId, value } : f))
      : [...existing.followUpAnswers, { followUpId, value }];
    setCategoryAnswers(
      categoryAnswers.map((a) =>
        a.categoryId === category.id ? { ...a, followUpAnswers: nextFollowUpAnswers } : a
      )
    );
    if (isReask) {
      onFollowUpReaskResolved();
    }
  };

  // ---------------------------------------------------------------------
  // Category detail beat (design-plan.md §15, generalised per category)
  // ---------------------------------------------------------------------

  const handleCategoryDetailSend = (category: RedFlagCategory, text: string, voiceNote: VoiceNote | null): void => {
    setCategoryAnswers(
      categoryAnswers.map((a) =>
        a.categoryId === category.id ? { ...a, detail: text || undefined, voiceNote: voiceNote ?? undefined } : a
      )
    );
  };

  const handleCategoryDetailSkip = (categoryId: string): void => {
    setSkippedDetailFor((prev) => new Set(prev).add(categoryId));
  };

  // ---------------------------------------------------------------------
  // Closing free-text beat — unchanged from the predecessor.
  // ---------------------------------------------------------------------

  const handleClosingSend = (text: string, voiceNote: VoiceNote | null): void => {
    setTriageDescription(text);
    if (triageVoiceNote && triageVoiceNote !== voiceNote) {
      revokeVoiceNoteUrl(triageVoiceNote);
    }
    setTriageVoiceNote(voiceNote);
    setClosingSkipped(false);
    onClosingReaskResolved();
  };

  const handleClosingSkip = (): void => {
    revokeVoiceNoteUrl(triageVoiceNote);
    setTriageDescription('');
    setTriageVoiceNote(null);
    setClosingSkipped(true);
    onClosingReaskResolved();
  };

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  function renderAdditionalGates(category: RedFlagCategory, answer: CategoryAnswer): ReactNode {
    if (!category.hardStop || !category.additionalGateQuestions || answer.gateAnswer !== 'no') {
      return null;
    }
    const answered = answer.additionalGateAnswers ?? [];
    return category.additionalGateQuestions.map((prompt, index) => {
      if (index > answered.length) {
        return null;
      }
      const isNext = index === answered.length;
      return (
        <div key={`ag-${category.id}-${index}`} className="flex flex-col gap-4">
          <Beat key={`ag-${category.id}-${index}-q`} delayMs={BEAT_MS} reduced={reduced} onReveal={handleReveal}>
            <BotBubble>{prompt}</BotBubble>
          </Beat>
          {isNext ? (
            <Beat
              key={`ag-${category.id}-${index}-chips`}
              delayMs={BEAT_MS + CHIP_DELAY_MS}
              reduced={reduced}
              onReveal={handleChipRowReveal}
            >
              <TapChipRow
                options={YES_NO_OPTIONS}
                ariaLabel={prompt}
                onSelect={(value) => handleAdditionalGateAnswer(category, index, value as YesNo)}
              />
            </Beat>
          ) : (
            <Beat key={`ag-${category.id}-${index}-her`} delayMs={0} reduced={reduced} onReveal={handleReveal}>
              <HerBubble>{answered[index] === 'yes' ? 'Yes' : 'No'}</HerBubble>
            </Beat>
          )}
        </div>
      );
    });
  }

  function renderFollowUps(category: RedFlagCategory, answer: CategoryAnswer): ReactNode {
    return category.followUps.map((followUp, index) => {
      if (index > answer.followUpAnswers.length) {
        return null;
      }
      const fuAnswer = answer.followUpAnswers.find((f) => f.followUpId === followUp.id);
      const reaskKey = `${category.id}::${followUp.id}`;
      const isReasking = reaskFollowUpKey === reaskKey;
      const recap = followUp.overlapsWith && !fuAnswer ? overlapRecap(followUp.overlapsWith, categoryAnswers) : null;

      return (
        <div key={`fu-${followUp.id}`} className="flex flex-col gap-4">
          <Beat key={`fu-${followUp.id}-q`} delayMs={BEAT_MS} reduced={reduced} onReveal={handleReveal}>
            <BotBubble>
              <div className="flex flex-col gap-2">
                <span>{followUp.prompt}</span>
                {recap && <span className="text-caption text-text-muted">{recap}</span>}
              </div>
            </BotBubble>
          </Beat>

          {isReasking && (
            <FollowUpInput
              followUp={followUp}
              ariaLabel={followUp.prompt}
              onMount={handleChipRowReveal}
              onSubmit={(value) => handleFollowUpAnswer(category, followUp.id, value, true)}
            />
          )}

          {!isReasking && !fuAnswer && (
            <Beat
              key={`fu-${followUp.id}-input`}
              delayMs={BEAT_MS + CHIP_DELAY_MS}
              reduced={reduced}
              onReveal={handleChipRowReveal}
            >
              <FollowUpInput
                followUp={followUp}
                ariaLabel={followUp.prompt}
                onSubmit={(value) => handleFollowUpAnswer(category, followUp.id, value, false)}
              />
            </Beat>
          )}

          {!isReasking && fuAnswer && (
            <>
              <Beat key={`fu-${followUp.id}-her`} delayMs={0} reduced={reduced} onReveal={handleReveal}>
                <HerBubble>{formatFollowUpAnswerValue(fuAnswer.value, followUp.options)}</HerBubble>
              </Beat>
              <ChangeThisButton
                label={followUp.prompt}
                onClick={() => onChangeThisFollowUp(category.id, followUp.id)}
              />
            </>
          )}
        </div>
      );
    });
  }

  function renderDetailBeat(category: RedFlagCategory, answer: CategoryAnswer): ReactNode {
    const hasContent = Boolean(answer.detail) || Boolean(answer.voiceNote);
    const resolved = hasContent || skippedDetailFor.has(category.id);

    if (!resolved) {
      return (
        <>
          <Beat
            key={`${category.id}-detail-invite`}
            delayMs={BEAT_MS}
            reduced={reduced}
            onReveal={handleReveal}
          >
            <BotBubble>
              <div className="flex flex-col gap-2">
                <span>{CHECK_IN_DETAIL_INVITE}</span>
                <span className="text-caption text-text-muted">{CHECK_IN_DETAIL_HINT}</span>
              </div>
            </BotBubble>
          </Beat>
          <Beat
            key={`${category.id}-detail-composer`}
            delayMs={BEAT_MS + CHIP_DELAY_MS}
            reduced={reduced}
            onReveal={handleReveal}
          >
            <DetailBeat
              id={`c-${category.id}`}
              skipLabel="Skip this"
              onSend={(text, voiceNote) => handleCategoryDetailSend(category, text, voiceNote)}
              onSkip={() => handleCategoryDetailSkip(category.id)}
            />
          </Beat>
        </>
      );
    }

    return (
      <>
        {answer.detail && (
          <Beat key={`${category.id}-detail-text`} delayMs={0} reduced={reduced} onReveal={handleReveal}>
            <HerBubble>{answer.detail}</HerBubble>
          </Beat>
        )}
        {answer.voiceNote && (
          <Beat key={`${category.id}-voicenote`} delayMs={0} reduced={reduced} onReveal={handleReveal}>
            <VoiceNoteBubble voiceNote={answer.voiceNote} />
          </Beat>
        )}
      </>
    );
  }

  function renderCategoryBlock(category: RedFlagCategory, index: number): ReactElement | null {
    if (index >= unlockedCategoryCount) {
      return null;
    }
    const answer = findAnswer(category.id);
    const isReaskingGate = reaskCategoryId === category.id;
    const firstCategory = redFlagCategories[0];
    const followsFirstAck =
      index === 1 && isCategoryResolved(firstCategory, findAnswer(firstCategory.id), skippedDetailFor);
    const gateBubbleDelay = followsFirstAck ? BEAT_MS * 2 : BEAT_MS;

    return (
      <div key={`c-${category.id}`} className="flex flex-col gap-4">
        <Beat key={`c-${category.id}-gate`} delayMs={gateBubbleDelay} reduced={reduced} onReveal={handleReveal}>
          <BotBubble>{category.gateQuestion}</BotBubble>
        </Beat>

        {isReaskingGate && (
          <TapChipRow
            options={YES_NO_OPTIONS}
            ariaLabel={category.gateQuestion}
            onMount={handleChipRowReveal}
            onSelect={(value) => handleGateAnswer(category, value as YesNo, true)}
          />
        )}

        {!isReaskingGate && !answer && (
          <Beat
            key={`c-${category.id}-gate-chips`}
            delayMs={gateBubbleDelay + CHIP_DELAY_MS}
            reduced={reduced}
            onReveal={handleChipRowReveal}
          >
            <TapChipRow
              options={YES_NO_OPTIONS}
              ariaLabel={category.gateQuestion}
              onSelect={(value) => handleGateAnswer(category, value as YesNo, false)}
            />
          </Beat>
        )}

        {!isReaskingGate && answer && (
          <>
            <Beat key={`c-${category.id}-gate-her`} delayMs={0} reduced={reduced} onReveal={handleReveal}>
              <HerBubble>{answer.gateAnswer === 'yes' ? 'Yes' : 'No'}</HerBubble>
            </Beat>

            {renderAdditionalGates(category, answer)}

            {gateSequenceComplete(category, answer) && (
              <ChangeThisButton label={category.gateQuestion} onClick={() => onChangeThisGate(category.id)} />
            )}

            {answer.gateAnswer === 'yes' && renderFollowUps(category, answer)}

            {answer.gateAnswer === 'yes' &&
              answer.followUpAnswers.length === category.followUps.length &&
              renderDetailBeat(category, answer)}
          </>
        )}

        {index === 0 && !isReaskingGate && isCategoryResolved(category, answer, skippedDetailFor) && (
          <Beat key="first-ack" delayMs={BEAT_MS} reduced={reduced} onReveal={handleReveal}>
            <BotBubble>{CHECK_IN_FIRST_ACK}</BotBubble>
          </Beat>
        )}
      </div>
    );
  }

  const closingReached = unlockedCategoryCount > redFlagCategories.length;
  const closingHasContent = triageDescription.trim().length > 0 || triageVoiceNote !== null;
  const closingResolved = closingHasContent || closingSkipped;
  const showClosingComposer = closingReached && (closingReask || !closingResolved);
  const showClosingResolved = closingReached && closingResolved && !closingReask;
  const continuingAfterHardStop = hasHardStopFired(categoryAnswers);

  function renderClosingBlock(): ReactElement | null {
    if (!closingReached) {
      return null;
    }
    return (
      <div key="closing" className="flex flex-col gap-4">
        <Beat key="closing-invite" delayMs={BEAT_MS} reduced={reduced} onReveal={handleReveal}>
          <BotBubble>{CHECK_IN_CLOSING_INVITE}</BotBubble>
        </Beat>

        {showClosingComposer && (
          <Beat key="closing-composer" delayMs={BEAT_MS + CHIP_DELAY_MS} reduced={reduced} onReveal={handleReveal}>
            <DetailBeat
              id="closing"
              skipLabel="Nothing to add"
              initialText={closingReask ? triageDescription : ''}
              initialVoiceNote={closingReask ? triageVoiceNote : null}
              onSend={handleClosingSend}
              onSkip={handleClosingSkip}
            />
          </Beat>
        )}

        {showClosingResolved && (
          <>
            {closingHasContent && triageDescription && (
              <Beat key="closing-her" delayMs={0} reduced={reduced} onReveal={handleReveal}>
                <HerBubble>{triageDescription}</HerBubble>
              </Beat>
            )}
            {closingHasContent && triageVoiceNote && (
              <Beat key="closing-voicenote" delayMs={0} reduced={reduced} onReveal={handleReveal}>
                <VoiceNoteBubble voiceNote={triageVoiceNote} />
              </Beat>
            )}
            <Beat key="closing-ack" delayMs={BEAT_MS} reduced={reduced} onReveal={handleReveal}>
              <BotBubble>
                {continuingAfterHardStop ? CHECK_IN_HARD_STOP_CLOSING_ACK : CHECK_IN_CLOSING_ACK}
              </BotBubble>
            </Beat>
            <Beat key="continue-button" delayMs={BEAT_MS + CHIP_DELAY_MS} reduced={reduced} onReveal={handleReveal}>
              <button
                type="button"
                onClick={continuingAfterHardStop ? onReturnToEmergencyOutcome : onReachedReview}
                className="tap w-full rounded-pill bg-accent px-6 text-label text-on-accent"
              >
                {continuingAfterHardStop ? CHECK_IN_RETURN_TO_EMERGENCY_LABEL : 'Continue to review'}
              </button>
            </Beat>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Beat key="opening" delayMs={0} reduced={reduced} onReveal={handleReveal}>
        <BotBubble>{CHECK_IN_OPENING}</BotBubble>
      </Beat>

      {redFlagCategories.map((category, index) => renderCategoryBlock(category, index))}

      {renderClosingBlock()}
    </div>
  );
}
