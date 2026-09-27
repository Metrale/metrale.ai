// SPDX-License-Identifier: AGPL-3.0-only

// The docs build publishes the engine's book at docs.metrale.ai and moves the
// engine team's hosts to the company's (docs/hosts.mjs). Whole origins move;
// the API reference moves under docs.metrale.ai/api/, where it is published
// beside the book.

import { expect, test } from 'bun:test';
import { HOSTS, rehost, unmoved } from '../../../docs/hosts.mjs';

test('the book, its blog links and its project links move to the company hosts', () => {
  expect(rehost('https://book.dev.metrale.ai/llms.txt')).toBe('https://docs.metrale.ai/llms.txt');
  expect(rehost('see https://blog.dev.metrale.ai/posts/x')).toBe('see https://blog.metrale.ai/posts/x');
  expect(rehost('[the site](https://dev.metrale.ai)')).toBe('[the site](https://metrale.ai)');
});

test('the API reference moves under /api, path kept', () => {
  expect(rehost('https://docs.dev.metrale.ai/')).toBe('https://docs.metrale.ai/api/');
  expect(rehost('https://docs.dev.metrale.ai/metrale_core/')).toBe('https://docs.metrale.ai/api/metrale_core/');
  expect(unmoved('https://docs.dev.metrale.ai/metrale_core/')).toEqual(['https://docs.dev.metrale.ai']);
  expect(unmoved(rehost('https://docs.dev.metrale.ai/metrale_core/'))).toEqual([]);
});

test('a host left behind is named once, and a moved text names none', () => {
  const text = 'https://book.dev.metrale.ai/a https://dev.metrale.ai https://book.dev.metrale.ai/b';
  expect(unmoved(text)).toEqual(['https://book.dev.metrale.ai', 'https://dev.metrale.ai']);
  expect(unmoved(rehost(text))).toEqual([]);
});

test('every host is a whole origin, and moving twice changes nothing', () => {
  for (const [from, to] of HOSTS) {
    expect(from).toMatch(/^https:\/\/[a-z.]+$/);
    expect(rehost(from)).toBe(to);
    expect(rehost(to)).toBe(to);
  }
});
