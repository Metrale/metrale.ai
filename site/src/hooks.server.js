// SPDX-License-Identifier: AGPL-3.0-only
//
// Runs at prerender time only: the site is static files. Every page is written
// with its boot script and modulepreloads inert, so the first paint needs the
// HTML alone. $lib/boot/defer-boot.js says why, and app.html opens them.
import { deferBoot } from '$lib/boot/defer-boot.js';

/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) =>
  resolve(event, {
    transformPageChunk: ({ html, done }) => {
      // A prerendered page arrives as one chunk. A streamed one would split the
      // boot script from its preloads, and neither half could be rewritten.
      if (!done) throw new Error(`${event.url.pathname}: a page streamed in chunks cannot have its boot deferred`);
      return deferBoot(html);
    },
  });
