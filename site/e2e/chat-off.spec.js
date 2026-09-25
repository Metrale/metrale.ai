// SPDX-License-Identifier: AGPL-3.0-only

// While the codebase chat is off (CHAT_ON in fixtures/chat-helpers.js follows
// `codeChat.enabled` in src/lib/data.js), the developer pages offer no way in:
// no button in the bar and none in the drawer.

import { test, expect } from '@playwright/test';
import { CHAT_ON } from './fixtures/chat-helpers.js';

test.skip(CHAT_ON, 'The chat is on; chat.spec.js covers it.');

test('the engine page offers no codebase chat while it is off', async ({ page }) => {
  await page.goto('/engine');
  await expect(page.locator('.nav-chat-btn')).toHaveCount(0);
});
