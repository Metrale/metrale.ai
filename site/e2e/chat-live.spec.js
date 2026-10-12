// =============================================================================
// chat-live.spec.js — @live: the real published corpus, and (optionally) the real
// OpenRouter. Excluded by default (grepInvert in the config); run with
// `bun run test:e2e:live`. The OpenRouter leg needs OPENROUTER_API_KEY in the
// environment and skips cleanly without it; the key is never printed or kept.
// The corpora are about 134 MB compressed, so allow minutes.
// =============================================================================

import { test, expect } from '@playwright/test';
import { CHAT_ON, LS_OPENROUTER_KEY, acceptDownload, openChat } from './fixtures/chat-helpers.js';
import { ENGINE_REPO } from '../../web-shared/sources.mjs';

test.skip(!CHAT_ON, 'The codebase chat is off.');

const LIVE_KEY = process.env.OPENROUTER_API_KEY;
const status = (page) => page.locator('.cc-status-text');

test.describe('@live real corpus', () => {
  test('the published corpora download, index, and reach ready', async ({ page }) => {
    test.setTimeout(600_000);
    await page.goto('/engine');
    await openChat(page);
    await acceptDownload(page);
    await expect(status(page)).toContainText('ready ·', { timeout: 580_000 });
  });

  test('a real question comes back cited when a key is provided', async ({ page }) => {
    test.skip(!LIVE_KEY, 'OPENROUTER_API_KEY not set, skipping the real-key leg');
    test.setTimeout(600_000);
    await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [LS_OPENROUTER_KEY, LIVE_KEY]);
    await page.goto('/engine');
    await openChat(page);
    await acceptDownload(page);
    await expect(status(page)).toContainText('ready ·', { timeout: 420_000 });

    await page.locator('.cc-input').fill('Where does the engine decide which requests join a decode batch?');
    await page.locator('.cc-ask').click();
    const card = page.locator('.cm-card');
    await expect(card).toBeVisible({ timeout: 120_000 });
    // A reasoning model can think for tens of seconds before the first answer token.
    await expect(card.locator('.cm-body')).not.toBeEmpty({ timeout: 180_000 });
    await expect(card.locator('.cm-src').first()).toBeVisible({ timeout: 120_000 });
    expect(await card.locator('.cm-src').first().getAttribute('href')).toMatch(
      new RegExp(`^${ENGINE_REPO.replace(/[.]/g, '\\.')}/blob/[0-9a-f]{40}/.+#L\\d+-L\\d+$`)
    );
  });
});
