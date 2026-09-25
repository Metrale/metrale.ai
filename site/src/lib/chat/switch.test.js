// SPDX-License-Identifier: AGPL-3.0-only

// The chat's switch lives in the copy (`codeChat.enabled`) and the browser
// suites read their own (`CHAT_ON`), because the suites cannot import the site's
// modules. This holds the two equal, so turning the chat on turns its tests on.

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { codeChat } from '../data.js';

test('the browser suites follow the chat switch', () => {
  const helpers = readFileSync(new URL('../../../e2e/fixtures/chat-helpers.js', import.meta.url), 'utf8');
  expect(/export const CHAT_ON = (true|false);/.exec(helpers)?.[1]).toBe(String(codeChat.enabled));
});
