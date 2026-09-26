import adapter from '@sveltejs/adapter-static';
import { readFileSync } from 'node:fs';
import { inlineScriptHashes } from '../web-shared/csp.mjs';

// The two inline scripts in app.html: the theme boot and the late font sheet.
const appHtmlHashes = inlineScriptHashes(readFileSync(new URL('./src/app.html', import.meta.url), 'utf8'), 2);

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // Both web properties render the same design tokens and lockup. They
    // live in web-shared/ at the repo root — one copy, imported
    // by two apps, rather than a copy per app that drifts.
    alias: { $shared: '../web-shared' },
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: true,
    }),
    // PRPL "render the initial route ASAP": inline the (single) stylesheet into
    // the prerendered document so first paint needs no CSS round trip. The 38 KB
    // sheet is the only render-blocking resource; 48 KiB covers it with headroom
    // while leaving any future oversized sheet external rather than bloating the
    // document unboundedly. Repeat-visit caching is handled by the service worker.
    inlineStyleThreshold: 48 * 1024,
    // The script policy, written into every prerendered page as a <meta> CSP
    // with the hash of each inline script: no inline script runs unless it is
    // one of ours. 'wasm-unsafe-eval' is for the codebase chat's in-browser
    // database (LatticeDB, WebAssembly). Everything else the site loads is
    // governed by the header policy in static/_headers, which a <meta> cannot
    // carry (frame-ancestors) and which covers the files that are not pages.
    csp: {
      mode: 'hash',
      directives: { 'script-src': ['self', 'wasm-unsafe-eval', ...appHtmlHashes] },
    },
    prerender: {
      entries: ['*'],
      handleHttpError: ({ path, message }) => {
        if (path === '/favicon.png') return;
        throw new Error(message);
      },
    },
  },
};

export default config;
