// SPDX-License-Identifier: AGPL-3.0-only

// Every spec takes `test` and `expect` from here, not from @playwright/test.
//
// The app starts after the first paint (src/lib/boot/defer-boot.js and the gate
// in src/app.html), so a page is on screen, and its load event has fired, a
// moment before its buttons work. A spec that clicks straight after page.goto
// would race that moment and lose the click. Here page.goto and page.reload
// return once the app has started, which is when a visitor's next tap works.
//
// "Started" is read from SvelteKit itself: once hydration is done its router
// adds the window's beforeunload listener, and nothing on the site adds one
// earlier. An init script notes when that happens. It watches only; the page
// runs exactly as it does for a visitor.

import { test as base, expect } from '@playwright/test';

export { expect };

/** @param {import('@playwright/test').Page} page */
export const appStarted = (page) => page.waitForFunction(() => window.__appStarted === true);

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Response | null} response
 * @param {{ waitUntil?: string } | undefined} options
 */
async function settle(page, response, options) {
  if (options?.waitUntil === 'commit') return response;
  if (!response?.headers()['content-type']?.includes('text/html')) return response;
  await appStarted(page);
  return response;
}

export const test = base.extend({
  page: async ({ page, javaScriptEnabled }, use) => {
    // Without script there is no app to wait for: the page is what the HTML says.
    if (javaScriptEnabled === false) return use(page);
    await page.addInitScript(() => {
      const add = window.addEventListener;
      window.addEventListener = function (type, ...rest) {
        if (type === 'beforeunload') window.__appStarted = true;
        return add.call(this, type, ...rest);
      };
    });
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = async (url, options) => settle(page, await goto(url, options), options);
    page.reload = async (options) => settle(page, await reload(options), options);
    await use(page);
  },
});
