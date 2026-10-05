// =============================================================================
// point-card-focus.spec.js — closing a point's card returns focus to the point
// -----------------------------------------------------------------------------
// A chart point is an `<svg><g role="button" tabindex="0">`, not an
// HTMLElement. modal.js's focus-trap action captured the dialog's opener with
// `document.activeElement instanceof HTMLElement`, which is false for a
// focused SVG element (SVGElement is a sibling of HTMLElement, not a
// subclass) — so `opener` was silently null for every point-opened card, and
// closing it left focus wherever the browser puts it after removing the
// focused node (<body>), not back on the point (ux-oracle, metrale.ai#74,
// 2026-10-05). This only became observable once the point itself stopped
// being hidden from assistive tech by its ancestor svg's role="img" — before
// that fix, a screen-reader user could not reach the point to begin with, so
// losing their place after the card closed was moot. Now that points are
// reachable, this is real: a keyboard/AT user who opens a card from a point
// and dismisses it with Escape must land back on that same point, not get
// dropped at the top of the page.
// =============================================================================

import { test, expect } from '@playwright/test';

test('Escape on a point card returns focus to the point that opened it', async ({ page }) => {
  await page.goto('/engine#bench=bfcl&model=all');
  await page.getByRole('button', { name: /view the benchmark dashboard/i }).click();
  await expect(page.locator('.bd[role="dialog"]')).toBeVisible();

  const point = page.locator('.bd-body svg .gc-pt').first();
  await expect(point).toBeVisible();

  // Keyboard path: Tab to the point rather than click it, so the pre-close
  // activeElement is unambiguously the point itself.
  await point.focus();
  await expect(point).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.gpc')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.gpc')).toBeHidden();
  await expect(point).toBeFocused();

  // The same path for a mouse-opened card: Playwright's .click() focuses a
  // focusable target first, the same as a real pointer interaction.
  await point.click();
  await expect(page.locator('.gpc')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.gpc')).toBeHidden();
  await expect(point).toBeFocused();
});
