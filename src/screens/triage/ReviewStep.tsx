/**
 * 06 Review — what goes to the clinic (handoff README, "06 Review").
 *
 * The last thing she sees before anything leaves her phone: one card per
 * answered thing, each reading as a plain sentence, each changeable. Its job
 * is to be scannable in a few seconds — deliberately NOT a transcript
 * (design-plan.md §14.8), so it shows current state only, with no chat
 * grammar, no timestamps and no history of what she changed on the way here.
 *
 * WHAT CHANGED FROM THE PREVIOUS SHAPE, AND WHY:
 *
 *  1. The card no longer repeats the gate QUESTION. The README files each
 *     card under the category's short noun instead — `RedFlagCategory.label`
 *     ("Bleeding", "Movements", "Collapse or injury") as a muted caption,
 *     with her answer as the body beneath it. A heading plus a sentence
 *     reads in one glance; a question plus its answer plus every follow-up
 *     prompt was a data dump wearing a card.
 *
 *  2. The follow-up answers are folded INTO that one sentence rather than
 *     listed as caption rows — the README's "Yes — like a period, since this
 *     morning". See `answerSentence` for the assembly rules and for the one
 *     place they deliberately deviate.
 *
 *  3. NO PENCIL AND NO TICK. The old per-card control was a `NotePencil`
 *     glyph plus the word "Edit". Both are gone: no tick/check glyph exists
 *     anywhere in this product (handoff README, "Marks"), and the README's
 *     control here is the words themselves — CHANGE_THIS_LABEL, caption
 *     role, accent, 56px target, pulled 8px left so its label optically
 *     aligns with the card's 16px padding rather than its own hit area.
 *
 *  4. This screen owns its own dock (`<Dock variant="tall">`): the accent
 *     send pill, the muted note under it, then OperatorCall. TriageFlow
 *     renders the emergency dock only during the conversation phase, so
 *     exactly one dock is ever mounted in the shared rectangle
 *     (src/components/Dock.tsx). It owns the dock's CONTENTS only; the
 *     clearance underneath it belongs to TriageFlow's scrolling column (see
 *     the return statement).
 *
 *     NO EmergencyCall HERE, AND THAT IS THE README'S COMPOSITION, NOT AN
 *     OMISSION. §06 states this screen's dock exactly: "accent pill 60px
 *     'Send this to your clinic', muted caption ..., then the operator row" —
 *     three children, no emergency control — where §03/§04/§05 all state
 *     "EmergencyCall standard + 999 note + operator row" for the conversation
 *     screens. The reason is the one this file is about: review is the last
 *     look before anything leaves her phone, and a red pill at the top of the
 *     dock would put the loudest control on the screen next to the one action
 *     she came here to take. A call route is still one tap away below it —
 *     OperatorCall, which reaches a human without her having to first decide
 *     whether what she is feeling counts as clinical.
 *
 *     THIS IS NOT the case Dock.tsx's no-host fallback guards against. That
 *     fallback exists because a MISSING PROVIDER could make a dock silently
 *     absent — an absence no screen chose and no reader would see in the
 *     source. Here the composition is chosen, stated in the README, and
 *     visible in the JSX below. "The emergency control is never disabled"
 *     (invariant 3) is about the control's own state wherever it is rendered,
 *     not a requirement that every screen render one; §06 is the README
 *     deciding which screen renders which dock.
 *
 * EMPTY DATA RENDERS NOTHING (handoff README, invariants). A category with no
 * recorded answer gets no card at all — never a card saying "Not answered",
 * which would look like a thing she had failed to do rather than a thing she
 * was never asked. This screen is only ever reached by walking the whole
 * conversation (review is skipped entirely on the hard-stop path — see
 * TriageFlow's `handleHardStop`), so in practice every category shown was
 * genuinely walked and every category absent genuinely was not. The same rule
 * applies to the free-text card: nothing typed and nothing recorded means no
 * card, not "Nothing added".
 *
 * EDIT GRANULARITY (see CheckInConversation.tsx's header comment): "Change
 * this" re-asks the category's GATE question, not an individual follow-up.
 * That mirrors this screen's own one-card-per-category shape. Per-follow-up
 * changes exist, but they live in the conversation, next to the answer.
 */

import type { ReactElement, ReactNode } from 'react';
import {
  CHANGE_THIS_LABEL,
  REVIEW_FREE_TEXT_LABEL,
  changeAnswerAccessibleLabel,
  REVIEW_LEAD,
  REVIEW_SEND_LABEL,
  REVIEW_SEND_NOTE,
  REVIEW_TITLE,
  formatFollowUpAnswerValue,
  redFlagCategories,
  yesNoLabel,
  type FollowUpType,
  type RedFlagCategory,
} from '../../data/clinicalContent';
import { Dock } from '../../components/Dock';
import { VoiceNoteAttachmentRow } from '../../components/VoiceNoteBubble';
import { hapticTick } from '../../logic/haptics';
import type { CategoryAnswer, VoiceNote } from '../../types';

export interface ReviewStepProps {
  answers: CategoryAnswer[];
  description: string;
  voiceNote: VoiceNote | null;
  onEditCategory: (categoryId: string) => void;
  onEditDescription: () => void;
  onSend: () => void;
}

/**
 * Follow-up types whose formatted value is already a phrase that carries its
 * own meaning — she either wrote it ('text') or picked a written option
 * ('select'), so "like a period" or "since this morning" can sit in the
 * sentence on its own and still be true and readable.
 *
 * Everything else ('yesno', 'number', 'multiselect') formats to a token that
 * says nothing without the question that produced it: a bare "No", "7" or
 * "None" dropped into a comma list is not plain language, it is a shred of
 * one, and on the one screen whose entire purpose is letting her verify what
 * goes to her clinic, a shred is worse than a long sentence. Those clauses
 * therefore carry their follow-up's prompt, verbatim from the schema, as a
 * short sentence of their own — see `answerSentence`.
 */
const SELF_DESCRIBING_TYPES: ReadonlySet<FollowUpType> = new Set<FollowUpType>(['text', 'select']);

/**
 * Lowercases the first character only. Applied ONLY to schema-authored option
 * labels (the 'select' case), which this codebase wrote and knows are
 * ordinary sentence-initial capitals — "Like a period" becoming "like a
 * period" mid-sentence, exactly as the README's example reads. Never applied
 * to text she typed: her words go to the clinic as she wrote them, including
 * her capitals.
 */
function lowerFirst(value: string): string {
  return value.length > 0 ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

/**
 * Assembles one category's answer into the README's plain sentence:
 * "Yes — like a period, since this morning".
 *
 * The gate answer opens it; the self-describing follow-ups (above) follow an
 * em dash as a comma list, in schema order; anything that would have been a
 * meaningless token becomes its own short "prompt answer" sentence after it,
 * as do the Collapse category's additional gate questions. So a fully
 * answered Bleeding category reads:
 *
 *   "Yes — like a period, since this morning. Any clots or tissue? No.
 *    Any pain or dizziness? Yes."
 *
 * Every word here is either her answer or verbatim schema text. Nothing is
 * scored, ranked, negated, summarised or characterised — a review screen that
 * quietly rephrased what she said would be the one place in the product where
 * she could not check what her clinic is about to read.
 */
function answerSentence(category: RedFlagCategory, answer: CategoryAnswer): string {
  const inline: string[] = [];
  const sentences: string[] = [];

  // The Collapse category's extra gates (modelling decision (a) in
  // clinicalContent.ts). Always prompt-carrying: two bare "No"s under one
  // heading could not be told apart otherwise. Only ever reached with 'no'
  // answers — a 'yes' hard-stops before review exists — but rendered from
  // whatever is recorded rather than assuming that.
  category.additionalGateQuestions?.forEach((prompt, index) => {
    const value = answer.additionalGateAnswers?.[index];
    if (value === undefined) {
      return;
    }
    sentences.push(`${prompt} ${yesNoLabel(value)}`);
  });

  // Schema order, not answer order: the follow-ups were written to be read
  // in sequence, and `followUpAnswers` is append-ordered, so an edited answer
  // would otherwise jump to the end of the sentence.
  category.followUps.forEach((followUp) => {
    const recorded = answer.followUpAnswers.find((f) => f.followUpId === followUp.id);
    if (!recorded) {
      return;
    }
    const formatted = formatFollowUpAnswerValue(recorded.value, followUp.options);
    // A text follow-up may legitimately be blank (clinicalContent.ts,
    // modelling decision (d)): nothing to show is nothing to show.
    if (formatted.trim().length === 0) {
      return;
    }
    if (SELF_DESCRIBING_TYPES.has(followUp.type)) {
      inline.push(followUp.type === 'select' ? lowerFirst(formatted) : formatted);
    } else {
      sentences.push(`${followUp.prompt} ${formatted}`);
    }
  });

  const lead =
    inline.length > 0
      ? `${yesNoLabel(answer.gateAnswer)} — ${inline.join(', ')}`
      : yesNoLabel(answer.gateAnswer);

  // Terminating full stops only once there is more than one sentence to
  // separate. On its own the lead is a fragment answering the caption above
  // it ("Bleeding" / "Yes — like a period, since this morning"), and the
  // README prints it without one.
  if (sentences.length === 0) {
    return lead;
  }
  return [lead, ...sentences].map((part) => `${part}.`).join(' ');
}

interface ReviewCardProps {
  /** The muted caption this card is filed under — the category's short noun,
   * or REVIEW_FREE_TEXT_LABEL. */
  label: string;
  /** The assembled sentence, or (on the free-text card) her own words. Null
   * when there is nothing but an attachment to show. */
  answer: string | null;
  /** Her verbatim words from this category's own detail beat, kept in their
   * own paragraph rather than spliced into the assembled sentence — what she
   * wrote and what was assembled from taps must stay visibly separate. */
  ownWords?: string;
  /**
   * EVERY note filed under this card, in the order she recorded them.
   *
   * A list rather than a single note because a category can now carry more
   * than one: a `text` follow-up's composer has a mic, as the category's own
   * detail beat does. This screen's whole purpose is letting her check what
   * her clinic is about to read, so a second recording must appear here — one
   * silently omitted would be something sent that she was never shown.
   */
  voiceNotes?: VoiceNote[];
  onChange: () => void;
}

function ReviewCard({ label, answer, ownWords, voiceNotes = [], onChange }: ReviewCardProps): ReactElement {
  return (
    /* README: radius 22, bg surface, padding 16. No border, no shadow —
       elevation in this system is light, and a card is not elevated. */
    <div className="flex flex-col rounded-card bg-surface p-4">
      <p className="text-caption text-text-muted">{label}</p>
      {answer !== null && <p className="mt-1 text-body text-text">{answer}</p>}
      {ownWords && <p className="mt-2 text-body text-text">{ownWords}</p>}
      {/* 12px under the words, and 12px apart from each other — the same
          rhythm the cards themselves keep. */}
      {voiceNotes.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {voiceNotes.map((note, index) => (
            <VoiceNoteAttachmentRow key={`${note.url}-${index}`} voiceNote={note} />
          ))}
        </div>
      )}

      {/* Caption role, accent, 56px target, -8px left margin so the label
          (not the hit area) lines up with the card's padding. The words are
          the control: no pencil, no glyph of any kind. The accessible name
          is built from the two strings already on screen, so a screen reader
          hears which answer this changes without inventing a second wording
          for the same control. */}
      <button
        type="button"
        onClick={onChange}
        aria-label={changeAnswerAccessibleLabel(label)}
        className="tap press -ml-2 flex items-center self-start px-2 text-caption text-accent"
      >
        {CHANGE_THIS_LABEL}
      </button>
    </div>
  );
}

export function ReviewStep({
  answers,
  description,
  voiceNote,
  onEditCategory,
  onEditDescription,
  onSend,
}: ReviewStepProps): ReactElement {
  const freeText = description.trim();
  // Empty renders nothing: no card at all rather than a card whose body says
  // she left it blank. The optional beat is optional.
  const showFreeTextCard = freeText.length > 0 || voiceNote !== null;

  const handleSend = (): void => {
    hapticTick();
    onSend();
  };

  // Rendered as a list of the things being sent — cards, to a screen reader,
  // are a set of items rather than an undifferentiated run of paragraphs.
  const cards: ReactNode[] = [];
  redFlagCategories.forEach((category) => {
    const answer = answers.find((a) => a.categoryId === category.id);
    if (!answer) {
      return;
    }
    // Follow-up notes first, in schema order (the order she was asked), then
    // the category's own closing detail note — which is the order she
    // recorded them in, and the order the conversation above showed them.
    const categoryNotes: VoiceNote[] = [];
    category.followUps.forEach((followUp) => {
      const recorded = answer.followUpAnswers.find((f) => f.followUpId === followUp.id);
      if (recorded?.voiceNote) {
        categoryNotes.push(recorded.voiceNote);
      }
    });
    if (answer.voiceNote) {
      categoryNotes.push(answer.voiceNote);
    }
    cards.push(
      <li key={category.id}>
        <ReviewCard
          label={category.label}
          answer={answerSentence(category, answer)}
          ownWords={answer.detail}
          voiceNotes={categoryNotes}
          onChange={() => onEditCategory(category.id)}
        />
      </li>
    );
  });
  if (showFreeTextCard) {
    cards.push(
      <li key="free-text">
        <ReviewCard
          label={REVIEW_FREE_TEXT_LABEL}
          answer={freeText.length > 0 ? description : null}
          voiceNotes={voiceNote ? [voiceNote] : []}
          onChange={onEditDescription}
        />
      </li>
    );
  }

  return (
    /* NO `dock-safe-tall` HERE, deliberately. Clearance belongs to the
       SCROLLING SCREEN (handoff README, invariants: "every scrolling screen
       carries one"), and this is a phase inside one, not a screen of its own:
       TriageFlow's content column already carries `dock-safe-tall` for both
       of its phases. Adding a second copy here stacked the two paddings and
       left 536px of empty scroll under a five-line review — clearance twice
       is not clearance, it is a hole. */
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title text-text">{REVIEW_TITLE}</h1>
        <p className="text-lead text-text">{REVIEW_LEAD}</p>
      </div>

      {/* 12px apart, per the README. `list-none` because these are cards, not
          bullets — the list exists for structure, not decoration. */}
      {cards.length > 0 && <ul className="flex list-none flex-col gap-3">{cards}</ul>}

      <Dock variant="tall">
        {/* 60px accent pill. `min-h` rather than a fixed height so the label
            can grow to 200% text without clipping; at the default size the
            padding never reaches the minimum, so it renders at exactly 60. */}
        <button
          type="button"
          onClick={handleSend}
          className="tap press flex min-h-[60px] w-full items-center justify-center rounded-pill bg-accent px-6 py-2 text-label text-on-accent shadow-float"
        >
          {REVIEW_SEND_LABEL}
        </button>
        {/* What actually happens next, and the honest limit of it. Muted
            caption weight: it informs, it does not warn. */}
        <p className="text-center text-caption text-text-muted">{REVIEW_SEND_NOTE}</p>
      </Dock>
    </div>
  );
}
