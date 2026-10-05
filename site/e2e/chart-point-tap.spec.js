// =============================================================================
// chart-point-tap.spec.js — every point of a gate chart opens its card
// -----------------------------------------------------------------------------
// The newest point of each series carries its value as a label drawn at the
// point's right edge. At 390 px that label covered the point and took the tap,
// so the card never opened (2026-10-03); a keyboard Enter still worked. The
// label is pointer-transparent now, so a click or a tap reaches the point.
// =============================================================================

import { test, expect } from '@playwright/test';

test('at every width, a click on any point of a chart, the labelled newest ones included, opens its card', async ({ page }) => {
  await page.goto('/engine#bench=bfcl&model=all');
  await page.getByRole('button', { name: /view the benchmark dashboard/i }).click();
  await expect(page.locator('.bd[role="dialog"]')).toBeVisible();
  // Every point, not only the last one in the DOM: a chart with two series
  // labels the newest point of each, and either label can sit over its point.
  // `.gc-pt` alone, not `svg[role="img"]`: the chart's svg is `role="group"`
  // now (ux-oracle, metrale.ai#72, 2026-10-05 -- "img" hid these very points
  // from a screen reader), and `.gc-pt` already names exactly these marks.
  const points = page.locator('.bd-body svg .gc-pt');
  const n = await points.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const point = points.nth(i);
    // A real pointer click at the point's centre, with no `force`: if anything
    // drawn over the point takes the event, Playwright reports it and times out.
    await point.scrollIntoViewIfNeeded();
    await point.click({ timeout: 5_000 });
    await expect(page.locator('.gpc')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.gpc')).toBeHidden();
  }
});
