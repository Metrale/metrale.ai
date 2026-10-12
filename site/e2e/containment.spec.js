// SPDX-License-Identifier: AGPL-3.0-only

// Sections below the hero and the footer skip their rendering until they near
// the screen (content-visibility in metrale.css and SiteFooter.svelte). That
// containment makes each of them the containing block for a `position: fixed`
// descendant, so a dialog, a toast or a backdrop rendered inside one would be
// pinned to the section and clipped by it instead of covering the viewport.
// Every page is checked for any such element, shown or not.

import { test, expect } from './fixtures/app.js';
import { pages } from '../src/lib/content/index.js';

const PATHS = [...pages.filter((p) => p.sitemap !== false).map((p) => p.path), '/engine', '/control', '/diligence'];

for (const path of [...new Set(PATHS)]) {
  test(`${path}: nothing fixed in place sits inside a skipped section`, async ({ page }) => {
    await page.goto(path);
    const contained = await page.evaluate(() =>
      [...document.querySelectorAll('.av-section *, .av-footer *')]
        .filter((el) => getComputedStyle(el).position === 'fixed')
        .map((el) => el.outerHTML.slice(0, 120))
    );
    expect(contained).toEqual([]);
  });
}
