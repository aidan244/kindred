/**
 * WHEREVER SHE CAN TYPE, SHE CAN SPEAK INSTEAD.
 *
 * The mic used to belong to ONE of the product's free-text boxes — the
 * check-in composer (screens 03 and 05). The `text` follow-up inside the same
 * conversation and both onboarding detail fields were near-copies of that
 * composer's card without one, so whether she could answer out loud depended
 * on which beat she happened to be in. For a woman whose hands are shaking, or
 * who finds typing harder than talking, that is the difference between
 * answering and skipping — on a document that goes to her clinic.
 *
 * These tests pin the rule down in three ways, because each catches a
 * different way of losing it:
 *
 *  1. Per surface: each free-text box actually renders a mic.
 *  2. Structurally: any file with a `<textarea>` must reach for the shared mic,
 *     so a FOURTH text box added later cannot ship without one. This is the
 *     blunt-guard style of src/test/invariants.test.ts, for the same reason —
 *     a check that fails the build beats a rule everyone means to follow.
 *  3. Negatively: the number follow-up has NO mic. A recording is not a
 *     number, and offering a way to answer that the input cannot record would
 *     be worse than not offering it.
 *
 * jsdom has neither MediaRecorder nor navigator.mediaDevices, and the mic is
 * withheld outright when the browser cannot record (VoiceNoteComposer.tsx:
 * "an affordance that was never offered needs no apology"). So the capability
 * is stubbed here — WITHOUT it every assertion below would pass vacuously
 * against a product that renders no mic at all.
 */

import '@testing-library/jest-dom/vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FollowUpInput } from '../screens/triage/FollowUpInput';
import { QuestionStep } from '../screens/onboarding/QuestionStep';
import { Composer } from '../components/Composer';
import {
  COMPOSER_SEND_LABEL,
  onboardingQuestions,
  VOICE_NOTE_RECORD_ACCESSIBLE_LABEL,
} from '../data/clinicalContent';
import type { RedFlagFollowUp } from '../data/clinicalContent';
import type { FollowUpAnswerValue, OnboardingAnswers, VoiceNote } from '../types';

const EMPTY_ANSWERS: OnboardingAnswers = {
  weeksPregnant: null,
  extraMonitoring: { answer: null, detail: '' },
  history: { selected: [], detail: '' },
};

const TEXT_FOLLOW_UP: RedFlagFollowUp = {
  id: 'describe-it',
  prompt: 'Can you describe it?',
  type: 'text',
};

const NUMBER_FOLLOW_UP: RedFlagFollowUp = {
  id: 'how-many',
  prompt: 'How many times?',
  type: 'number',
};

const A_NOTE: VoiceNote = { url: 'blob:test', durationSeconds: 8, mimeType: 'audio/webm' };

function mic(): HTMLElement | null {
  return screen.queryByRole('button', { name: VOICE_NOTE_RECORD_ACCESSIBLE_LABEL });
}

describe('every free-text box offers a mic', () => {
  beforeEach(() => {
    // The two things canRecordVoiceNotes() looks for. A bare class is enough:
    // nothing here starts a recording, only checks that the control exists.
    vi.stubGlobal('MediaRecorder', class {} as unknown as typeof MediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  afterEach(() => {
    // vitest is not configured with `test.globals`, so testing-library's
    // automatic afterEach(cleanup) never registers — do it explicitly.
    cleanup();
    vi.unstubAllGlobals();
  });

  it('the check-in composer does (the one that always did — so the stub works)', () => {
    render(
      <Composer
        id="c"
        value=""
        onChange={() => {}}
        voiceNote={null}
        onVoiceNoteChange={() => {}}
        onSend={() => {}}
        ariaLabel="Anything to add"
      />
    );
    expect(mic()).toBeInTheDocument();
  });

  it('a text follow-up inside the check-in does', () => {
    render(
      <FollowUpInput followUp={TEXT_FOLLOW_UP} ariaLabel={TEXT_FOLLOW_UP.prompt} onSubmit={() => {}} />
    );
    expect(mic()).toBeInTheDocument();
    // And it is the shared composer, not a lookalike: same field, same Send.
    expect(screen.getByRole('textbox', { name: TEXT_FOLLOW_UP.prompt })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(COMPOSER_SEND_LABEL) })).toBeInTheDocument();
  });

  it("onboarding's optional detail box does, on both questions that have one", () => {
    for (const id of ['extra-monitoring', 'history']) {
      const question = onboardingQuestions.find((q) => q.id === id)!;
      render(<QuestionStep question={question} answers={EMPTY_ANSWERS} onChange={() => {}} />);
      expect(mic(), `no mic on onboarding question "${id}"`).toBeInTheDocument();
      cleanup();
    }
  });

  it('a number follow-up deliberately does NOT — a recording is not a number', () => {
    render(
      <FollowUpInput
        followUp={NUMBER_FOLLOW_UP}
        ariaLabel={NUMBER_FOLLOW_UP.prompt}
        onSubmit={() => {}}
      />
    );
    expect(mic()).not.toBeInTheDocument();
  });

  it('carries a voice note up from a text follow-up, alongside the typed value', () => {
    const submitted: Array<[FollowUpAnswerValue, VoiceNote | null | undefined]> = [];
    render(
      <Composer
        id="c"
        value="some words"
        onChange={() => {}}
        voiceNote={A_NOTE}
        onVoiceNoteChange={() => {}}
        onSend={(text, note) => submitted.push([{ type: 'text', value: text }, note])}
        ariaLabel="Anything to add"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(COMPOSER_SEND_LABEL) }));
    expect(submitted).toEqual([[{ type: 'text', value: 'some words' }, A_NOTE]]);
  });

  it('reopens what she already said when a text follow-up is re-asked', () => {
    // "Change this" used to remount the widget blank, silently discarding her
    // previous answer. That was survivable when it was only typing; it is not
    // once the box can hold a recording she has no way of getting back.
    render(
      <FollowUpInput
        followUp={TEXT_FOLLOW_UP}
        ariaLabel={TEXT_FOLLOW_UP.prompt}
        initialText="what she said before"
        initialVoiceNote={A_NOTE}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByRole('textbox', { name: TEXT_FOLLOW_UP.prompt })).toHaveValue(
      'what she said before'
    );
    // The note is present as her bubble, and the mic has stood down so there
    // are never two controls that start a recording.
    expect(screen.getByText('0:08')).toBeInTheDocument();
    expect(mic()).not.toBeInTheDocument();
  });

  it('lets a text follow-up be sent with nothing in it, so she is never stranded', () => {
    // This beat has no Skip. The composer's default disables Send on an empty
    // field; `allowEmptySend` is why a text follow-up can still be answered
    // "nothing" — a legitimate answer (clinicalContent.ts, decision (d)).
    const submitted: FollowUpAnswerValue[] = [];
    render(
      <FollowUpInput
        followUp={TEXT_FOLLOW_UP}
        ariaLabel={TEXT_FOLLOW_UP.prompt}
        onSubmit={(value) => submitted.push(value)}
      />
    );
    const send = screen.getByRole('button', { name: new RegExp(COMPOSER_SEND_LABEL) });
    expect(send).not.toBeDisabled();
    fireEvent.click(send);
    expect(submitted).toEqual([{ type: 'text', value: '' }]);
  });
});

describe('structurally — a new text box cannot ship without a mic', () => {
  /** Vitest's root is the project root (vite.config.ts), and `import.meta.url`
   * is not a file: URL once the module has been through the jsdom transform —
   * so this resolves off the working directory, as invariants.test.ts does. */
  const SRC_DIR = join(process.cwd(), 'src');

  function collectTsx(dir: string, out: { path: string; text: string }[] = []): typeof out {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        // src/test itself is excluded: this very file names the patterns it
        // checks for, and a test is not product code.
        if (entry !== 'test') {
          collectTsx(full, out);
        }
        continue;
      }
      if (entry.endsWith('.tsx')) {
        out.push({ path: relative(SRC_DIR, full), text: readFileSync(full, 'utf8') });
      }
    }
    return out;
  }

  const withTextarea = collectTsx(SRC_DIR).filter((file) => file.text.includes('<textarea'));

  it('found the text boxes at all (guards against an empty sweep)', () => {
    expect(withTextarea.length).toBeGreaterThan(0);
  });

  it('every file rendering a textarea reaches for the shared mic', () => {
    const offenders = withTextarea
      .filter((file) => !file.text.includes('VoiceNoteMicButton'))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});
