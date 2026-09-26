// SPDX-License-Identifier: AGPL-3.0-only
//
// Opens the benchmark dashboard from anywhere on the page, on a given view.
//
// The dashboard is owned by the hero: its trigger (`button.receipt-open-hint`)
// lazy-loads the component, and the component reads `location.hash` when it
// mounts to land on the tab, subject and rung a deep link names. So opening a
// view from elsewhere is two steps: write the deep link, then press the
// trigger. The trigger is the one element the browser suite resolves by its
// accessible name, which is why it is reused rather than duplicated.
//
// The hash is written with `location.hash`, not `goto` from $app/navigation:
// that import leaves a facade chunk every visit to /engine preloads
// (page-weight.spec.js holds the budget), while a hash assignment fires a
// `hashchange` the SvelteKit client already handles as a navigation, so the
// history state stays the router's. The dashboard clears the hash on close.

export const OPENER = 'button.receipt-open-hint';

/** @param {string} hash the deep link without its `#`, or '' for the default view */
export function openDashboard(hash) {
  const opener = document.querySelector(OPENER);
  // A page without the trigger is a wiring bug (the hero always mounts it), so
  // this is loud rather than a button that silently does nothing.
  if (!opener) throw new Error(`open-dashboard: no ${OPENER} on the page`);
  if (hash) location.hash = hash;
  opener.click();
}
