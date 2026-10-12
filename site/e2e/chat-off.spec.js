// SPDX-License-Identifier: AGPL-3.0-only

// While the codebase chat is off (CHAT_ON in fixtures/chat-helpers.js follows
// `codeChat.enabled` in src/lib/data.js), the engine page offers no way in.

import { test, expect } from './fixtures/app.js';
import { CHAT_ON, LABEL } from './fixtures/chat-helpers.js';

test.skip(CHAT_ON, 'The chat is on; chat.spec.js covers it.');

test('the engine page offers no codebase chat while it is off', async ({ page }) => {
  await page.goto('/engine');
  await expect(page.locator('.av-header-actions')).toBeVisible();
  await expect(page.getByRole('button', { name: LABEL })).toHaveCount(0);
});
