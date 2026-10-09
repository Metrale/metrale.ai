// SPDX-License-Identifier: AGPL-3.0-only
//
// scripts/check-static-names.mjs fails the PR workflow when a long-cached file
// under static/ changes content and keeps its name. Its decision is pure: the
// files with their blob ids before and after, each root's cache rules, and the
// documents that link files with a version query. These drive it with
// fixtures, including the real site/static/_headers, so a rule change that
// makes a long-cached path look short (or the reverse) shows here.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { cacheLifetime, LONGEST_SAME_NAME, linkedVersion, parseHeaders, staleUnderSameName } from '../../scripts/check-static-names.mjs';

const siteRules = parseHeaders(readFileSync(new URL('../../static/_headers', import.meta.url), 'utf8'));

test("the site's cache rules read as the lifetimes they set", () => {
  expect(cacheLifetime(siteRules, '/_app/immutable/chunks/x.js')).toBe(Infinity);
  expect(cacheLifetime(siteRules, '/og-image-v2.png')).toBe(2592000);
  expect(cacheLifetime(siteRules, '/fonts/type-v2.css')).toBe(2592000);
  expect(cacheLifetime(siteRules, '/favicon.ico')).toBe(LONGEST_SAME_NAME);
  expect(cacheLifetime(siteRules, '/site.webmanifest')).toBe(300);
  expect(cacheLifetime(siteRules, '/no-rule.txt')).toBe(0);
});

const file = (path, before, after) => ({ root: 'site/static', path: `site/static${path}`, before, after });
const decide = (files, head = [''], base = ['']) =>
  staleUnderSameName(
    files,
    () => siteRules,
    (root, side) => (side === 'head' ? head : base)
  );

test('a month-cached file that changes under its name fails; renamed, new or unchanged files pass', () => {
  expect(decide([file('/og-image.png', 'a', 'b')])).toEqual(['site/static/og-image.png: changed under the same name, cached 2592000 s']);
  expect(decide([file('/og-image-v2.png', undefined, 'b')])).toEqual([]); // a new name
  expect(decide([file('/og-image.png', 'a', undefined)])).toEqual([]); // removed
  expect(decide([file('/logos/x.svg', 'a', 'a')])).toEqual([]); // unchanged
});

test('a short-lived file may change under its name', () => {
  expect(decide([file('/site.webmanifest', 'a', 'b'), file('/favicon.ico', 'a', 'b')])).toEqual([]);
});

test('a fixed-name icon passes only when the query the pages link it with moved too', () => {
  const head = ['<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png?v=4" />'];
  const same = ['<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png?v=4" />'];
  const older = ['<link rel="apple-touch-icon" href="%sveltekit.assets%/apple-touch-icon.png?v=3" />'];
  expect(decide([file('/apple-touch-icon.png', 'a', 'b')], head, older)).toEqual([]);
  expect(decide([file('/apple-touch-icon.png', 'a', 'b')], head, same)).toHaveLength(1);
  expect(decide([file('/apple-touch-icon.png', 'a', 'b')], [''], older)).toHaveLength(1);
});

test('the version query is read by file name, not by a prefix of it', () => {
  expect(linkedVersion('href="/favicon.svg?v=3"', '/favicon.svg')).toBe('3');
  expect(linkedVersion('href="/my-favicon.svg?v=3"', '/favicon.svg')).toBeNull();
  expect(linkedVersion('href="/favicon.svg"', '/favicon.svg')).toBeNull();
});
