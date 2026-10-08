import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { NON_TEXT, TEXT, pairings } from '../../scripts/brand/contrast.mjs';
import { contrast, over } from '../../scripts/brand/tokens.mjs';

/**
 * The Lighthouse accessibility gate is 100 on every page, in both themes, and
 * `color-contrast` is the check the palette can fail on its own. Copper makes
 * that easy to do by accident: the kit's copper is 4.4:1 on the ground and
 * 4.3:1 on white, so it is right for the mark and a rail and wrong for a word.
 * The pairings the token file promises are listed once, in
 * scripts/brand/contrast.mjs (.contrast-check.mjs prints the same table in CI);
 * this fails naming each one under its floor, so a token edit that breaks one
 * is caught here rather than on a rendered page.
 */
const rows = pairings(readFileSync(new URL('../../../web-shared/metrale-tokens.css', import.meta.url), 'utf8'));

test('the table covers both themes, text and non-text (so the loop below is not vacuous)', () => {
  expect(rows.length).toBeGreaterThan(100);
  for (const theme of ['dark', 'light']) {
    expect(rows.some((r) => r.theme === theme && r.kind === 'text')).toBe(true);
    expect(rows.some((r) => r.theme === theme && r.kind === 'non-text' && r.fg === 'focus')).toBe(true);
  }
});

for (const r of rows) {
  test(`${r.theme}: --${r.fg} ${r.fgHex} on ${r.on} ${r.onHex} clears ${r.floor}:1 (${r.kind})`, () => {
    expect(r.ratio).toBeGreaterThanOrEqual(r.floor);
  });
}

test('the check can distinguish a passing colour from a failing one', () => {
  // The kit's copper itself, as text: the reason the text steps exist.
  expect(contrast('#C65A2E', '#FFFFFF')).toBeLessThan(TEXT);
  expect(contrast('#C65A2E', '#0E1318')).toBeLessThan(TEXT);
  expect(contrast('#C65A2E', '#0E1318')).toBeGreaterThan(NON_TEXT);
  expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  // A tint composites channel by channel: 50% of black over white is mid grey.
  expect(over('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  expect(over('rgba(0, 0, 0, 0.5)', '#FFFFFF')).toBe('#808080');
});

/**
 * The table above measures copper text on a copper tint as --accent-deep. That
 * only holds if the stylesheets use it: --accent and --sx-text (copper-light,
 * copper-deep) fall under 4.5:1 on a copper tint over --card-2, and Chromium's
 * axe cannot see it because the ground is a color-mix(). So no rule may set
 * --accent or --sx-text as text on a copper background.
 */
test('copper text on a copper tint is --accent-deep in every stylesheet', async () => {
  const { execFileSync } = await import('node:child_process');
  const root = new URL('../../../', import.meta.url).pathname;
  const files = execFileSync('git', ['ls-files', 'site/src', 'blog/src'], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.(css|svelte)$/.test(f));
  const offenders = [];
  for (const f of files) {
    const css = readFileSync(root + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const bg = body.match(/background(?:-color)?:\s*([^;]*(?:--sx|--accent)[^;]*);/);
      if (bg && !bg[1].includes('gradient') && /(?<![-\w])color:\s*var\(--(sx-text|accent)\)/.test(body))
        offenders.push(`${f}: ${sel.trim().split('\n').pop()}`);
    }
  }
  expect(files.length).toBeGreaterThan(50);
  expect(offenders).toEqual([]);
});
