// SPDX-License-Identifier: AGPL-3.0-only

// The app starts after the first paint (src/lib/boot/defer-boot.js and the gate
// in src/app.html). These walk a marketing page and the developer pages in a
// real browser: the page arrives with nothing started, then the gate starts it,
// the copied boot script passes the page's CSP, and SvelteKit runs.

import { test, expect } from '@playwright/test';

const PAGES = ['/', '/pricing', '/engine', '/control', '/diligence'];

for (const path of PAGES) {
  test(`${path} paints before its app starts, then starts it under its CSP`, async ({ page }) => {
    await page.addInitScript(() => {
      const started = () => Object.keys(history.state ?? {}).some((k) => k.startsWith('sveltekit:'));
      window.__violations = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__violations.push(`${e.violatedDirective} ${e.blockedURI}`));
      new PerformanceObserver((list) => {
        if (list.getEntriesByName('first-contentful-paint').length) window.__startedAtPaint = started();
      }).observe({ type: 'paint', buffered: true });
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const response = await page.goto(path, { waitUntil: 'commit' });
    const html = await response.text();
    expect(html).toContain('<script type="metrale/boot">');
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head.replace(/<template id="metrale-preloads">[\s\S]*?<\/template>/, '')).not.toContain('rel="modulepreload"');
    const preloads = [...head.matchAll(/rel="modulepreload"/g)].length;
    expect(preloads).toBeGreaterThan(0);

    // SvelteKit's start writes its history index into history.state; nothing
    // else on the page does, so it is there only if the copied boot script ran.
    await page.waitForFunction(() => Object.keys(history.state ?? {}).some((k) => k.startsWith('sveltekit:')));
    expect(await page.evaluate(() => window.__startedAtPaint)).toBe(false);
    expect(await page.locator('script[type="metrale/boot"]').count()).toBe(0);
    expect(await page.locator('head link[rel="modulepreload"]').count()).toBe(preloads);
    expect(await page.evaluate(() => window.__violations)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
