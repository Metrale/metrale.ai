// SPDX-License-Identifier: AGPL-3.0-only
//
// The blog names its faces in two places: the token file's --font-sans (the
// brand's Manrope, then the kit's 'Manrope Fallback') and the faces it loads:
// @font-face rules in its stylesheets, and the brand face, which
// src/lib/brand-face.js adds after load. For years the sans face was named and
// never shipped, and every heading fell to a system font without a failing
// check, because a browser's document.fonts.check() is true for a family
// nobody declared. So this holds both ends: each family --font-sans names
// first is loaded, and every file a face loads is in static/.
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brandFiles } from '../../../web-shared/brand-files.mjs';
import { BRAND_FACE, attachBrandFace } from './brand-face.js';

const here = dirname(fileURLToPath(import.meta.url));
const BLOG = resolve(here, '..', '..');
const read = (p) => readFileSync(p, 'utf8');

// app.css and the stylesheets it imports, in order.
const sheets = (file, seen = new Set()) => {
  if (seen.has(file)) return [];
  seen.add(file);
  const css = read(file);
  const imports = [...css.matchAll(/@import\s+'([^']+)'/g)].map((m) => resolve(dirname(file), m[1]));
  return [css, ...imports.flatMap((f) => sheets(f, seen))];
};
const css = sheets(join(BLOG, 'src', 'app.css')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => ({
  family: m[1].match(/font-family:\s*['"]?([^;'"]+)['"]?/)?.[1],
  urls: [...m[1].matchAll(/url\(['"]?([^'")]+)['"]?\)/g)].map((u) => u[1]),
}));
const sans = css
  .match(/--font-sans:\s*([^;]+);/)[1]
  .split(',')
  .map((f) => f.trim().replace(/^['"]|['"]$/g, ''));

test('the first two families of --font-sans are the brand face and its fallback, and both are loaded', () => {
  expect(sans.slice(0, 2)).toEqual(['Manrope', 'Manrope Fallback']);
  expect(BRAND_FACE.family).toBe(sans[0]);
  expect(faces.some((f) => f.family === sans[1])).toBe(true);
});

test('the brand face loads the versioned file the kit derivation ships, and it is in static/', () => {
  expect(BRAND_FACE.url).toBe(brandFiles.blogManrope);
  expect(existsSync(join(BLOG, 'static', BRAND_FACE.url))).toBe(true);
});

test('every file a stylesheet face loads is in static/', () => {
  const urls = faces.flatMap((f) => f.urls).filter((u) => u.startsWith('/'));
  expect(urls.length).toBeGreaterThanOrEqual(4); // Charter's four
  expect(urls.filter((u) => !existsSync(join(BLOG, 'static', u)))).toEqual([]);
});

// A window and a document with just what attachBrandFace touches.
const harness = ({ ready = 'complete', warm = false, fontFace = true } = {}) => {
  const added = [];
  const listeners = {};
  const idles = [];
  const store = new Map(warm ? [['metrale-blog-face', '1']] : []);
  const win = {
    FontFace: fontFace
      ? class {
          constructor(family, src, descriptors) {
            Object.assign(this, { family, src, descriptors });
          }
          load() {
            return Promise.resolve(this);
          }
        }
      : undefined,
    localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    requestIdleCallback: (fn) => idles.push(fn),
    addEventListener: (type, fn) => (listeners[type] = fn),
  };
  const doc = { readyState: ready, fonts: { add: (f) => added.push(f) } };
  return { win, doc, added, listeners, idles, store };
};

test('the face is added only after load and at idle, from the shipped file', () => {
  const h = harness({ ready: 'loading' });
  attachBrandFace(h.win, h.doc);
  expect(h.added).toEqual([]);
  h.listeners.load();
  expect(h.added).toEqual([]);
  h.idles.shift()();
  expect(h.added.map((f) => [f.family, f.src])).toEqual([['Manrope', `url(${brandFiles.blogManrope}) format('woff2')`]]);
});

test('a visitor who already has the file gets the face at once; no FontFace, no face', async () => {
  const warm = harness({ ready: 'loading', warm: true });
  attachBrandFace(warm.win, warm.doc);
  expect(warm.added).toHaveLength(1);
  const cold = harness();
  attachBrandFace(cold.win, cold.doc);
  cold.idles.shift()();
  await Promise.resolve();
  await Promise.resolve();
  expect(cold.store.get('metrale-blog-face')).toBe('1');
  const old = harness({ fontFace: false });
  attachBrandFace(old.win, old.doc);
  expect(old.idles).toHaveLength(0);
});
