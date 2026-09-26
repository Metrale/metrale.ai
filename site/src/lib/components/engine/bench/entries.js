// SPDX-License-Identifier: AGPL-3.0-only
//
// The dashboard's entry points on the page: one per benchmark family, each a
// deep link the dashboard resolves when it opens (dashboard-link.js).
//
// Both the list and the hash are written out here rather than imported, on
// purpose. $lib/gates.js imports the 1 MB gate record set, which the page
// keeps out of its bundle by loading the dashboard on click only; and
// dashboard-link.js is shared with that lazy chunk, so importing it here would
// split it into one more file every visit to /engine preloads (page-weight.spec.js
// holds that budget). entries.test.js holds the list equal to the tabs the
// dashboard renders and the hash equal to what dashboard-link.js formats, so
// neither can drift without the unit suite saying so.

export const DASHBOARD_ENTRIES = [
  { id: 'agentic', label: 'Agentic' },
  { id: 'bfcl', label: 'BFCL' },
  { id: 'ttft', label: 'TTFT' },
  { id: 'decode', label: 'Decode' },
  { id: 'concurrency', label: 'Concurrency' },
  { id: 'cost', label: 'Cost' },
];

/** The hash (without `#`) that opens the dashboard on this family's tab. */
export function entryHash(id) {
  if (!DASHBOARD_ENTRIES.some((e) => e.id === id)) throw new Error(`entries: ${JSON.stringify(id)} is not a dashboard entry`);
  return `bench=${id}`;
}
