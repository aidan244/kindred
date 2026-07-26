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
    content.EMERGENCY_CALL_LABEL,
    content.EMERGENCY_CALL_ACCESSIBLE_LABEL,
    content.changeAnswerAccessibleLabel('Are you bleeding?'),
    content.checkInProgressValueText(2, 6),
    content.onboardingProgressValueText(2, 3),
    content.emergencyHandoverLead(34, answers),
    content.emergencyHandoverLead(34, []),
    content.outcomeReportSentNote('Thornfield Clinic'),
    // The routine state's three sentence-builders went when it was cut back to
    // "nothing was flagged" plus the call route; its copy is now three plain
    // constants, which this file's exported-constant sweep already covers.
    content.outcomeCallContactLabel('Thornfield Clinic'),
    content.triageContactReason('clinic', '08:00'),
    content.triageContactReason('unit', '08:00'),
    content.homeGreeting('Amara'),
    content.homeSyncedAgo(null, Date.now()),
    content.homeSyncedAgo(new Date(Date.now() - 4 * 60000), Date.now()),
    content.homeSyncedAgo(new Date(Date.now() - 3 * 3600000), Date.now()),
    content.bandOfflineCopy('06:20'),
    content.kickTraceCardSummary(142),
    content.kickTraceLiveSummary(142),
    content.liveViewSessionCaption('09:14')
  );

  it('gathered a non-trivial amount of copy (guards against an empty sweep)', () => {
    expect(everyString.length).toBeGreaterThan(100);
  });

  /**
   * The alert stage is a NAMED, DELIBERATE exemption from the "detected" rule,
   * not a leak — see the note on ALERT_FRAMING_TITLE in clinicalContent.ts.
   *
   * It is written as an explicit allowlist of the exact strings rather than by
   * deleting the assertion, so that: the rule still fails for every other
   * string in the copy module; the exemption is greppable and countable; and
   * reverting the product decision means deleting this Set and nothing else.
   *
   * PUSH_BANNER_BODY is composed from ALERT_FRAMING_TITLE, so it is listed for
   * the same reason and cannot drift from it.
   */
  const DETECTED_EXEMPT: ReadonlySet<string> = new Set([
    content.ALERT_FRAMING_TITLE,
    content.PUSH_BANNER_BODY,
  ]);

  it('exempts exactly two strings from the "detected" rule, and no more', () => {
    // If this number moves, someone widened a clinical-safety exemption.
    expect(DETECTED_EXEMPT.size).toBe(2);
  });

  it('never uses the word "detected" outside the alert stage, in any casing', () => {
    // Case-insensitive on purpose: "Detected" opening a sentence reads exactly
    // as the diagnostic assertion the rule forbids.
    expect(everyString.filter((s) => /detect/i.test(s) && !DETECTED_EXEMPT.has(s))).toEqual([]);
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

/**
 * Both theme blocks in tokens.css must define the FULL colour set.
 *
 * This exists because of a real, shipped bug: an unterminated comment inside
 * the night block swallowed every colour declaration up to the aura tokens.
 * The block still parsed, the build still succeeded, tsc still passed and all
 * 60 tests still went green — night simply had no --bg, --text, --text-muted
 * or --accent, and would have rendered as unstyled fallbacks for anyone using
 * the app after 20:00, which is most of them.
 *
 * Nothing else in the suite can see that: it is CSS, it is valid, and it is
 * only wrong by omission. So this asserts presence directly, per theme.
 */
describe('design tokens', () => {
  // Resolved from SRC_DIR, like every other file read in this suite —
  // `import.meta.url` is not a file: URL under the test transform.
  const css = readFileSync(join(SRC_DIR, 'styles', 'tokens.css'), 'utf8');

  /** The declarations inside one theme block, comments stripped first so a
   * token merely NAMED in prose cannot satisfy the assertion. */
  function block(selector: string): string {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const start = withoutComments.indexOf(selector);
    expect(start, `theme block not found: ${selector}`).toBeGreaterThan(-1);
    const open = withoutComments.indexOf('{', start);
    return withoutComments.slice(open + 1, withoutComments.indexOf('}', open));
  }

  const REQUIRED = [
    '--bg', '--surface', '--surface-hi',
    '--text', '--text-muted', '--accent', '--emergency',
    '--accent-rgb', '--text-rgb',
    '--on-accent', '--on-emergency', '--line', '--focus',
    '--aura-core-a', '--aura-ring-1-a', '--aura-ring-2-a', '--aura-field-a',
    '--aura-core-rgb', '--aura-ring-1-rgb', '--aura-ring-2-rgb', '--aura-field-rgb',
  ];

  for (const [name, selector] of [
    ['night', ":root[data-theme='night']"],
    ['day', ":root[data-theme='day']"],
  ] as const) {
    it(`${name} defines every colour token`, () => {
      const declarations = block(selector);
      const missing = REQUIRED.filter((token) => !new RegExp(`${token}\\s*:`).test(declarations));
      expect(missing).toEqual([]);
    });
  }

  it('has no stray comment terminator, which is how the above got broken', () => {
    // A `*/` that closes nothing: strip well-formed comments, then look for
    // any terminator left over.
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('*/');
  });
});
