// SPDX-License-Identifier: AGPL-3.0-only
//
// scripts/gen-repo-chat.mjs writes only what these checks pass: the pinned file
// set, from the one expected directory, each matching the release's manifest.
// Archives are built here byte by byte, so every refusal is shown on an archive
// that differs from a good one in exactly the way it names. The pinned release
// itself (downloaded by the generator; `bun run test:unit` runs it first) passes.

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { checkManifest, readTar, selectBundle, sha256 } from '../../scripts/lib/repo-chat-bundle.mjs';
import { REPO_CHAT_FILES, REPO_CHAT_TAG, REPO_CHAT_TARBALL, REPO_CHAT_VERSION } from './chat/pin.js';

const DIR = `repo-chat-${REPO_CHAT_TAG}`;
const PINNED = { dir: DIR, files: REPO_CHAT_FILES };

/** One ustar header plus its data, padded to 512-byte blocks. */
function entry(name, data = Buffer.alloc(0), type = '0') {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write(data.length.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
  header.write(type, 156, 1, 'ascii');
  header.write('ustar  \0', 257, 8, 'ascii');
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}
const tar = (...entries) => Buffer.concat([...entries, Buffer.alloc(1024)]);

const payload = Object.fromEntries(REPO_CHAT_FILES.filter((f) => !f.endsWith('.json')).map((f) => [f, Buffer.from(`contents of ${f}`)]));
const manifestOf = (files, over = {}) =>
  Buffer.from(
    JSON.stringify({
      format: 'repo-chat-manifest',
      library_version: REPO_CHAT_VERSION,
      files: Object.fromEntries(Object.entries(files).map(([f, b]) => [f, sha256(b)])),
      ...over,
    })
  );
const goodEntries = (manifest = manifestOf(payload)) => [
  entry(`${DIR}/`, undefined, '5'),
  ...Object.entries(payload).map(([f, b]) => entry(`${DIR}/${f}`, b)),
  entry(`${DIR}/repo-chat.manifest.json`, manifest),
];

describe('a well-formed bundle', () => {
  test('yields exactly the pinned files and passes its manifest', () => {
    const bundle = selectBundle(readTar(tar(...goodEntries())), PINNED);
    expect([...bundle.keys()].sort()).toEqual([...REPO_CHAT_FILES].sort());
    expect(bundle.get('repo-chat.js').toString()).toBe('contents of repo-chat.js');
    expect(() => checkManifest(bundle, REPO_CHAT_VERSION)).not.toThrow();
  });

  test('the pinned release itself passes', () => {
    const tgz = readFileSync(join(import.meta.dir, '..', '..', 'scripts', '.cache', 'repo-chat', REPO_CHAT_TARBALL));
    const bundle = selectBundle(readTar(gunzipSync(tgz)), PINNED);
    expect(() => checkManifest(bundle, REPO_CHAT_VERSION)).not.toThrow();
    expect(bundle.get('lattice_server_bg.wasm').subarray(0, 4)).toEqual(Buffer.from([0, 0x61, 0x73, 0x6d]));
  });
});

describe('refusals', () => {
  const refused = (entries) => () => selectBundle(readTar(tar(...entries)), PINNED);

  test('an extra file', () => {
    expect(refused([...goodEntries(), entry(`${DIR}/extra.js`, Buffer.from('x'))])).toThrow(`${DIR}/extra.js: not one of the pinned files`);
  });

  test('a missing file', () => {
    expect(refused(goodEntries().filter((_, i) => i !== 2))).toThrow(': missing');
  });

  test('a path that climbs out of the directory', () => {
    expect(refused([...goodEntries(), entry(`${DIR}/../repo-chat.js`, Buffer.from('x'))])).toThrow('not one of the pinned files');
  });

  test('a file outside the directory', () => {
    expect(refused([...goodEntries(), entry('repo-chat.js', Buffer.from('x'))])).toThrow('repo-chat.js: not one of the pinned files');
  });

  test('a link in place of a file', () => {
    const entries = goodEntries();
    entries[1] = entry(`${DIR}/${Object.keys(payload)[0]}`, undefined, '2');
    expect(refused(entries)).toThrow('is not a regular file');
  });

  test('the same file twice', () => {
    expect(refused([...goodEntries(), entry(`${DIR}/repo-chat.js`, Buffer.from('second'))])).toThrow('appears twice');
  });

  test('a file whose bytes are not the ones its manifest names', () => {
    const forged = goodEntries();
    forged[forged.length - 1] = entry(`${DIR}/repo-chat.manifest.json`, manifestOf({ ...payload, 'repo-chat.js': Buffer.from('other') }));
    expect(() => checkManifest(selectBundle(readTar(tar(...forged)), PINNED), REPO_CHAT_VERSION)).toThrow('repo-chat.js: sha256');
  });

  test('a manifest of another version', () => {
    const bundle = selectBundle(readTar(tar(...goodEntries(manifestOf(payload, { library_version: '9.9.9' })))), PINNED);
    expect(() => checkManifest(bundle, REPO_CHAT_VERSION)).toThrow('library_version is "9.9.9"');
  });

  test('a manifest that lists a file the bundle does not ship', () => {
    const bundle = selectBundle(readTar(tar(...goodEntries(manifestOf({ ...payload, 'ghost.js': Buffer.from('') })))), PINNED);
    expect(() => checkManifest(bundle, REPO_CHAT_VERSION)).toThrow('lists ');
  });

  test('a truncated archive', () => {
    const whole = tar(...goodEntries());
    expect(() => readTar(whole.subarray(0, 1030))).toThrow('runs past the end');
    expect(() => readTar(Buffer.concat(goodEntries()))).toThrow('no end-of-archive marker');
  });
});
