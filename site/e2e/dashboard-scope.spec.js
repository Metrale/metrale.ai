// =============================================================================
// dashboard-scope.spec.js — the dashboard's hardware and model selects
// -----------------------------------------------------------------------------
// The header scopes every tab to one hardware class and one model, the
// flagship by default, so the charts do not crowd. The unit suite proves the
// rules (dashboard-scope.test.js) and the server render; this proves the
// selects in a browser: what they offer, what a change does to the tabs and
// the subject strip, and that the URL hash is the deep link both ways.
// =============================================================================

import { test, expect } from '@playwright/test';

const FLAGSHIP = 'Qwen/Qwen3.6-35B-A3B-FP8';
const DENSE = 'unsloth/Qwen3.8-27B-NVFP4';
const open = async (page, path = '/engine') => {
  await page.goto(path);
  await page.getByRole('button', { name: /view the benchmark dashboard/i }).click();
  await expect(page.locator('.bd[role="dialog"]')).toBeVisible();
};
const hwSelect = (page) => page.getByLabel('hardware', { exact: true });
const modelSelect = (page) => page.getByLabel('model', { exact: true });
const outerTabs = (page) => page.locator('.bd-tabs [role="tab"]').allInnerTexts();

test.describe('the hardware and model selects', () => {
  test('open on GB10 and the flagship, offering only what has records', async ({ page }) => {
    await open(page);
    await expect(hwSelect(page)).toHaveValue('gb10');
    await expect(hwSelect(page).locator('option')).toHaveText(['GB10']);
    await expect(modelSelect(page)).toHaveValue(FLAGSHIP);
    await expect(modelSelect(page).locator('option')).toHaveText(['Qwen3.6-35B-A3B-FP8 · flagship', 'Qwen3.8-27B-NVFP4', 'all models']);
    await expect(page.locator('.bd-scope')).toHaveAttribute('role', 'group');
    // The flagship has no decode-floor record, so the Decode tab is not offered.
    expect((await outerTabs(page)).map((t) => t.trim())).not.toContain('Decode');
  });

  test('a model change scopes the tabs and the subject strip, and is written to the hash', async ({ page }) => {
    await open(page, `/engine#bench=concurrency`);
    await expect(page.locator('.cs-tabs [role="tab"]')).toHaveCount(1);
    await modelSelect(page).selectOption(DENSE);
    await expect(page).toHaveURL(/#bench=concurrency&hw=gb10&model=unsloth%2FQwen3\.8-27B-NVFP4&subject=qwen38-27b/);
    await expect(page.locator('.cs-tabs [role="tab"]')).toHaveCount(2);
    expect(await page.locator('.cs-tabs [role="tab"]').evaluateAll((els) => els.map((e) => e.id))).toEqual([
      'cs-tab-qwen38-27b',
      'cs-tab-qwen38-27b-dflash',
    ]);
    const tabs = (await outerTabs(page)).map((t) => t.trim());
    expect(tabs).toContain('Decode');
    expect(tabs).not.toContain('Agentic');
  });

  test('a pasted link opens on the model it names, and a model the tab lacks moves to the first tab in scope', async ({ page }) => {
    await open(page, `/engine#bench=agentic&model=${encodeURIComponent(DENSE)}`);
    await expect(modelSelect(page)).toHaveValue(DENSE);
    // The 27B has no agentic record: the dashboard lands on its first tab instead of an empty panel.
    await expect(page.locator('.bd-tabs [role="tab"][aria-selected="true"]')).toHaveText(/BFCL/);
    await expect(page.locator('.bd-body .gbs-model').first()).toHaveText('Qwen3.8-27B-NVFP4');
  });

  test('both selects are reached by keyboard from inside the dialog', async ({ page }) => {
    await open(page);
    await hwSelect(page).focus();
    await page.keyboard.press('Tab');
    await expect(modelSelect(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Close dashboard' })).toBeFocused();
  });
});

test.describe('a data point names its commit history', () => {
  test('the card says which commit on main landed the record, never "commit history unavailable"', async ({ page }) => {
    await open(page, '/engine#bench=ttft');
    await page.locator('.bd-body .gc-pt').first().click();
    const card = page.locator('.gpc');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/landed on main in [0-9a-f]{10}/);
    await expect(card).not.toContainText('commit history unavailable');
    const link = card.getByTitle('The commit that added this record to main');
    await expect(link).toHaveAttribute('href', /\/commit\/[0-9a-f]{40}$/);
  });
});
