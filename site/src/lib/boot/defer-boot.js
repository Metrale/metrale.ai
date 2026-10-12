// SPDX-License-Identifier: AGPL-3.0-only
//
// The app starts after the page has painted, not before.
//
// Every page is prerendered: its words, layout and images are in the HTML, and
// nothing needs JavaScript to be seen. SvelteKit still starts the app at once.
// It lists every script the page will run as a <link rel="modulepreload"> in
// the head, so they download alongside the HTML, and its boot script imports
// them as soon as the parser reaches the end of the body. On a phone on a slow
// connection those 100 to 300 KB of script share the first second with the
// HTML they are not needed to draw. Lighthouse's mobile run measured exactly
// that: every page held at 91 to 99, and the same pages with the scripts taken
// out scored 100.
//
// So each prerendered page is rewritten in two places, both inert until the
// gate in app.html opens them once the first paint is on screen:
//
//   the boot script    gets a non-JavaScript type, so the parser skips it. The
//                      gate runs a copy of it with its bytes unchanged, so the
//                      hash SvelteKit wrote into the page's CSP still matches.
//   the modulepreloads move into a <template>, whose contents the browser
//                      does not fetch. The gate moves them back into the head
//                      just before it starts the app, so every script still
//                      downloads in one parallel round, not as a waterfall.
//
// A page that does not look exactly like this stops the build: a SvelteKit
// upgrade that changes the shape must be read, not silently skipped.

/** The type the boot script carries until the gate runs it. app.html reads it. */
export const BOOT_TYPE = 'metrale/boot';
/** The id of the <template> that holds the modulepreloads until then. app.html reads it. */
export const PRELOADS_ID = 'metrale-preloads';

// SvelteKit's boot: a bare <script> whose block opens by assigning its global.
const BOOT = /<script>(?=\s*\{\s*__sveltekit_[a-z0-9]+ = \{)/g;
// One modulepreload, as SvelteKit writes it, and a run of them.
const PRELOAD = /<link href="[^"]+" rel="modulepreload">/g;
const PRELOAD_RUN = /(?:<link href="[^"]+" rel="modulepreload">\s*)+/g;

/**
 * @param {string} html a prerendered page
 * @returns {string} the same page, its boot script and modulepreloads made inert
 */
export function deferBoot(html) {
  const boots = html.match(BOOT)?.length ?? 0;
  const preloads = html.match(PRELOAD)?.length ?? 0;
  if (boots === 0 && preloads === 0) return html;
  if (boots !== 1) throw new Error(`deferBoot: expected one SvelteKit boot script, found ${boots}`);
  if (preloads === 0) throw new Error('deferBoot: the page boots but preloads no script');

  const runs = html.match(PRELOAD_RUN) ?? [];
  if (runs.length !== 1) throw new Error(`deferBoot: expected the modulepreloads as one run in the head, found ${runs.length} runs`);
  const head = html.indexOf('</head>');
  if (head === -1 || html.indexOf(runs[0]) > head) throw new Error('deferBoot: the modulepreloads are not in the head');

  return html
    .replace(PRELOAD_RUN, (run) => `<template id="${PRELOADS_ID}">${run.trimEnd()}</template>`)
    .replace(BOOT, `<script type="${BOOT_TYPE}">`);
}
