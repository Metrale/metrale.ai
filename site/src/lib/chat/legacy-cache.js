// SPDX-License-Identifier: AGPL-3.0-only
// =============================================================================
// legacy-cache.js — remove what the site's own chat left in visitors' browsers.
// -----------------------------------------------------------------------------
// Before the library, the site kept the decompressed corpus in the origin's
// private file system as `lattice-db-<commit>.jsonl` (hundreds of MB for the
// engine's corpus) and warmed the wasm into the Cache API bucket
// `metrale-lattice-wasm` under `/lattice/lattice_server_bg.wasm`. The library
// names its files `<prefix>~<id>@<commit>.jsonl` and never prunes a name it did
// not write, so these would stay on disk for good. The button runs this once
// per page the first time the chat opens; once a browser has run it there is
// nothing left to find. The file system and the cache are passed in.
// =============================================================================

export const LEGACY_CORPUS_FILE = /^lattice-db-[^/]+\.jsonl$/;
export const LEGACY_WASM_CACHE = 'metrale-lattice-wasm';
export const LEGACY_WASM_URL = '/lattice/lattice_server_bg.wasm';

/**
 * Delete every legacy corpus file in `dir` (an OPFS directory handle) and the
 * legacy wasm entry in `caches` (the Cache API). Returns what was removed;
 * throws one error naming every removal that failed.
 * @param {{ dir: FileSystemDirectoryHandle | null, caches: CacheStorage | null }} stores
 */
export async function removeLegacyCache({ dir, caches }) {
  const removed = [];
  const failed = [];
  if (dir) {
    const names = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && LEGACY_CORPUS_FILE.test(name)) names.push(name);
    }
    for (const name of names) {
      try {
        await dir.removeEntry(name);
        removed.push(name);
      } catch (err) {
        failed.push(`${name}: ${err?.message ?? err}`);
      }
    }
  }
  // `has` first: `open` would create the bucket just to look inside it.
  if (caches && (await caches.has(LEGACY_WASM_CACHE))) {
    const cache = await caches.open(LEGACY_WASM_CACHE);
    if (await cache.delete(LEGACY_WASM_URL)) removed.push(`${LEGACY_WASM_CACHE} ${LEGACY_WASM_URL}`);
  }
  if (failed.length) throw new Error(`could not remove the old chat's cache: ${failed.join('; ')}`);
  return removed;
}
