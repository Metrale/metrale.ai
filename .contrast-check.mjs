/**
 * Dark-theme text contrast gate.
 *
 * Every text token clears WCAG AA (4.5:1) on every surface a page paints text
 * on, in the dark theme, the one both properties open in. The light theme's text
 * is held by site/src/lib/light-text-contrast.test.js. The tokens come from
 * web-shared/metrale-tokens.css, the single source for the site and the blog;
 * the first definition of each is the dark theme's (`:root`).
 *
 *   bun .contrast-check.mjs          # from the repository root
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const tokensCss = readFileSync(resolve(here, 'web-shared/metrale-tokens.css'), 'utf8');

const token = (name) => {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!m) throw new Error(`token --${name} not found in web-shared/metrale-tokens.css`);
  return m[1];
};

/* ---------- colour maths (WCAG 2.x relative luminance) ---------- */

const srgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const relLum = (v) => 0.2126 * lin(v[0]) + 0.7152 * lin(v[1]) + 0.0722 * lin(v[2]);
const contrast = (a, b) => {
  const [hi, lo] = [relLum(srgb(a)), relLum(srgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const surfaces = { bg: token('bg'), bg2: token('bg2'), card: token('card'), 'card-2': token('card-2') };
const texts = { 't1 headings': token('t1'), 't2 body': token('t2'), 't3 metadata': token('t3') };

/* ---------- report ---------- */

const AA = 4.5;
let worst = Infinity;
let failed = 0;
const head = ['text token', ...Object.keys(surfaces)];
const rows = [];
for (const [label, hex] of Object.entries(texts)) {
  const cells = Object.values(surfaces).map((s) => contrast(hex, s));
  worst = Math.min(worst, ...cells);
  failed += cells.filter((c) => c < AA).length;
  rows.push([`${label} ${hex}`, ...cells.map((c) => c.toFixed(2))]);
}
const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
const line = (cells) => cells.map((c, i) => c.padEnd(w[i])).join('  ');
console.log(line(head));
console.log(w.map((n) => '-'.repeat(n)).join('  '));
for (const r of rows) console.log(line(r));
console.log('');

if (failed) {
  console.error(`FAIL: ${failed} pairing(s) fall below AA ${AA}:1 in the dark theme. Lighten the text token or darken the surface.`);
  process.exit(1);
}
console.log(`PASS: every text token clears AA ${AA}:1 on every dark surface; tightest is ${worst.toFixed(2)}:1.`);
