// SPDX-License-Identifier: AGPL-3.0-only

// A held-back solution page is not built, but Pages keeps answering a deleted
// page's address from an old copy, so static/_redirects sends each one to the
// Solutions index. This holds that list equal to the held-back one, both ways: a
// page moved back into `industries` fails here until its redirect line goes.

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { industries, parkedIndustries, routes, solutionHref } from './brand.js';

const redirects = new Map(
  readFileSync(new URL('../../../static/_redirects', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.split(/\s+/).slice(0, 2))
);

test('every held-back solution page redirects to the Solutions index', () => {
  for (const i of parkedIndustries) expect(redirects.get(solutionHref(i.slug))).toBe(routes.solutions);
});

test('no published solution page is redirected, and nothing else under Solutions is', () => {
  for (const i of industries) expect(redirects.has(solutionHref(i.slug))).toBe(false);
  const held = new Set(parkedIndustries.map((i) => solutionHref(i.slug)));
  for (const from of redirects.keys()) if (from.startsWith(`${routes.solutions}/`)) expect(held.has(from)).toBe(true);
});
