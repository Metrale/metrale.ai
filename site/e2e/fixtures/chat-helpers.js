// =============================================================================
// chat-helpers.js — shared plumbing for the chat E2E specs: the fixture corpus,
// corpus routing, and the button / dialog / ask drivers. The chat is the
// AutoRepoRAG website-chat library; its own suite covers its internals, so
// these drive it only as a visitor to /engine would.
// =============================================================================

import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORPORA, STORAGE_KEY_PREFIX, corpusUrls } from '../../src/lib/chat/config.js';
import { codeChat } from '../../src/lib/data.js';
import { CORS_HEADERS } from './openrouter.js';

// The chat's switch (`codeChat.enabled` in src/lib/data.js; a unit test holds the
// two equal). While it is off the chat suites skip and chat-off.spec.js runs.
export const CHAT_ON = true;

const FIX = dirname(fileURLToPath(import.meta.url));
export const META = JSON.parse(readFileSync(join(FIX, 'corpus-small.meta.json'), 'utf8'));
export const GZ = readFileSync(join(FIX, 'corpus-small.jsonl.gz'));
export const COMMIT = META.commit_sha;
export const LS_OPENROUTER_KEY = `${STORAGE_KEY_PREFIX}openrouter-key`;
export const TEST_KEY = 'e2e-fixture-not-a-key';
export const LABEL = codeChat.copy.navLabel;
export const CLOSE_LABEL = codeChat.copy.closeLabel;

/** Every corpus the site configures, as the library fetches it. */
export const CORPUS_URLS = CORPORA.map(corpusUrls);

const JSON_HEADERS = { ...CORS_HEADERS, 'content-type': 'application/json' };
const GZ_HEADERS = { ...CORS_HEADERS, 'content-type': 'application/gzip' };

/** Answer every configured corpus with the fixture, counting the requests. */
export async function routeCorpora(context) {
  const hits = { meta: 0, gz: 0 };
  for (const { gzUrl, metaUrl } of CORPUS_URLS) {
    await context.route(metaUrl, async (route) => {
      hits.meta++;
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(META) });
    });
    await context.route(gzUrl, async (route) => {
      hits.gz++;
      await route.fulfill({ status: 200, headers: GZ_HEADERS, body: GZ });
    });
  }
  return hits;
}

// --- drivers -------------------------------------------------------------------

/** The button in the header's right-hand group. */
export const askButton = (page) => page.locator('.av-header-actions').getByRole('button', { name: LABEL, exact: true });

export const dialogOf = (page) => page.getByRole('dialog', { name: LABEL, exact: true });

export async function openChat(page) {
  await askButton(page).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function waitReady(page) {
  await expect(page.locator('.cc-status-text')).toContainText('ready ·', { timeout: 30_000 });
}

export function withKey(page) {
  return page.addInitScript(([k, v]) => localStorage.setItem(k, v), [LS_OPENROUTER_KEY, TEST_KEY]);
}

export async function askQuestion(page, question) {
  await page.locator('.cc-input').fill(question);
  await page.locator('.cc-ask').click();
}

export const opfsFiles = (page) =>
  page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    const names = [];
    for await (const [name] of dir) names.push(name);
    return names.sort();
  });
