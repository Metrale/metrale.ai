// =============================================================================
// page-width.spec.js — no page scrolls sideways on a phone
// -----------------------------------------------------------------------------
// At 390px every page must fit its width: the document is no wider than the
// screen. A wide command, table or chart may scroll inside its own overflow-x
// box; the page itself may not. When one does, the failure names the text that
// reaches past the edge, because the element that widens a page is rarely the
// one whose box is too wide (an unbreakable path inside a list item, a nowrap
// command in a flex child). The benchmark dashboard, a dialog, has its own
// spec (dashboard-width.spec.js). Runs in the mobile project.
// =============================================================================

import { test, expect } from '@playwright/test';
import { pages, routes } from '../src/lib/content/index.js';
import { industries } from '../src/lib/content/brand.js';

// The registry already lists the solution pages; a Set keeps each path once.
const PATHS = [
  ...new Set([
    ...pages.map((p) => p.path).filter((p) => p !== '/404'),
    ...industries.map((i) => `${routes.solutions}/${i.slug}`),
    routes.openSource,
    routes.controlPlane,
    routes.diligence,
  ]),
];

/** The document's overflow, and the text past the right edge that causes it. */
const overflowOf = (page) =>
  page.evaluate(() => {
    const d = document.documentElement;
    const vw = d.clientWidth;
    if (d.scrollWidth <= vw) return null;
    const scrolls = (el) => {
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return p;
      }
      return null;
    };
    const past = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && past.length < 5; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      const box = scrolls(n.parentElement);
      if (r.right > vw + 0.5 && (!box || box.getBoundingClientRect().right > vw + 0.5))
        past.push(
          `${n.parentElement.tagName.toLowerCase()}.${n.parentElement.className} "${n.textContent.trim().slice(0, 50)}" right ${Math.round(r.right)}`
        );
    }
    return { scrollWidth: d.scrollWidth, clientWidth: vw, past };
  });

test.describe('every page at 390px', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'mobile', 'the phone width is the mobile project'));

  for (const path of PATHS) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path);
      expect(await overflowOf(page)).toBeNull();
    });
  }
});
