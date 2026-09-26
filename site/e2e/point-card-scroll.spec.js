// =============================================================================
// point-card-scroll.spec.js — a point card's reproduction steps can be read
// -----------------------------------------------------------------------------
// Clicking a gate chart's point opens its card; "reproduction steps" expands a
// panel at the top of it that is taller than the card. The card is capped in
// height and must scroll: every step, down to the card's last line, has to be
// reachable. A `.receipt` rule elsewhere clips overflow on the same element, so
// this is measured where the dashboard modal mounts, at both widths.
// =============================================================================

import { test, expect } from '@playwright/test';

// The dashboard modal (and its point cards) mounts on /engine; /benchmarks renders its charts inline.
const ROUTES = ['/engine'];

for (const route of ROUTES) {
  test(`${route}: the expanded reproduction steps scroll into view`, async ({ page }) => {
    await page.goto(route);
    const open = page.getByRole('button', { name: /benchmark dashboard/i }).first();
    if (await open.count()) await open.click();
    const dialog = page.locator('.bd[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.locator('.bd-tabs [role="tab"]').filter({ hasText: 'Agentic' }).click();

    await dialog.locator('.gc-pt').first().click({ force: true });
    const card = page.locator('.gpc');
    await expect(card).toBeVisible();
    await card.locator('.gpc-repro-toggle').click();
    await expect(card.locator('.gpc-repro')).toBeVisible();

    const m = await card.evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    // The steps make the card taller than its cap, so this is the case that must scroll.
    expect(m.scrollHeight).toBeGreaterThan(m.clientHeight);
    expect(['auto', 'scroll']).toContain(m.overflowY);

    // Scrolling the card brings its last line (the footer's close button) inside it.
    await card.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const close = card.locator('.gpc-close');
    const inView = await close.evaluate((btn) => {
      const c = btn.closest('.gpc').getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      return b.bottom <= c.bottom + 1 && b.top >= c.top - 1;
    });
    expect(inView).toBe(true);
  });
}
