/**
 * THE INVARIANTS, ENFORCED RATHER THAN DESCRIBED.
 *
 * HANDOFF_CONTRACT.md lists nine invariants and every file in this codebase
 * has a header comment restating the ones it touches. Until this file existed,
 * that was the entire enforcement: the emergency token, the tick glyph and the
 * no-hex rule held across ~40 files purely because every author happened to be
 * careful, and each of them was one line away from being violated invisibly.
 * There is no eslint config in this repo, and `@theme static` (src/index.css)
 * deliberately emits `bg-emergency` / `text-emergency` / `border-emergency`
 * whether or not anything references them — so a stray use compiles, ships and
 * renders with nothing to trip over.
 *
 * These are cheap, textual and deliberately blunt. A blunt check that fails the
 * build is worth more here than a precise one nobody runs.
 *
 * WHAT THEY DO NOT COVER, stated so the gap is not mistaken for coverage: they
 * cannot see a red drawn some other way (an inline rgb, a bespoke gradient), a
 * tick drawn as a path, or copy assembled at a call site out of fragments that
 * are each individually clean. They cover the failure modes that are one edit
 * away, not every conceivable one.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as content from '../data/clinicalContent';
import type { CategoryAnswer } from '../types';

/** Vitest's root is the project root (vite.config.ts). `import.meta.url` is
 * not a file: URL once the module has been through the jsdom transform, so
 * this resolves off the working directory instead. */
const SRC_DIR = join(process.cwd(), 'src');

interface SourceFile {
  /** Repo-relative-ish path, e.g. "components/EmergencyCall.tsx". */
  path: string;
  text: string;
}

/** src/test itself is excluded from every sweep: these files quote the very
 * patterns they forbid, and a test is not product code. */
const EXCLUDED_DIR = 'test';

function collect(extensions: string[]): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== EXCLUDED_DIR) {
          walk(full);
        }
        continue;
      }
      if (extensions.some((ext) => entry.endsWith(ext))) {
        files.push({ path: relative(SRC_DIR, full), text: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(SRC_DIR);
  return files;
}

const TS_FILES = collect(['.ts', '.tsx']);
const STYLE_AND_TS_FILES = collect(['.ts', '.tsx', '.css']);

describe('invariant 1 — the emergency token appears in EmergencyCall only', () => {
  /** A Tailwind utility built on the token, e.g. `bg-emergency`,
   * `text-on-emergency`. Anchored to the utility prefixes so it cannot match
   * an identifier like EMERGENCY_TIER_CONTACT or a `kind: 'emergency'`. */
  const EMERGENCY_UTILITY =
    /\b(bg|text|border|fill|stroke|ring|outline|shadow|from|via|to|decoration|caret|accent)-(on-)?emergency\b/;

  it('is used by no component or screen other than EmergencyCall.tsx', () => {
    const offenders = TS_FILES.filter(
      (file) =>
        file.path !== join('components', 'EmergencyCall.tsx') &&
        EMERGENCY_UTILITY.test(file.text)
    ).map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('is used by EmergencyCall.tsx, so this test is actually watching something', () => {
    const emergencyCall = TS_FILES.find(
      (file) => file.path === join('components', 'EmergencyCall.tsx')
    );
    expect(emergencyCall).toBeDefined();
    expect(EMERGENCY_UTILITY.test(emergencyCall!.text)).toBe(true);
  });
});

describe('invariant 2 — no tick or check glyph exists anywhere', () => {
  it('never imports a Check glyph from the icon set', () => {
    // Only the import specifier list is inspected: CheckInControl,
    // CheckInConversation and `checkInProgressValueText` are all legitimate
    // names that a naive substring search would flag.
    const importBlock = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]@phosphor-icons\/react['"]/g;
    const TICK = /\b(Check|Checks|CheckCircle|CheckSquare|CheckSquareOffset|CheckFat)\b/;

    const offenders: string[] = [];
    for (const file of TS_FILES) {
      for (const match of file.text.matchAll(importBlock)) {
        if (TICK.test(match[1])) {
          offenders.push(`${file.path}: ${match[1].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('invariant 3 — no colour literal outside the token file', () => {
  it('contains no hex colour outside src/styles/tokens.css', () => {
    const HEX = /#[0-9a-fA-F]{3,8}\b/;
    const offenders = STYLE_AND_TS_FILES.filter(
      (file) => file.path !== join('styles', 'tokens.css') && HEX.test(file.text)
    ).map((file) => file.path);
    expect(offenders).toEqual([]);
  });
});

describe('invariant 9 — patient-facing copy obeys the voice rules', () => {
  /**
   * Every string this module exports, gathered by walking the exported values
   * (constants, arrays, the question schema, the patient fixture) and then
   * invoking every string-returning formatter with representative arguments.
   *
   * The formatters are listed explicitly rather than auto-invoked: each takes
   * different arguments, and a generic caller would silently skip the ones it
   * could not construct inputs for — which is the opposite of what a guard
   * test is for. Adding a formatter to clinicalContent.ts means adding a line
   * here.
   */
  function collectStrings(value: unknown, out: string[]): void {
    if (typeof value === 'string') {
      out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => collectStrings(entry, out));
      return;
    }
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      Object.values(value).forEach((entry) => collectStrings(entry, out));
    }
  }

  const answers: CategoryAnswer[] = [
    {
      categoryId: content.BLEEDING_CATEGORY_ID,
      gateAnswer: 'yes',
      followUpAnswers: [
        {
          followUpId: content.BLEEDING_HOW_MUCH_FOLLOWUP_ID,
          value: { type: 'select', value: 'heavier-than-a-period' },
        },
      ],
    },
  ];

  const everyString: string[] = [];
  for (const value of Object.values(content)) {
    if (typeof value !== 'function') {
      collectStrings(value, everyString);
    }
  }
  everyString.push(
    content.yesNoLabel('yes'),
    content.yesNoLabel('no'),
    content.overlapRecap([content.BLEEDING_CATEGORY_ID], answers) ?? '',
    content.formatFollowUpAnswerValue({ type: 'multiselect', value: [] }),
    content.formatFollowUpAnswerValue({ type: 'number', value: 4 }),
    content.emergencyCallLabel('emergency'),
    content.emergencyCallLabel('clinic'),
    content.emergencyCallLabel('unit'),
    content.emergencyCallAccessibleLabel('clinic', '020 7946 0523'),
    content.emergencyCallAccessibleLabel('emergency', '999'),
    content.emergencySecondaryContactNote('Thornfield Clinic', '020 7946 0523'),
    content.callContactAccessibleLabel('Thornfield Clinic', '020 7946 0523'),
    content.changeAnswerAccessibleLabel('Are you bleeding?'),
    content.checkInProgressValueText(2, 6),
    content.onboardingProgressValueText(2, 3),
    content.emergencyHandoverLead(34, answers),
    content.emergencyHandoverLead(34, []),
    content.outcomeReportSentNote('Thornfield Clinic'),
    content.outcomeRoutineSentLead('Thornfield Clinic', '14:32'),
    content.outcomeRoutineClinicHours('Thornfield Clinic', true, '08:00'),
    content.outcomeRoutineClinicHours('Thornfield Clinic', false, '08:00'),
    content.outcomeRoutineWaitNote('Thornfield Clinic'),
    content.outcomeCallContactLabel('Thornfield Clinic'),
    content.triageContactReason('clinic', '08:00'),
    content.triageContactReason('unit', '08:00'),
    content.homeGreeting('Amara'),
    content.homeSyncedAgo(null, Date.now()),
    content.homeSyncedAgo(new Date(Date.now() - 4 * 60000), Date.now()),
    content.homeSyncedAgo(new Date(Date.now() - 3 * 3600000), Date.now()),
    content.bandOfflineCopy('06:20'),
    content.heartRateTraceCardSummary(142),
    content.heartRateTraceLiveSummary(142),
    content.liveViewSessionCaption('09:14')
  );

  it('gathered a non-trivial amount of copy (guards against an empty sweep)', () => {
    expect(everyString.length).toBeGreaterThan(100);
  });

  it('never uses the word "detected", in any casing', () => {
    // Case-insensitive on purpose: "Detected" opening a sentence reads exactly
    // as the diagnostic assertion the rule forbids.
    expect(everyString.filter((s) => /detect/i.test(s))).toEqual([]);
  });

  it('never uses an exclamation mark', () => {
    expect(everyString.filter((s) => s.includes('!'))).toEqual([]);
  });

  it('never uses an uppercase warning', () => {
    // Any run of four or more capitals. Deliberately catches shouted words
    // rather than acronyms of two or three letters, of which there are none
    // today either.
    expect(everyString.filter((s) => /[A-Z]{4,}/.test(s))).toEqual([]);
  });

  it('never names A&E, which is a route this product does not offer', () => {
    expect(everyString.filter((s) => /a&e/i.test(s))).toEqual([]);
  });
});
