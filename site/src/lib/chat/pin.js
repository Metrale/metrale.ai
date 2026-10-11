// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// pin.js — the one release of the codebase chat library this site serves.
// -----------------------------------------------------------------------------
// The chat is AutoRepoRAG's website-chat library (REPO_CHAT_RELEASES in
// web-shared/sources.mjs names where its releases live). scripts/gen-repo-chat.mjs
// downloads the release tarball named here, refuses it unless its sha256 and
// size match, and writes its files to static/repo-chat/<version>/. The page
// imports the library from that directory (chat/config.js), so the version in
// the path and the bytes behind it move together, in one edit to this file.
//
// To move to a new release: change the version, the sha256 (the release ships
// it as repo-chat-v<version>.tar.gz.sha256; check it against your own download)
// and the size, then run `node scripts/gen-repo-chat.mjs`.
// =============================================================================

export const REPO_CHAT_VERSION = '2.1.0';
export const REPO_CHAT_TAG = `v${REPO_CHAT_VERSION}`;
export const REPO_CHAT_TARBALL = `repo-chat-${REPO_CHAT_TAG}.tar.gz`;
export const REPO_CHAT_TARBALL_SHA256 = '9414f4c2bddd6d32409c0b660d5f961ffd1c6ab497cdb8966d51f63a5fc40f39';
export const REPO_CHAT_TARBALL_BYTES = 327023;

/** Every file the tarball must carry, in its one top-level directory. Nothing more, nothing less. */
export const REPO_CHAT_FILES = Object.freeze([
  'lattice_server.js',
  'lattice_server_bg.wasm',
  'repo-chat.css',
  'repo-chat.js',
  'repo-chat.manifest.json',
]);
