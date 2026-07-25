/**
 * The triage flow's "detail step" (5b): a conversational free-text capture,
 * presented as a chat, driven by a fixed, deterministic script — no network
 * calls, no randomness, so it cannot fail on stage.
 *
 * Safety rules this component exists to honour:
 *  - Safeguarding stays invisible (rule 8). Whatever she writes here — even
 *    if it isn't about the pregnancy at all — is captured verbatim into
 *    app state so it can travel silently in the clinic report. The UI
 *    never labels, flags, or reacts to content; every scripted line is a
 *    plain, neutral acknowledgement that never evaluates or concludes.
 *  - Her perception always wins (rule 2). Nothing here challenges or asks
 *    her to reconsider what she's written.
 *
 * The script is at most three assistant turns: an opening prompt, one
 * optional follow-up, and a closing line — gated only on whether she typed
 * something, never on a random or timed branch.
 */

import { useState, type ReactElement } from 'react';
import { PaperPlaneRight } from '@phosphor-icons/react';

export interface TriageChatProps {
  description: string;
  onDescriptionChange: (text: string) => void;
  onContinue: () => void;
}

type Phase = 'first' | 'second' | 'done';

interface ChatMessage {
  from: 'assistant' | 'her';
  text: string;
}

const PROMPT_1 = 'Tell your clinic anything else, in your own words. This is optional.';
const ACK_1 = "Thank you. Is there anything else you'd like to add?";
const CLOSING = 'Thank you. You can look everything over before you send it.';

function initialPhase(description: string): Phase {
  return description.trim().length > 0 ? 'done' : 'first';
}

function initialMessages(description: string): ChatMessage[] {
  if (description.trim().length > 0) {
    return [
      { from: 'assistant', text: PROMPT_1 },
      { from: 'her', text: description },
      { from: 'assistant', text: CLOSING },
    ];
  }
  return [{ from: 'assistant', text: PROMPT_1 }];
}

export function TriageChat({
  description,
  onDescriptionChange,
  onContinue,
}: TriageChatProps): ReactElement {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(description));
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages(description));
  const [draft, setDraft] = useState('');

  const handleSend = (): void => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    if (phase === 'first') {
      onDescriptionChange(text);
      setMessages((m) => [
        ...m,
        { from: 'her', text },
        { from: 'assistant', text: ACK_1 },
      ]);
      setPhase('second');
      setDraft('');
      return;
    }

    const combined = [description, text].filter(Boolean).join('\n\n');
    onDescriptionChange(combined);
    setMessages((m) => [
      ...m,
      { from: 'her', text },
      { from: 'assistant', text: CLOSING },
    ]);
    setPhase('done');
    setDraft('');
  };

  const handleSkip = (): void => {
    setMessages((m) => [...m, { from: 'assistant', text: CLOSING }]);
    setPhase('done');
    setDraft('');
  };

  const handleEditAgain = (): void => {
    setDraft(description);
    setMessages([{ from: 'assistant', text: PROMPT_1 }]);
    setPhase('first');
  };

  const composerLabel = phase === 'first' ? 'Say more' : 'Add more';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <div
            key={`${message.from}-${index}`}
            className={message.from === 'her' ? 'flex justify-end' : 'flex justify-start'}
          >
            <p
              className={
                message.from === 'her'
                  ? 'max-w-[85%] rounded-card bg-surface-hi px-4 py-3 text-body text-text'
                  : 'max-w-[85%] text-body text-text'
              }
            >
              {message.text}
            </p>
          </div>
        ))}
      </div>

      {phase !== 'done' && (
        <div className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="triage-chat-input">
            {composerLabel}
          </label>
          <textarea
            id="triage-chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Type here"
            className="w-full rounded-chip border border-line bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted"
          />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSend}
              disabled={draft.trim().length === 0}
              className="tap flex items-center gap-2 rounded-pill bg-accent px-6 text-label text-on-accent disabled:opacity-55"
            >
              <PaperPlaneRight size={20} weight="light" aria-hidden="true" />
              Send
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="tap px-2 text-label text-accent"
            >
              {phase === 'first' ? "That's everything" : 'Nothing more'}
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={onContinue}
            className="tap w-full rounded-pill bg-accent px-6 text-label text-on-accent"
          >
            Continue to review
          </button>
          <button
            type="button"
            onClick={handleEditAgain}
            className="tap self-start px-2 text-label text-accent"
          >
            Change what you told us
          </button>
        </div>
      )}
    </div>
  );
}
