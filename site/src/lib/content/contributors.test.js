// SPDX-License-Identifier: AGPL-3.0-only
//
// The contributors page is a static list: `contributors.people` in
// resources.js, frozen from the engine's history and extended by hand. Two
// ways it can quietly lose someone, both held here: a core role written for a
// login the list does not carry renders nowhere, and a login written twice
// renders twice.

import { expect, test } from 'bun:test';
import { contributors } from './resources.js';

test('every core role belongs to someone on the list', () => {
  expect(Object.keys(contributors.core).filter((login) => !contributors.people.includes(login))).toEqual([]);
});

test('each person is listed once, as a GitHub login', () => {
  expect(new Set(contributors.people).size).toBe(contributors.people.length);
  for (const login of contributors.people) expect(login).toMatch(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/);
});
