// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// repo-chat-bundle.mjs — read and check the repo-chat release tarball. Pure:
// bytes in, files or a refusal out. scripts/gen-repo-chat.mjs does the I/O.
// -----------------------------------------------------------------------------
// The tarball's own sha256 is pinned (src/lib/chat/pin.js), so a changed
// release is already refused before this runs. What this adds is that only the
// pinned file set is ever written, from inside the one expected directory, and
// that every file matches the sha256 the release's own manifest records for it.
// A link, a path that climbs out, a missing or an extra file is refused.
// =============================================================================

import { createHash } from 'node:crypto';

const BLOCK = 512;
const MANIFEST = 'repo-chat.manifest.json';

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const text = (buf, start, end) => {
  const field = buf.subarray(start, end);
  const nul = field.indexOf(0);
  return field.subarray(0, nul === -1 ? field.length : nul).toString('utf8');
};

/**
 * The entries of an uncompressed ustar/GNU tar archive.
 * @param {Buffer} tar
 * @returns {{ name: string, type: string, data: Buffer }[]}
 */
export function readTar(tar) {
  const entries = [];
  let at = 0;
  while (at + BLOCK <= tar.length) {
    const header = tar.subarray(at, at + BLOCK);
    if (header.every((b) => b === 0)) return entries;
    const sizeField = text(header, 124, 136).trim();
    if (!/^[0-7]+$/.test(sizeField)) throw new Error(`tar: entry at byte ${at} has no octal size`);
    const size = parseInt(sizeField, 8);
    const prefix = text(header, 345, 500);
    const base = text(header, 0, 100);
    const name = prefix ? `${prefix}/${base}` : base;
    const type = text(header, 156, 157) || '0';
    const start = at + BLOCK;
    if (start + size > tar.length) throw new Error(`tar: ${name} runs past the end of the archive`);
    entries.push({ name, type, data: tar.subarray(start, start + size) });
    at = start + Math.ceil(size / BLOCK) * BLOCK;
  }
  throw new Error('tar: the archive has no end-of-archive marker');
}

/**
 * The pinned files out of the archive's entries, or a thrown list of what is wrong.
 * @param {{ name: string, type: string, data: Buffer }[]} entries
 * @param {{ dir: string, files: readonly string[] }} expected
 * @returns {Map<string, Buffer>}
 */
export function selectBundle(entries, { dir, files }) {
  const problems = [];
  const out = new Map();
  for (const { name, type, data } of entries) {
    if (type === '5' && name.replace(/\/$/, '') === dir) continue;
    const file = name.startsWith(`${dir}/`) ? name.slice(dir.length + 1) : null;
    if (type !== '0') problems.push(`${name}: entry type ${JSON.stringify(type)} is not a regular file`);
    else if (file === null || !files.includes(file)) problems.push(`${name}: not one of the pinned files under ${dir}/`);
    else if (out.has(file)) problems.push(`${name}: appears twice`);
    else out.set(file, data);
  }
  for (const f of files) if (!out.has(f) && !problems.some((p) => p.startsWith(`${dir}/${f}:`))) problems.push(`${dir}/${f}: missing`);
  if (problems.length) throw new Error(`the repo-chat tarball is not the pinned bundle:\n  ${problems.join('\n  ')}`);
  return out;
}

/**
 * Hold every file to the sha256 the bundle's manifest names, and the manifest to the pinned version.
 * @param {Map<string, Buffer>} bundle
 * @param {string} version
 */
export function checkManifest(bundle, version) {
  const manifest = JSON.parse(bundle.get(MANIFEST).toString('utf8'));
  const problems = [];
  if (manifest.format !== 'repo-chat-manifest') problems.push(`format is ${JSON.stringify(manifest.format)}`);
  if (manifest.library_version !== version)
    problems.push(`library_version is ${JSON.stringify(manifest.library_version)}, pinned ${version}`);
  const listed = Object.keys(manifest.files ?? {}).sort();
  const shipped = [...bundle.keys()].filter((f) => f !== MANIFEST).sort();
  if (listed.join() !== shipped.join()) problems.push(`lists ${listed.join(', ')} but the bundle ships ${shipped.join(', ')}`);
  for (const f of shipped) {
    const want = manifest.files?.[f];
    if (want && sha256(bundle.get(f)) !== want) problems.push(`${f}: sha256 ${sha256(bundle.get(f))} is not the manifest's ${want}`);
  }
  if (problems.length) throw new Error(`the repo-chat manifest does not hold:\n  ${problems.join('\n  ')}`);
}
