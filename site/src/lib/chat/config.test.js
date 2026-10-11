// SPDX-License-Identifier: AGPL-3.0-only
//
// The site's chat configuration against the library's own contract. The
// library validates a configuration before it touches the browser, and throws
// one ConfigError listing every problem; outside a browser a valid one gets as
// far as "runs in a browser only". So calling it here, on the vendored release
// (scripts/gen-repo-chat.mjs; `bun run test:unit` runs it first), proves the
// configuration /engine opens with is one the pinned library accepts: every key
// present, no unknown key, the copy the same shape as the library's.

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CORPORA, CORPUS_BASE, STORAGE_KEY_PREFIX, THEME, corpusUrls, mergeCopy, repoChatConfig } from './config.js';
import { REPO_CHAT_VERSION } from './pin.js';
import { codeChat } from '../data.js';

const bundle = join(import.meta.dir, '..', '..', '..', 'static', 'repo-chat', REPO_CHAT_VERSION, 'repo-chat.js');
const lib = await import(pathToFileURL(bundle).href);

const mount = { nodeType: 1, appendChild() {} };
const models = { chatModel: 'vendor/answer:free', rerankModel: 'vendor/rerank:free' };
const config = (over = {}) => repoChatConfig({ mount, copyEn: lib.COPY_EN, models, onClose: () => {}, ...over });

/** What the library says about a configuration: 'valid', or its list of problems. */
function verdict(cfg) {
  try {
    lib.warmRepoChat(cfg);
  } catch (err) {
    if (err instanceof lib.ConfigError) return err.problems;
    if (/runs in a browser only/.test(err.message)) return 'valid';
    throw err;
  }
  throw new Error('warmRepoChat returned outside a browser');
}

describe('the configuration /engine opens the chat with', () => {
  test('the pinned library accepts it', () => {
    expect(verdict(config())).toBe('valid');
  });

  test('the model ids are the build-time pair, and nothing names an embedding model', () => {
    const cfg = config();
    expect(cfg.provider.chatModel).toBe(models.chatModel);
    expect(cfg.provider.rerankModel).toBe(models.rerankModel);
    expect(Object.keys(cfg.provider).filter((k) => /embed/i.test(k))).toEqual([]);
  });

  test("Metrale's words replace the library's, and the rest of its copy stays", () => {
    const { copy } = config();
    expect(copy.title).toBe(codeChat.copy.title);
    expect(copy.starters).toEqual(codeChat.copy.starters);
    expect(copy.input.placeholder).toBe(codeChat.copy.input.placeholder);
    expect(copy.input.ask).toBe(lib.COPY_EN.input.ask);
    expect(copy.errors.config).toEqual(lib.COPY_EN.errors.config);
  });

  test("visitors keep the key and answer model the site's own chat saved", () => {
    // The library's names are `<prefix>openrouter-key` and `<prefix>openrouter-chat-model`.
    expect(`${STORAGE_KEY_PREFIX}openrouter-key`).toBe('metrale-openrouter-key');
    expect(`${STORAGE_KEY_PREFIX}openrouter-chat-model`).toBe('metrale-openrouter-chat-model');
    expect(config().storage.keyPrefix).toBe(STORAGE_KEY_PREFIX);
  });

  test('every corpus is a gz and a meta beside it on the engine Pages site', () => {
    const corpora = config().corpora;
    expect(corpora).toEqual(CORPORA.map(corpusUrls));
    expect(corpora[0]).toEqual({
      id: 'code',
      gzUrl: `${CORPUS_BASE}/metrale-coderag.jsonl.gz`,
      metaUrl: `${CORPUS_BASE}/metrale-coderag.jsonl.meta.json`,
    });
    expect(CORPUS_BASE).toBe('https://metrale.github.io/metrale-inference/coderag');
  });

  test('the theme names site tokens only, never a colour', () => {
    for (const value of Object.values(THEME)) expect(value).toMatch(/^var\(--[a-z0-9-]+\)$/);
  });
});

describe('the check can fail', () => {
  test('NEGATIVE CONTROL: a copy key the library does not know is refused, by name', () => {
    const bad = config();
    bad.copy = { ...bad.copy, loadFail: 'x' };
    expect(verdict(bad)).toEqual(['copy.loadFail: unknown key']);
  });

  test('NEGATIVE CONTROL: a missing model id is refused, by name', () => {
    expect(verdict(config({ models: { chatModel: '', rerankModel: 'vendor/rerank' } }))).toEqual([
      'provider.chatModel: must be a non-empty string',
    ]);
  });

  test('mergeCopy replaces lists whole and merges objects key by key', () => {
    expect(mergeCopy({ a: [1, 2], b: { x: 1, y: 2 }, c: 's' }, { a: [3], b: { y: 9 } })).toEqual({ a: [3], b: { x: 1, y: 9 }, c: 's' });
  });
});
