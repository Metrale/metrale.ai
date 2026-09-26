// The hashes of the inline scripts in an app.html, for a SvelteKit `csp` config.
//
// SvelteKit hashes the inline scripts it writes itself into each prerendered
// page's <meta> CSP; the ones in app.html are ours to name. A placeholder
// inside one would render differently page by page and so hash differently,
// and a script added without updating the count would be blocked in the
// browser, so both stop the build here instead.

import { createHash } from 'node:crypto';

/**
 * @param {string} html the app.html text
 * @param {number} expected how many inline scripts the caller knows it has
 * @returns {string[]} CSP hash sources, e.g. `sha256-…`
 */
export function inlineScriptHashes(html, expected) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (scripts.length !== expected)
    throw new Error(`app.html has ${scripts.length} inline scripts, the CSP config expects ${expected}: update both together`);
  if (scripts.some((s) => s.includes('%sveltekit.')))
    throw new Error('an app.html inline script holds a %sveltekit.*% placeholder, so its bytes, and its hash, differ page by page');
  return scripts.map((s) => `sha256-${createHash('sha256').update(s).digest('base64')}`);
}
