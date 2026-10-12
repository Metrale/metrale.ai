// SPDX-License-Identifier: AGPL-3.0-only
//
// The old chat's corpus files and wasm cache entry are removed, and nothing
// else is. The file system and the cache are in-memory stand-ins with the
// handful of methods the browser's own have (OPFS and the Cache API do not
// exist outside a browser); e2e/chat.spec.js runs the same code on the real ones.

import { describe, expect, test } from 'bun:test';
import { CORPORA, WASM_BIN_URL } from './config.js';
import { LEGACY_WASM_CACHE, LEGACY_WASM_URL, RETIRED_CORPUS_IDS, removeLegacyCache } from './legacy-cache.js';

function fakeDir(entries, { failOn = [] } = {}) {
  const map = new Map(entries.map(([name, kind]) => [name, { kind }]));
  return {
    map,
    async *entries() {
      for (const [name, handle] of [...map]) yield [name, handle];
    },
    async removeEntry(name) {
      if (failOn.includes(name)) throw new Error('locked');
      map.delete(name);
    },
  };
}

function fakeCaches(buckets) {
  const store = new Map(Object.entries(buckets).map(([name, urls]) => [name, new Set(urls)]));
  return {
    store,
    has: async (name) => store.has(name),
    open: async (name) => {
      if (!store.has(name)) store.set(name, new Set());
      const set = store.get(name);
      // The Cache API keys entries by absolute Request URLs.
      return {
        keys: async () => [...set].map((u) => ({ url: `https://metrale.ai${u}` })),
        delete: async (req) => set.delete(new URL(req.url).pathname),
      };
    },
  };
}

const SHA = 'a012b44c0de5a012b44c0de5a012b44c0de5a012';
const LIBRARY_FILES = [
  [`metrale-~crates@${SHA}.jsonl`, 'file'],
  [`metrale-~crates@${SHA}.meta.json`, 'file'],
  [`metrale-~kernels@${SHA}.jsonl`, 'file'],
];

describe('removeLegacyCache', () => {
  test("removes every old corpus file and only those, keeping the library's", async () => {
    const dir = fakeDir([
      ['lattice-db-246f71bf5da3a0a984d2ab9273ab22c0abdd371e.jsonl', 'file'],
      ['lattice-db-00stale00.jsonl', 'file'],
      ['lattice-db-notes.txt', 'file'],
      ['lattice-db-dir.jsonl', 'directory'],
      ...LIBRARY_FILES,
    ]);
    const removed = await removeLegacyCache({ dir, caches: null });
    expect(removed.sort()).toEqual(['lattice-db-00stale00.jsonl', 'lattice-db-246f71bf5da3a0a984d2ab9273ab22c0abdd371e.jsonl']);
    expect([...dir.map.keys()].sort()).toEqual(['lattice-db-dir.jsonl', 'lattice-db-notes.txt', ...LIBRARY_FILES.map(([n]) => n)].sort());
  });

  test("removes the old site's wasm and earlier releases', keeping the current release's", async () => {
    const older = ['/repo-chat/2.1.0/lattice_server_bg.wasm', '/repo-chat/2.2.0/lattice_server_bg.wasm'];
    const caches = fakeCaches({ [LEGACY_WASM_CACHE]: [LEGACY_WASM_URL, ...older, WASM_BIN_URL] });
    expect((await removeLegacyCache({ dir: null, caches })).sort()).toEqual(
      [LEGACY_WASM_URL, ...older].map((u) => `${LEGACY_WASM_CACHE} ${u}`).sort()
    );
    expect([...caches.store.get(LEGACY_WASM_CACHE)]).toEqual([WASM_BIN_URL]);
    expect(WASM_BIN_URL).not.toBe(older[1]);
  });

  test('never creates the bucket it is looking in', async () => {
    const caches = fakeCaches({});
    expect(await removeLegacyCache({ dir: fakeDir([]), caches })).toEqual([]);
    expect(caches.store.size).toBe(0);
  });

  test('a file it cannot remove is reported, after the others are removed', async () => {
    const dir = fakeDir(
      [
        ['lattice-db-a.jsonl', 'file'],
        ['lattice-db-b.jsonl', 'file'],
      ],
      { failOn: ['lattice-db-a.jsonl'] }
    );
    await expect(removeLegacyCache({ dir, caches: null })).rejects.toThrow('lattice-db-a.jsonl: locked');
    expect([...dir.map.keys()]).toEqual(['lattice-db-a.jsonl']);
  });

  test('removes the retired code corpus, data and meta, and nothing that only looks like it', async () => {
    const dir = fakeDir([
      ['metrale-~code@246f71bf5da3a0a984d2ab9273ab22c0abdd371e.jsonl', 'file'],
      ['metrale-~code@246f71bf5da3a0a984d2ab9273ab22c0abdd371e.meta.json', 'file'],
      [`metrale-~codex@${SHA}.jsonl`, 'file'],
      [`other-site-~code@${SHA}.jsonl`, 'file'],
      [`metrale-~code@${SHA}.jsonl.crswap`, 'file'],
      ...LIBRARY_FILES,
    ]);
    const removed = await removeLegacyCache({ dir, caches: null });
    expect(removed.sort()).toEqual([
      'metrale-~code@246f71bf5da3a0a984d2ab9273ab22c0abdd371e.jsonl',
      'metrale-~code@246f71bf5da3a0a984d2ab9273ab22c0abdd371e.meta.json',
    ]);
    expect([...dir.map.keys()].sort()).toEqual(
      [
        `metrale-~codex@${SHA}.jsonl`,
        `other-site-~code@${SHA}.jsonl`,
        `metrale-~code@${SHA}.jsonl.crswap`,
        ...LIBRARY_FILES.map(([n]) => n),
      ].sort()
    );
  });

  // Retiring an id that is still configured would delete its live cache on every open.
  test('no retired corpus id is configured', () => {
    expect(RETIRED_CORPUS_IDS.filter((id) => CORPORA.some((c) => c.id === id))).toEqual([]);
  });

  test('a second run finds nothing', async () => {
    const dir = fakeDir([['lattice-db-a.jsonl', 'file']]);
    await removeLegacyCache({ dir, caches: null });
    expect(await removeLegacyCache({ dir, caches: null })).toEqual([]);
  });
});
