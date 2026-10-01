// =============================================================================
// dashboard-moe-ladder.spec.js — the MoE subject reaches C=128 in a browser
// -----------------------------------------------------------------------------
// The MoE concurrency gate stops at C=16. The engine publishes the MoE ladder to
// C=128, and both the Concurrency and the Cost tab draw it under its own title,
// labelled as published-ladder data, after the gate's own chart. The unit suite
// proves the render; this proves a reader reaches it from the deep link.
// =============================================================================

import { test, expect } from '@playwright/test';

const openAt = async (page, hash) => {
  await page.goto(`/engine#${hash}`);
  await page.getByRole('button', { name: /view the benchmark dashboard/i }).click();
  await expect(page.locator('.bd[role="dialog"]')).toBeVisible();
};

test.describe('the MoE ladder to C=128', () => {
  test('Concurrency: the gate chart, then the published ladder with a row at C=128', async ({ page }) => {
    await openAt(page, 'bench=concurrency&subject=qwen36-35b-a3b');
    await expect(page.locator('#cs-tab-qwen36-35b-a3b')).toHaveAttribute('aria-selected', 'true');
    const titles = page.locator('#cs-panel-qwen36-35b-a3b .gate-panel-title');
    await expect(titles.nth(0)).toContainText('Metrale Engine vs vLLM · gate instrument');
    // The gate chart carries Metrale Engine on to C=128 with the published leg, in hollow marks.
    await expect(page.locator('#cs-panel-qwen36-35b-a3b figure.cmp').first().locator('circle.cmp-ext-mark')).toHaveCount(3);
    await expect(titles.nth(1)).toHaveText('Metrale Engine vs vLLM · published ladder, C=1..128 · ISL 128 / OSL 1024');
    await expect(page.locator('#cs-panel-qwen36-35b-a3b')).toContainText('It is published-ladder data, not a gate record.');
    const row128 = page.locator('#cs-panel-qwen36-35b-a3b .cl-table tbody tr').filter({ has: page.locator('th', { hasText: /^128$/ }) });
    await expect(row128).toHaveCount(1);
    await expect(row128.locator('td')).toHaveCount(3); // Metrale Engine, vLLM + MTP, ratio
  });

  test('Cost: a second chart for the published ladder to C=128', async ({ page }) => {
    await openAt(page, 'bench=cost&subject=qwen36-35b-a3b');
    await expect(page.locator('#co-tab-qwen36-35b-a3b')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.bd-body')).toContainText('$ per 1M tokens · published ladder, C=1..128');
    await expect(page.locator('.bd-body')).toContainText('It is published-ladder data, not a gate record');
  });

  test('the dense tabs, whose gate reaches C=128, have no second ladder', async ({ page }) => {
    await openAt(page, 'bench=concurrency&subject=qwen38-27b');
    await expect(page.locator('#cs-tab-qwen38-27b')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.bd-body')).not.toContainText('published ladder, C=');
  });
});
