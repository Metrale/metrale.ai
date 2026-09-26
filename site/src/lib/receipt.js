// SPDX-License-Identifier: AGPL-3.0-only
//
// Where a gate record's receipt lives: the record file, the signature beside
// it, and the public key that made the signature. One place builds these
// addresses, so the dashboard's charts, its point cards and the reproduction
// steps all link the same files.

import { ENGINE_REPO } from '../../../web-shared/sources.mjs';

/**
 * How a record is signed and what the signature does and does not prove: the
 * certification chapter of the engine's book.
 */
export const RECORD_SIGNING_DOC = 'https://docs.metrale.ai/project/landing.html';

/** The branch a record was found on; a committed record is on main. */
const branchOf = (r) => r?.branch || 'main';

/** The record file, or null when the record does not say where it lives. */
export const recordFileUrl = (r) => (r?.path ? `${ENGINE_REPO}/blob/${branchOf(r)}/${r.path}` : null);

/** The detached signature beside the record, when the record was signed. */
export const signatureUrl = (r) => (r?.path && r.signer ? `${recordFileUrl(r)}.sig` : null);

/** The public key that made the signature, as committed in the engine. */
export const signerKeyUrl = (r) => (r?.signer ? `${ENGINE_REPO}/blob/${branchOf(r)}/.github/record-signers/${r.signer}.pub` : null);

/**
 * The receipt for the newest record among `records`, the one a chart's latest
 * point stands for. Records that do not say where they live are passed over:
 * a receipt that links nowhere is not one.
 *
 * @returns {{sha: string, recordedAt: number, record: string, signature: string|null, signer: string|null}|null}
 */
export function latestReceipt(records) {
  const newest = (records ?? []).filter((r) => r?.path).reduce((a, r) => (a === null || r.recorded_at > a.recorded_at ? r : a), null);
  if (!newest) return null;
  return {
    sha: newest.git_sha,
    recordedAt: newest.recorded_at,
    record: recordFileUrl(newest),
    signature: signatureUrl(newest),
    signer: signerKeyUrl(newest),
  };
}
