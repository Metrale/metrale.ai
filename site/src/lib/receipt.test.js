// SPDX-License-Identifier: AGPL-3.0-only
//
// The latest point of a chart links to the record it was drawn from. A wrong
// pick here sends a reader to verify a record the chart does not show, so the
// newest-record rule and the unsigned case are held exactly.

import { expect, test } from 'bun:test';
import { ENGINE_REPO } from '../../../web-shared/sources.mjs';
import { latestReceipt, recordFileUrl, signatureUrl, signerKeyUrl } from './receipt.js';

const rec = (o) => ({
  git_sha: 'a6d711dc0e',
  recorded_at: 100,
  path: '.benchmarks/decode-floor/2026-09-24-a6d711dc0e.json',
  signer: '02156264cbf75bd7',
  branch: '',
  ...o,
});

test('the newest record is the receipt, whatever order the chart holds them in', () => {
  const r = latestReceipt([rec({ recorded_at: 300, git_sha: 'new' }), rec({ recorded_at: 100 }), rec({ recorded_at: 200 })]);
  expect(r.sha).toBe('new');
  expect(r.record).toBe(`${ENGINE_REPO}/blob/main/.benchmarks/decode-floor/2026-09-24-a6d711dc0e.json`);
  expect(r.signature).toBe(`${r.record}.sig`);
  expect(r.signer).toBe(`${ENGINE_REPO}/blob/main/.github/record-signers/02156264cbf75bd7.pub`);
});

test('a newer record that does not say where it lives is passed over, not linked', () => {
  const r = latestReceipt([rec({ recorded_at: 100, git_sha: 'filed' }), rec({ recorded_at: 900, git_sha: 'nowhere', path: undefined })]);
  expect(r.sha).toBe('filed');
});

test('an unsigned record has a record link and no signature or key', () => {
  expect(signatureUrl(rec({ signer: null }))).toBeNull();
  expect(signerKeyUrl(rec({ signer: null }))).toBeNull();
  expect(recordFileUrl(rec({ signer: null }))).toContain('/blob/main/.benchmarks/');
});

test('a record found on a branch links that branch', () => {
  expect(recordFileUrl(rec({ branch: 'pr/42' }))).toBe(`${ENGINE_REPO}/blob/pr/42/.benchmarks/decode-floor/2026-09-24-a6d711dc0e.json`);
});

test('nothing to link is no receipt', () => {
  expect(latestReceipt([])).toBeNull();
  expect(latestReceipt(undefined)).toBeNull();
  expect(latestReceipt([rec({ path: undefined })])).toBeNull();
});
