// SPDX-License-Identifier: AGPL-3.0-only
//
// reference-serve.js: what a row says about a vLLM bar taken at another
// context. Each side of the comparison has its own case, and the row AT the
// serve's context is the control that says nothing.
import { describe, expect, test } from 'bun:test';
import { contextLabel, rowQualifier, rowQualifiers, vllmLabel } from './reference-serve.js';

const SERVE = 262144;

describe('the vLLM line', () => {
  test('names its serve when one is declared; CONTROL: plain without one', () => {
    expect(vllmLabel(SERVE)).toBe('vLLM (256k serve)');
    expect(vllmLabel(null)).toBe('vLLM');
  });
});

describe('a row against the serve', () => {
  test('below the serve: vLLM was not run here, the bar is the bigger serve', () => {
    expect(rowQualifier(65536, SERVE)).toBe('vLLM not run at 64k; bar is its 256k serve');
  });
  test('above the serve: vLLM was not run here, it cannot serve this context', () => {
    expect(rowQualifier(524288, SERVE)).toBe('vLLM not run at 512k (its serve max is 256k)');
  });
  test('CONTROL: at the serve, or with either context unknown, nothing is said', () => {
    expect(rowQualifier(SERVE, SERVE)).toBeNull();
    expect(rowQualifier(null, SERVE)).toBeNull();
    expect(rowQualifier(65536, null)).toBeNull();
  });
  test('a row whose cells name two serves says each once, in order', () => {
    expect(rowQualifiers(65536, [SERVE, SERVE, 131072, null])).toEqual([
      'vLLM not run at 64k; bar is its 256k serve',
      'vLLM not run at 64k; bar is its 128k serve',
    ]);
    expect(rowQualifiers(SERVE, [SERVE, null])).toEqual([]);
  });
  test('contexts read as people say them', () => {
    expect([contextLabel(65536), contextLabel(524288), contextLabel(40000)]).toEqual(['64k', '512k', '40000']);
  });
});
