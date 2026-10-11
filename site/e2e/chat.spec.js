// =============================================================================
// chat.spec.js — "Ask the codebase" on /engine, at the level a visitor meets it:
// the button in the header, the library it opens, a fixture corpus behind it, a
// mocked OpenRouter answering one question, and focus coming home on close.
// The chat itself is AutoRepoRAG's website-chat library, whose own suite covers
// its loader, cache, streaming, retries and errors; this proves the site wires
// it up right. Runs in both projects (desktop and the 390x844 phone).
// =============================================================================

import { test, expect } from '@playwright/test';
import { REPO_CHAT_MODULE_URL } from '../src/lib/chat/config.js';
import { LEGACY_WASM_CACHE, LEGACY_WASM_URL } from '../src/lib/chat/legacy-cache.js';
import { CHAT_MODEL_ENV, RERANK_MODEL_ENV } from '../src/lib/chat/models-env.js';
import { codeChat } from '../src/lib/data.js';
import {
  CHAT_ON,
  CLOSE_LABEL,
  COMMIT,
  CORPUS_URLS,
  META,
  askButton,
  askQuestion,
  dialogOf,
  openChat,
  opfsFiles,
  routeCorpora,
  waitReady,
  withKey,
} from './fixtures/chat-helpers.js';
import { OR_CHAT, OR_EMBEDDINGS, OR_RERANK, chatHandler, embeddingsHandler, rerankHandler } from './fixtures/openrouter.js';

test.skip(!CHAT_ON, 'The codebase chat is off; chat-off.spec.js covers that.');

const ANSWER = 'The scheduler admits waiting requests into the running decode batch [1].';

async function routeOpenRouter(context, log) {
  await context.route(OR_EMBEDDINGS, embeddingsHandler({ dim: META.dim, log: log.embed }));
  await context.route(OR_RERANK, rerankHandler({ log: log.rerank }));
  await context.route(OR_CHAT, chatHandler(ANSWER, { log: log.chat }));
}

test.describe('the button', () => {
  test('sits top right in the engine page header, named and big enough to hit', async ({ page }) => {
    await page.goto('/engine');
    const button = askButton(page);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const box = await button.boundingBox();
    const { width } = page.viewportSize();
    expect(box.width).toBeGreaterThanOrEqual(42);
    expect(box.height).toBeGreaterThanOrEqual(42);
    expect(box.x + box.width / 2).toBeGreaterThan(width / 2);
    expect(box.y).toBeLessThan(80);
  });

  for (const path of ['/', '/platform/engine', '/control', '/diligence']) {
    test(`is not on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('.av-header-actions')).toBeVisible();
      await expect(page.getByRole('button', { name: codeChat.copy.navLabel })).toHaveCount(0);
    });
  }

  test('hover warms the library without downloading a corpus', async ({ page, context }) => {
    const hits = await routeCorpora(context);
    await page.goto('/engine');
    await askButton(page).hover();
    await expect(page.locator('link[rel="stylesheet"][data-repo-chat="loaded"]')).toHaveCount(1);
    await expect(dialogOf(page)).toHaveCount(0);
    expect(hits).toEqual({ meta: 0, gz: 0 });
  });

  test('says it is busy while the library loads, and says so when it cannot', async ({ page }) => {
    let release;
    const held = new Promise((resolve) => (release = resolve));
    let failNext = true;
    await page.route((url) => url.pathname === REPO_CHAT_MODULE_URL, async (route) => {
      if (failNext) return route.abort('internetdisconnected');
      await held;
      await route.continue();
    });
    await page.goto('/engine');
    const button = askButton(page);

    await button.click();
    await expect(page.getByRole('alert')).toHaveText(codeChat.loadFail);
    await expect(button).toHaveAttribute('aria-describedby', 'arb-error');

    failNext = false;
    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('alert')).toHaveCount(0);
    release();
    await expect(dialogOf(page)).toBeVisible();
    await expect(button).toHaveAttribute('aria-busy', 'false');
  });
});

test.describe('the chat', () => {
  test('answers from the fixture corpus with the build-time models and real receipts', async ({ page, context }) => {
    await routeCorpora(context);
    const log = { embed: [], rerank: [], chat: [] };
    await routeOpenRouter(context, log);
    await withKey(page);
    await page.goto('/engine');
    const dialog = await openChat(page);
    await expect(askButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.getByRole('heading', { name: codeChat.copy.title })).toBeVisible();
    await waitReady(page);
    // The visitor's key, saved under the site's old storage name, is still the one in use.
    await expect(dialog.locator('.cc-connected')).toBeVisible();

    await askQuestion(page, 'Where does the scheduler decide which requests join a decode batch?');
    const card = dialog.locator('.cm-card');
    await expect(card.locator('.cm-body')).toContainText('admits waiting requests');
    const sources = card.locator('.cm-src');
    // Present, not necessarily visible: on a phone the library starts the receipts collapsed.
    await expect(sources).not.toHaveCount(0);
    for (const src of await sources.all()) {
      expect(await src.getAttribute('href')).toMatch(new RegExp(`^https://github\\.com/${META.repo}/blob/${COMMIT}/.+#L\\d+-L\\d+$`));
    }

    // The answer and rerank models are the build's; the embedding model is the corpus's own.
    expect(log.chat.at(-1).model).toBe(process.env[CHAT_MODEL_ENV]);
    expect(log.rerank.at(-1).model).toBe(process.env[RERANK_MODEL_ENV]);
    expect(log.embed.at(-1).model).toBe(META.model);
  });

  test('Escape closes it and focus comes back to the button', async ({ page, context }) => {
    await routeCorpora(context);
    await page.goto('/engine');
    await openChat(page);
    await page.keyboard.press('Escape');
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(askButton(page)).toBeFocused();
    await expect(askButton(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('the close button does the same, and the chat opens again', async ({ page, context }) => {
    await routeCorpora(context);
    await page.goto('/engine');
    const dialog = await openChat(page);
    await dialog.getByRole('button', { name: CLOSE_LABEL }).click();
    await expect(dialogOf(page)).toHaveCount(0);
    await expect(askButton(page)).toBeFocused();
    await openChat(page);
  });

  test("clears what the site's own chat left on disk, and caches the corpus under the library's name", async ({ page, context }) => {
    await routeCorpora(context);
    await page.goto('/engine');
    await page.evaluate(
      async ([cacheName, url]) => {
        const dir = await navigator.storage.getDirectory();
        const file = await dir.getFileHandle('lattice-db-0123abcd.jsonl', { create: true });
        const w = await file.createWritable();
        await w.write('{}');
        await w.close();
        await (await caches.open(cacheName)).put(url, new Response('old wasm'));
      },
      [LEGACY_WASM_CACHE, LEGACY_WASM_URL]
    );
    await openChat(page);
    await waitReady(page);
    await expect.poll(() => opfsFiles(page)).not.toContain('lattice-db-0123abcd.jsonl');
    expect(await opfsFiles(page)).toContain(`metrale-~${CORPUS_URLS[0].id}@${COMMIT}.jsonl`);
    expect(
      await page.evaluate(
        async ([cacheName, url]) => !!(await (await caches.open(cacheName)).match(url)),
        [LEGACY_WASM_CACHE, LEGACY_WASM_URL]
      )
    ).toBe(false);
  });
});
