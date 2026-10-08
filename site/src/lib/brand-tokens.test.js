// SPDX-License-Identifier: AGPL-3.0-only
//
// The roles in web-shared/metrale-tokens.css name the brand kit's colours
// (--brand-*, the block kit.mjs writes from assets/brand/tokens/brand.json);
// they do not restate them. This holds each role to the colour the kit's
// guidelines and the owner's rulings give it, resolved through the file, so a
// role pointed at the wrong kit colour, or a hex typed over a kit colour,
// fails here naming the role. It is the swatch half of the brand change
// runbook (site/BRAND-CHANGE.md).
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readTokens } from '../../scripts/brand/tokens.mjs';
import { THEME_DARK_BG, THEME_LIGHT_BG } from '../../../web-shared/theme.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const brand = JSON.parse(read('../../../assets/brand/tokens/brand.json'));
const tokens = readTokens(read('../../../web-shared/metrale-tokens.css'));
const C = Object.fromEntries(Object.entries(brand.color).map(([k, v]) => [k, v.toUpperCase()]));
const dark = (name) => tokens.dark[name]?.toUpperCase();
const light = (name) => tokens.light[name]?.toUpperCase();

test('the grounds are the kit ground and the kit white, and the theme script agrees', () => {
  expect(dark('bg')).toBe(C.ground);
  expect(light('bg')).toBe(C.white);
  expect(light('bg2')).toBe(C.paper);
  expect(THEME_DARK_BG.toUpperCase()).toBe(C.ground);
  expect(THEME_LIGHT_BG.toUpperCase()).toBe(C.white);
});

test("copper leads: the mark is the kit's copper, text and fills its contrast-safe steps", () => {
  expect(dark('mark')).toBe(C[brand.roles.mark]);
  expect(light('mark')).toBe(C[brand.roles.mark]);
  // Copper itself is under 4.5:1 on both grounds, so nothing read as text uses it.
  for (const role of ['accent', 'accent-fill', 'focus', 'sx-text']) {
    expect(dark(role), role).toBe(C.copperLight);
    expect(light(role), role).toBe(C.copperDeep);
  }
  expect(dark('on-accent')).toBe(C.ground);
  expect(light('on-accent')).toBe(C.white);
  // The section accent (rails, chips' tint) is copper on both grounds: one hue, no grammar of four.
  expect(dark('sx')).toBe(C.copper);
  expect(light('sx')).toBe(C.copper);
});

test("the inks are the kit's per ground", () => {
  expect(dark('t1')).toBe(C.ink);
  expect(dark('t3')).toBe(C.grayDark);
  expect(light('t1')).toBe(C.inkDark);
  expect(light('t2')).toBe(C.graphite);
});

test('the roles name kit colours rather than retyping them', () => {
  // A role that resolves to a kit colour must say so by name: a hex equal to a
  // kit colour is a copy that will not follow the next release.
  const kit = new Set(Object.values(C));
  for (const [theme, declared] of Object.entries(tokens.declared)) {
    for (const [name, value] of Object.entries(declared)) {
      if (name.startsWith('brand-')) continue;
      expect(kit.has(value.toUpperCase()) ? `${theme} --${name}: ${value}` : '').toBe('');
    }
  }
});

test("no role is the kit's cyan or any retired hue", () => {
  for (const theme of ['dark', 'light']) {
    for (const [name, value] of Object.entries(tokens[theme])) {
      expect(value.toUpperCase(), `${theme} --${name}`).not.toBe(C.cyan);
    }
    for (const retired of ['ch-violet', 'ch-cyan', 'ch-gold', 'm-ink-hi', 'm-lavender', 'm-cyan-hi', 'm-gold-hi', 'grad', 'bar']) {
      expect(tokens[theme][retired], `${theme} --${retired}`).toBeUndefined();
    }
  }
});

test("the type is the kit's family, then the kit's metric-matched fallback", () => {
  const families = tokens.dark['font-sans'].split(',').map((f) => f.trim().replace(/'/g, ''));
  expect(families.slice(0, 3)).toEqual([brand.type.family, `${brand.type.family} Fallback`, 'Helvetica Neue']);
  const fallback = read('../styles/manrope-fallback.css');
  expect(fallback).toContain(`font-family: '${brand.type.family} Fallback'`);
});
