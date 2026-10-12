#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// gen-repo-chat.mjs — vendor the codebase chat library into static/repo-chat/
// -----------------------------------------------------------------------------
// SSOT: the release pinned in src/lib/chat/pin.js, published under
// REPO_CHAT_RELEASES (web-shared/sources.mjs). The tarball is one directory,
// repo-chat-v<version>/, holding the library (repo-chat.js, repo-chat.css),
// the LatticeDB wasm pair it loads and a manifest with the sha256 of each.
//
// Regenerate with:   node site/scripts/gen-repo-chat.mjs
//
// The tarball must match its pinned sha256 and size: a release asset that
// changes under a tag is a supply-chain event and fails the build loudly. Its
// files must then be exactly the pinned set and match its own manifest
// (scripts/lib/repo-chat-bundle.mjs). They are written to
// static/repo-chat/<version>/, so a new release is a new path and can be cached
// immutably (static/_headers). The download is cached in scripts/.cache/repo-chat/
// so repeat builds work offline; no cache and no network is a hard failure
// (this generator is in vite.config.js's hard-fail group).
// =============================================================================

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { REPO_CHAT_RELEASES } from '../../web-shared/sources.mjs';
import {
  REPO_CHAT_FILES,
  REPO_CHAT_TAG,
  REPO_CHAT_TARBALL,
  REPO_CHAT_TARBALL_BYTES,
  REPO_CHAT_TARBALL_SHA256,
  REPO_CHAT_VERSION,
} from '../src/lib/chat/pin.js';
import { checkManifest, readTar, selectBundle, sha256 } from './lib/repo-chat-bundle.mjs';

const URL_ = `${REPO_CHAT_RELEASES}/${REPO_CHAT_TAG}/${REPO_CHAT_TARBALL}`;
const here = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(here, '.cache', 'repo-chat', REPO_CHAT_TARBALL);
const ROOT = resolve(here, '..', 'static', 'repo-chat');
const OUT = resolve(ROOT, REPO_CHAT_VERSION);

const fail = (msg) => {
  console.error(`gen-repo-chat: ${msg}`);
  process.exit(1);
};

const pinned = (buf) => sha256(buf) === REPO_CHAT_TARBALL_SHA256 && buf.length === REPO_CHAT_TARBALL_BYTES;

let tarball = null;
let origin = 'cache';
if (existsSync(CACHE)) {
  const cached = readFileSync(CACHE);
  if (pinned(cached)) tarball = cached;
  else console.error(`gen-repo-chat: the cached ${REPO_CHAT_TARBALL} fails its pin, downloading it again`);
}
if (tarball === null) {
  origin = 'download';
  try {
    const res = await fetch(URL_, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tarball = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    fail(`cannot vendor ${REPO_CHAT_TARBALL}: no valid cache and the download failed (${err?.message ?? err}). SSOT: ${URL_}`);
  }
  if (!pinned(tarball)) {
    fail(
      `sha256 MISMATCH for ${REPO_CHAT_TARBALL}\n` +
        `  expected ${REPO_CHAT_TARBALL_SHA256} (${REPO_CHAT_TARBALL_BYTES} B)\n` +
        `  actual   ${sha256(tarball)} (${tarball.length} B)\n` +
        `A changed release asset under the pinned tag ${REPO_CHAT_TAG} is a supply-chain event. Refusing to vendor it.`
    );
  }
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, tarball);
}

let bundle;
try {
  bundle = selectBundle(readTar(gunzipSync(tarball)), { dir: `repo-chat-${REPO_CHAT_TAG}`, files: REPO_CHAT_FILES });
  checkManifest(bundle, REPO_CHAT_VERSION);
} catch (err) {
  fail(err.message);
}

// The whole directory is generated: clear it, so an older version never ships beside this one.
rmSync(ROOT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const [name, data] of bundle) writeFileSync(resolve(OUT, name), data);

console.log(`Wrote ${OUT}\n  repo-chat ${REPO_CHAT_VERSION} (${origin}), tarball and all ${bundle.size} files sha256-checked`);
for (const [name, data] of bundle) console.log(`  - ${name} (${data.length} B) ${sha256(data).slice(0, 12)}…`);
