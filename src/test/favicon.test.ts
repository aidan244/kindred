/**
 * THE FAVICON IS A DUPLICATE OF THE LOGO, AND THIS IS WHAT STOPS IT ROTTING.
 *
 * public/favicon.svg carries the same path data as
 * src/components/KindredMark.tsx. It has to be a static file — the browser
 * fetches a tab icon before any JavaScript runs, so it cannot import the
 * component — and it has to carry literal colours, because a tab has no theme
 * context and `currentColor` would resolve to black there.
 *
 * Both of those are fine. What is not fine is the failure mode: someone edits
 * the mark, the app updates everywhere, and the tab quietly keeps showing the
 * OLD logo indefinitely. Nothing else in the suite can see that — the favicon
 * is not imported by anything, is not type-checked, and renders in a part of
 * the browser no test looks at.
 *
 * So this asserts the duplication directly, in both directions: the geometry
 * matches, and the two colours are the two accents the themes actually define.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MARK_CIRCLE,
  MARK_FIGURE,
  MARK_SWEEP,
  MARK_VIEW_BOX,
  markStrokeWidth,
} from '../components/KindredMark';

/** Vitest's root is the project root (vite.config.ts) — see invariants.test.ts
 * on why this resolves off the working directory rather than import.meta.url. */
const PROJECT_ROOT = process.cwd();
const favicon = readFileSync(join(PROJECT_ROOT, 'public', 'favicon.svg'), 'utf8');
const indexHtml = readFileSync(join(PROJECT_ROOT, 'index.html'), 'utf8');
const tokens = readFileSync(join(PROJECT_ROOT, 'src', 'styles', 'tokens.css'), 'utf8');

/** Collapses whitespace so a reflowed path string still compares equal — the
 * component's is broken across lines for readability, the favicon's is not. */
function normalise(pathData: string): string {
  return pathData.replace(/\s+/g, ' ').trim();
}

/** The `--accent` declared inside one theme block. Comments are stripped first
 * so a value merely NAMED in prose cannot satisfy the assertion. */
function themeAccent(selector: string): string {
  const withoutComments = tokens.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = withoutComments.indexOf(selector);
  expect(start, `theme block not found: ${selector}`).toBeGreaterThan(-1);
  const open = withoutComments.indexOf('{', start);
  const block = withoutComments.slice(open + 1, withoutComments.indexOf('}', open));
  const match = block.match(/--accent:\s*(#[0-9a-fA-F]{3,8})/);
  expect(match, `no --accent in ${selector}`).not.toBeNull();
  return match![1].toLowerCase();
}

describe('the favicon is wired up at all', () => {
  it('is linked from index.html as an SVG icon', () => {
    expect(indexHtml).toMatch(/<link[^>]+rel="icon"[^>]+type="image\/svg\+xml"[^>]+>/);
    expect(indexHtml).toContain('href="/favicon.svg"');
  });
});

describe('the favicon has not drifted from KindredMark', () => {
  it('uses the same viewBox', () => {
    expect(favicon).toContain(`viewBox="${MARK_VIEW_BOX}"`);
  });

  it('carries the same sweep, circle and figure', () => {
    const flat = normalise(favicon);
    expect(flat).toContain(normalise(MARK_SWEEP));
    expect(flat).toContain(normalise(MARK_FIGURE));
    expect(flat).toContain(`cx="${MARK_CIRCLE.cx}" cy="${MARK_CIRCLE.cy}" r="${MARK_CIRCLE.r}"`);
  });

  it('draws at the mark’s small-size stroke weight', () => {
    // A favicon renders at 16-32px, below even the 24px anchor, so the
    // heaviest tested weight is the correct one.
    expect(favicon).toContain(`stroke-width="${markStrokeWidth(16)}"`);
  });

  it('strokes a variable rather than a hard-coded colour', () => {
    // The literal colours belong in the <style> block, where the
    // prefers-color-scheme swap can reach them.
    expect(favicon).toContain('stroke="var(--mark)"');
  });
});

describe("the favicon's colours are the themes' own accents", () => {
  it('uses the night accent as its default', () => {
    // Night is the default theme (index.html sets data-theme="night"), so the
    // value outside the media query has to be night's.
    const night = themeAccent(":root[data-theme='night']");
    const beforeMediaQuery = favicon.slice(0, favicon.indexOf('@media'));
    expect(beforeMediaQuery.toLowerCase()).toContain(night);
  });

  it('swaps to the day accent under prefers-color-scheme: light', () => {
    const day = themeAccent(":root[data-theme='day']");
    const mediaBlockStart = favicon.indexOf('@media (prefers-color-scheme: light)');
    expect(mediaBlockStart, 'no light-scheme override').toBeGreaterThan(-1);
    expect(favicon.slice(mediaBlockStart).toLowerCase()).toContain(day);
  });

  it('names no colour that is not one of those two', () => {
    // Guards against a third hex creeping in — a stray fill, a shadow, an
    // outline — which would be a colour the design system never declared.
    const hexes = new Set((favicon.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase()));
    const allowed = new Set([
      themeAccent(":root[data-theme='night']"),
      themeAccent(":root[data-theme='day']"),
    ]);
    expect([...hexes].filter((hex) => !allowed.has(hex))).toEqual([]);
  });
});
