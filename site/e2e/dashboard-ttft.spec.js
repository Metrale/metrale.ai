// =============================================================================
// dashboard-ttft.spec.js — the two TTFT tabs in a browser
// -----------------------------------------------------------------------------
// The High-ISL TTFT tab and the Median | p90 strip both TTFT tabs carry: a click
// on either strip changes the panels and the deep link, and a pasted deep link
// opens the dashboard on the tab and statistic it names. The unit suite proves
// what the server render says; this proves the clicks and the hash round-trip.
// =============================================================================

import { test, expect } from '@playwright/test';

const openDashboard = async (page, path = '/engine') => {
  await page.goto(path);
  await page.getByRole('button', { name: /view the benchmark dashboard/i }).click();
  const dialog = page.locator('.bd[role="dialog"]');
  await expect(dialog).toBeVisible();
  return dialog;
};
const outerTab = (page, name) => page.locator('.bd-tabs').getByRole('tab', { name, exact: true });
const statTab = (page, name) => page.locator('.tt-tabs').getByRole('tab', { name, exact: true });
const panelTitles = (page) => page.locator('.bd-body .gate-panel-title').allInnerTexts();

test.describe('the TTFT tabs', () => {
  test('High-ISL TTFT shows the four 32k gates, and the stat strip switches every panel', async ({ page }) => {
    await openDashboard(page);
    await outerTab(page, 'High-ISL TTFT').click();
    await expect(outerTab(page, 'High-ISL TTFT')).toHaveAttribute('aria-selected', 'true');
    // "TTFT" is its own tab and stays unselected: the exact match found the right one.
    await expect(outerTab(page, 'TTFT')).toHaveAttribute('aria-selected', 'false');

    await expect(page.locator('.bd-body .gbs-name')).toHaveText([
      'High-ISL Cold TTFT Gate',
      'High-ISL Warm TTFT Gate',
      'High-ISL Cold TTFT Gate (MoE)',
      'High-ISL Warm TTFT Gate (MoE)',
    ]);
    await expect(statTab(page, 'Median')).toHaveAttribute('aria-selected', 'true');
    expect(await panelTitles(page)).toEqual(['cold TTFT · median', 'warm TTFT · median', 'cold TTFT · median', 'warm TTFT · median']);
    await expect(page.locator('.bd-body path.gc-baseline[d^="M"]:not([d="M1 5 H19"])')).toHaveCount(4);
    await expect(page).toHaveURL(/#bench=ttft-long&stat=median$/);

    await statTab(page, 'p90').click();
    await expect(statTab(page, 'p90')).toHaveAttribute('aria-selected', 'true');
    expect(await panelTitles(page)).toEqual(['cold TTFT · p90', 'warm TTFT · p90', 'cold TTFT · p90', 'warm TTFT · p90']);
    await expect(page).toHaveURL(/#bench=ttft-long&stat=p90$/);

    // The statistic is shared by both TTFT tabs, and leaves with them.
    await outerTab(page, 'TTFT').click();
    await expect(statTab(page, 'p90')).toHaveAttribute('aria-selected', 'true');
    expect(await panelTitles(page)).toEqual(['warm TTFT · p90', 'cold TTFT · p90']);
    await expect(page).toHaveURL(/#bench=ttft&stat=p90$/);
    await outerTab(page, 'BFCL').click();
    await expect(page.locator('.tt-tabs')).toHaveCount(0);
    await expect(page).toHaveURL(/#bench=bfcl$/);
  });

  test('the deep link #bench=ttft-long&stat=p90 opens on that tab and statistic', async ({ page }) => {
    await openDashboard(page, '/engine#bench=ttft-long&stat=p90');
    await expect(outerTab(page, 'High-ISL TTFT')).toHaveAttribute('aria-selected', 'true');
    await expect(statTab(page, 'p90')).toHaveAttribute('aria-selected', 'true');
    expect(await panelTitles(page)).toEqual(['cold TTFT · p90', 'warm TTFT · p90', 'cold TTFT · p90', 'warm TTFT · p90']);
    // Every gate states its vLLM figure or why there is none.
    await expect(page.locator('.bd-body .gbs-vllm-item')).toHaveCount(4);
    await expect(page.locator('.bd-body .gbs-vllm-item[data-state="paired"]')).toHaveCount(4);
  });

  test('the arrow keys move along the stat strip, as on every other strip', async ({ page }) => {
    await openDashboard(page, '/engine#bench=ttft');
    await statTab(page, 'Median').focus();
    await page.keyboard.press('ArrowRight');
    await expect(statTab(page, 'p90')).toHaveAttribute('aria-selected', 'true');
    await expect(statTab(page, 'p90')).toBeFocused();
    await expect(page).toHaveURL(/#bench=ttft&stat=p90$/);
  });
});
