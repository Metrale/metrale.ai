// SPDX-License-Identifier: AGPL-3.0-only

// static/.well-known/security.txt (RFC 9116) tells a researcher where to report a
// vulnerability. It restates what the site already publishes, so this holds the
// two equal, and fails when the file is about to lapse: the standard says a
// security.txt past its Expires date is not to be trusted, and it should be
// renewed at least once a year. When the second test fails, move Expires forward
// by up to a year.

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { SITE, contacts, links } from './content/brand.js';

const txt = readFileSync(new URL('../../static/.well-known/security.txt', import.meta.url), 'utf8');
const field = (name) => txt.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1]?.trim();

test('security.txt names the security address, the policy and its own address', () => {
  expect(field('Contact')).toBe(`mailto:${contacts.security}`);
  expect(field('Policy')).toBe(links.securityPolicyDoc);
  expect(field('Canonical')).toBe(`${SITE}/.well-known/security.txt`);
});

test('security.txt has not lapsed, and lapses within a year', () => {
  const expires = Date.parse(field('Expires'));
  const now = Date.now();
  expect(expires).toBeGreaterThan(now + 14 * 24 * 3600 * 1000);
  expect(expires - now).toBeLessThanOrEqual(366 * 24 * 3600 * 1000);
});
