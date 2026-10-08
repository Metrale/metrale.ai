import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { readTokens } from '../../scripts/brand/tokens.mjs';

/**
 * `<meta name="theme-color">` paints the browser chrome and the mobile status
 * bar. It cannot read a CSS custom property, so it is the one place the ground
 * colour has to be written out by hand — and therefore the one place it can
 * silently disagree with the page.
 *
 * It did: the palette move swept every stylesheet and missed both app.html
 * files, leaving the chrome the previous ground above a #0E1318 page.
 */
const tokens = readTokens(readFileSync(new URL('../../../web-shared/metrale-tokens.css', import.meta.url), 'utf8'));
const bg = tokens.dark.bg;
const lightBg = tokens.light.bg;

test('the token file defines --bg (so the comparisons below are not vacuous)', () => {
  expect(bg).toMatch(/^#[0-9a-fA-F]{6}$/);
  expect(lightBg).toMatch(/^#[0-9a-fA-F]{6}$/);
  expect(lightBg.toLowerCase()).not.toBe(bg.toLowerCase());
});

test('the PWA manifest agrees with the page it frames', () => {
  // theme_color is the window chrome; background_color is the splash. The
  // manifest is the kit's (scripts/brand/kit.mjs), and a manifest cannot read
  // a custom property, which is exactly why it needs pinning to the page.
  const manifest = JSON.parse(readFileSync(new URL('../../static/site.webmanifest', import.meta.url), 'utf8'));
  expect(manifest.theme_color?.toLowerCase()).toBe(bg.toLowerCase());
  expect(manifest.background_color?.toLowerCase()).toBe(bg.toLowerCase());
});

for (const [label, rel] of [
  ['marketing site', '../../src/app.html'],
  ['blog', '../../../blog/src/app.html'],
]) {
  test(`${label}: theme-color equals --bg`, () => {
    const html = readFileSync(new URL(rel, import.meta.url), 'utf8');
    const m = html.match(/<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{6})"/);
    expect(m, `${label}: no theme-color meta found`).not.toBeNull();
    expect(m[1].toLowerCase()).toBe(bg.toLowerCase());
  });
  test(`${label}: light theme-color equals light --bg`, () => {
    const html = readFileSync(new URL(rel, import.meta.url), 'utf8');
    const m = html.match(/<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{6})"\s+media="\(prefers-color-scheme: light\)"/);
    expect(m, `${label}: no light theme-color meta found`).not.toBeNull();
    expect(m[1].toLowerCase()).toBe(lightBg.toLowerCase());
  });
}
