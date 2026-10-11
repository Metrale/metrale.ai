// SPDX-License-Identifier: AGPL-3.0-only
//
// static/_headers sends a Content-Security-Policy whose connect-src is a list
// of addresses the site's own code calls. The addresses live in code, the
// policy lives in a text file, and nothing else ties them: a new endpoint, or
// the forms Worker switched on, would be blocked in every visitor's browser
// while every test here still passed. This ties them, and holds the other
// security headers the host promises.

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formEndpoint, primeEndpoint } from './brand.js';
import { CORPORA, OPENROUTER_API_URL, REPO_CHAT_BASE, WASM_BIN_URL, corpusUrls } from '../chat/config.js';
import { AGENT_URL } from '../agent/protocol.js';

const HEADERS = readFileSync(join(import.meta.dir, '..', '..', '..', 'static', '_headers'), 'utf8');

/** The headers the `/*` rule sets, by lower-cased name. */
function catchAll(text) {
  const out = {};
  let inRule = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) inRule = line.trim() === '/*';
    else if (inRule) {
      const i = line.indexOf(':');
      out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    }
  }
  return out;
}

/** A policy as { directive: [sources] }. */
const parsePolicy = (policy) =>
  Object.fromEntries(
    policy
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((d) => d[0])
      .map(([name, ...sources]) => [name, sources])
  );

/** Whether `url` may be fetched under `sources` (origins and 'self' only: all this policy uses). */
export function allows(sources, url, self = 'https://metrale.ai') {
  const u = new URL(url, self);
  if (u.origin === self) return sources.includes("'self'");
  return sources.some((s) => s !== "'self'" && new URL(s).origin === u.origin);
}

const headers = catchAll(HEADERS);
const csp = parsePolicy(headers['content-security-policy'] ?? '');

// Every corpus the codebase chat fetches, both files of each.
const corpusFiles = CORPORA.map(corpusUrls).flatMap((c) => [c.gzUrl, c.metaUrl]);

test('every address the site calls is in connect-src', () => {
  const calls = [primeEndpoint, OPENROUTER_API_URL, ...corpusFiles, AGENT_URL, WASM_BIN_URL, formEndpoint].filter(Boolean);
  expect(corpusFiles.length).toBeGreaterThan(0);
  expect(calls.filter((url) => !allows(csp['connect-src'] ?? [], url))).toEqual([]);
});

// The chat library is imported as a module, links its stylesheet and compiles
// its wasm: all from this origin, which script-src and style-src must allow,
// and the wasm needs 'wasm-unsafe-eval'. Its theme is set through the DOM's
// style API, which a policy does not govern.
test('the codebase chat library loads from this origin under the policy', () => {
  expect(new URL(REPO_CHAT_BASE, 'https://metrale.ai').origin).toBe('https://metrale.ai');
  expect(allows(csp['script-src'] ?? [], `${REPO_CHAT_BASE}repo-chat.js`)).toBe(true);
  expect(allows(csp['style-src'] ?? [], `${REPO_CHAT_BASE}repo-chat.css`)).toBe(true);
  expect(csp['script-src']).toContain("'wasm-unsafe-eval'");
});

// The control: an address nobody listed is refused by the same reader.
test('an address that is not listed is refused', () => {
  expect(allows(csp['connect-src'] ?? [], 'https://evil.example/collect')).toBe(false);
  expect(allows(csp['connect-src'] ?? [], 'ws://127.0.0.1:9999/ws')).toBe(false);
});

test('the policy closes what the site never uses', () => {
  expect(csp['default-src']).toEqual(["'self'"]);
  expect(csp['object-src']).toEqual(["'none'"]);
  expect(csp['base-uri']).toEqual(["'self'"]);
  expect(csp['frame-ancestors']).toEqual(["'self'"]);
  expect(csp['form-action']).toEqual(["'self'"]);
});

test('HSTS and a Permissions-Policy ride with it', () => {
  expect(headers['strict-transport-security']).toMatch(/^max-age=31536000; includeSubDomains; preload$/);
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['permissions-policy']).toContain('microphone=()');
  expect(headers['permissions-policy']).toContain('geolocation=()');
});
