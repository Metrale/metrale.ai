// =============================================================================
// dashboard-width.spec.js — the benchmark dashboard fits a phone
// -----------------------------------------------------------------------------
// At 390px every tab and every subject of the modal must fit its width: no
// horizontal scroll of the dialog, and no text past the right edge of the
// screen. A wide table or chart may scroll inside its own overflow-x container;
// what it holds is measured against that container, not the screen. Prose has
// to wrap. Runs in the mobile project, in both themes, because the two themes
// share every rule that decides a width and a regression shows in either.
// =============================================================================

import { test, expect } from '@playwright/test';

const THEMES = ['dark', 'light'];
// The inner subject strips: TabStrip prefixes `cs` (Concurrency) and `co` (Cost).
const SUBJECT_STRIP = { concurrency: 'cs', cost: 'co' };

/** Everything wider than the dialog or past the screen's right edge, named. */
const overflowIn = (page) =>
  page.evaluate(() => {
    const dialog = document.querySelector('.bd[role="dialog"]');
    const vw = document.documentElement.clientWidth;
    const out = [];
    if (dialog.scrollWidth > dialog.clientWidth) out.push(`dialog scrollWidth ${dialog.scrollWidth} > clientWidth ${dialog.clientWidth}`);
    for (const el of document.querySelectorAll('.bd-body, .bd-controls, .bd-head, .bd-foot')) {
      if (el.scrollWidth > el.clientWidth) out.push(`${el.className} scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}`);
    }
    // A text element: one that holds a non-blank text node of its own. Its
    // right edge is judged against the nearest ancestor that scrolls sideways
    // (a chart or table that is allowed to), else against the screen.
    const clipOf = (el) => {
      for (let p = el.parentElement; p && p !== dialog; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll') return p;
      }
      return null;
    };
    const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim()) continue;
      seen.add(el);
      if (el.closest('svg')) continue; // SVG text scales with its viewBox, measured as the svg below
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || (s.position === 'absolute' && s.clip === 'rect(0px, 0px, 0px, 0px)')) continue;
      const scroller = clipOf(el);
      if (scroller) {
        const sr = scroller.getBoundingClientRect();
        if (sr.right > vw + 0.5) out.push(`scroller ${scroller.tagName}.${scroller.className} right ${Math.round(sr.right)} > ${vw}`);
        continue;
      }
      if (r.right > vw + 0.5)
        out.push(`${el.tagName}.${el.className} "${n.textContent.trim().slice(0, 40)}" right ${Math.round(r.right)} > ${vw}`);
    }
    for (const svg of dialog.querySelectorAll('svg')) {
      const r = svg.getBoundingClientRect();
      if (r.width > 0 && !clipOf(svg) && r.right > vw + 0.5)
        out.push(`svg.${svg.getAttribute('class') ?? ''} right ${Math.round(r.right)} > ${vw}`);
    }
    return [...new Set(out)];
  });

test.describe('the benchmark dashboard at 390px', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'mobile', 'the phone width is the mobile project'));

  for (const theme of THEMES) {
    test(`no tab or subject scrolls sideways or clips text (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('metrale-theme', t);
        } catch {
          /* storage refused: the default theme is measured instead */
        }
      }, theme);
      await page.goto('/engine');
      await page.getByRole('button', { name: /view the benchmark dashboard/i }).click();
      await expect(page.locator('.bd[role="dialog"]')).toBeVisible();
      const tabs = page.locator('.bd-tabs [role="tab"]');
      const labels = (await tabs.allInnerTexts()).map((t) => t.trim());
      expect(labels.length).toBeGreaterThanOrEqual(6);
      const found = [];
      for (const label of labels) {
        await tabs.filter({ hasText: label }).click();
        const strip = SUBJECT_STRIP[label.toLowerCase()];
        const subjects = strip ? await page.locator(`.${strip}-tabs [role="tab"]`).evaluateAll((els) => els.map((e) => e.id)) : [null];
        if (strip) expect(subjects.length).toBe(3);
        for (const id of subjects) {
          if (id) await page.locator(`#${id}`).click();
          await page.waitForTimeout(100);
          for (const o of await overflowIn(page)) found.push(`${label}${id ? ` / ${id}` : ''}: ${o}`);
        }
      }
      expect(found).toEqual([]);
    });
  }
});
