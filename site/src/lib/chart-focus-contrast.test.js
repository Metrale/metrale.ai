// SPDX-License-Identifier: AGPL-3.0-only

// A chart point's :focus-visible indicator was the CSS `outline` property
// alone (`.gc-pt { outline-offset: 2px }`, no explicit colour/width -- the UA
// default). WebKit does not render `outline` on SVG elements at all (a
// long-standing engine gap, not a theme bug): a focused point there looked
// identical to an unfocused one, including right after Escape restores focus
// to it (ux-oracle post-deploy finding on metrale.ai#74, 2026-10-05, filed as
// TODO.md D36). `stroke` is an ordinary SVG paint property and renders the
// same everywhere, so the fix paints the indicator on the point's own mark
// shape via `stroke`, not via `outline` on the `<g>`.
//
// This file proves two things dashboard.css's comment alone cannot: that the
// rule is written in terms of `stroke` (not `outline`, which would silently
// reintroduce the WebKit gap) and reads `--accent`, and that `--accent`
// itself clears the WCAG non-text 3:1 floor against the chart background in
// BOTH themes -- a correct selector painted with an invisible colour would
// still fail a real reader, and this is the one thing a screenshot review
// alone does not re-check on every future token edit.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const dashboardCss = readFileSync(resolve(HERE, '..', 'styles', 'dashboard.css'), 'utf8');
const tokens = readFileSync(resolve(HERE, '..', '..', '..', 'web-shared', 'metrale-tokens.css'), 'utf8');

// Comments stripped first: dashboard.css's own comment above the rule names
// `stroke`, `--accent` and `outline` in prose, so matching the raw text would
// let a check that reads the documentation instead of the rule pass
// regardless of what the rule underneath actually says (the exact trap
// chart-swatch-css.test.js's own comment documents, and which bit a rename
// once in chart-point-tap.spec.js's own comment on this branch's prior PR).
const stripped = dashboardCss.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every declaration block whose selector matches `selRe`, body text only. */
const rulesFor = (text, selRe) => [...text.matchAll(/([^}{]+)\{([^}]*)\}/g)].filter(([, sel]) => selRe.test(sel)).map(([, , body]) => body);

describe('the chart point focus indicator', () => {
  // Scoped to `:is(circle, path)` specifically (not just `:is(circle)` or
  // `:is(path, g)`, which also appear in the UNRELATED hover/focus growth
  // rules above this one in dashboard.css, and would make this check match
  // those instead and fail on their unrelated bodies).
  const focusRules = rulesFor(stripped, /\.gc-pt:focus-visible\s+\.gc-mark\s*:is\(circle,\s*path\)/);

  test('a :focus-visible rule targeting .gc-mark exists in dashboard.css', () => {
    expect(focusRules.length).toBeGreaterThan(0);
  });

  test('it paints with `stroke`, not `outline` -- outline does not render on SVG in WebKit', () => {
    for (const body of focusRules) {
      expect(body).toMatch(/\bstroke\s*:\s*var\(--accent\)/);
      expect(body).not.toMatch(/\boutline\s*:/);
    }
  });

  test('it sets a stroke-width (a stroke with width 0 is as invisible as none)', () => {
    for (const body of focusRules) expect(body).toMatch(/\bstroke-width\s*:\s*\S/);
  });

  test('it covers both an .gc-mark that IS a circle/path, and one nested inside a <g> (the aggregated-point case)', () => {
    const selectorText = [...stripped.matchAll(/([^}{]+)\{([^}]*)\}/g)]
      .filter(([, , body]) => body.includes('var(--accent)'))
      .map(([, sel]) => sel)
      .join('\n');
    expect(selectorText).toMatch(/\.gc-mark:is\(circle,\s*path\)/); // the mark itself
    expect(selectorText).toMatch(/\.gc-mark\s+:is\(circle,\s*path\)/); // a descendant of it
  });
});

describe('NEGATIVE CONTROL: the parser can fail', () => {
  test('a rule using outline instead of stroke is caught', () => {
    const bad = '.gc-pt:focus-visible .gc-mark:is(circle) { outline: 2px solid var(--accent); }';
    const rules = rulesFor(bad, /\.gc-pt:focus-visible\s+\.gc-mark/);
    expect(rules).toHaveLength(1);
    expect(rules[0]).not.toMatch(/\bstroke\s*:\s*var\(--accent\)/);
  });

  test('an unrelated rule is ignored', () => {
    const harmless = '.gc-pt:hover .gc-mark { opacity: 1; }';
    expect(rulesFor(harmless, /\.gc-pt:focus-visible\s+\.gc-mark/)).toHaveLength(0);
  });
});

// --- --accent vs --card contrast, both themes -------------------------------
// Same inline WCAG-contrast helper as series-contrast.test.js and
// light-text-contrast.test.js (house style: each contrast test measures its
// own specific pair against its own source block, not a shared abstraction).

const block = (selector) => {
  const m = tokens.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`${selector} is not in web-shared/metrale-tokens.css`);
  return m[1];
};
const DARK = block(':root');
const LIGHT = block('\\[data-theme="light"\\]');

const hexIn = (src, where, name) => {
  const m = src.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`--${name} is not in the ${where} block of web-shared/metrale-tokens.css`);
  const v = m[1].trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`--${name} is "${v}" in the ${where} block, not a hex literal`);
  return v;
};

const srgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const relLum = (hex) => {
  const v = srgb(hex);
  return 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
};
const contrast = (a, b) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// WCAG's non-text floor: a focus indicator is a UI component outline, not
// text, so 3:1 is the bar (same floor series-contrast.test.js uses for a
// chart line, which this ring sits directly beside).
const FLOOR = 3;

describe.each([
  ['dark', DARK],
  ['light', LIGHT],
])('%s theme', (name, src) => {
  test(`--accent clears ${FLOOR}:1 against --card`, () => {
    const accent = hexIn(src, name, 'accent');
    const card = hexIn(src, name, 'card');
    expect(contrast(accent, card)).toBeGreaterThanOrEqual(FLOOR);
  });
});
