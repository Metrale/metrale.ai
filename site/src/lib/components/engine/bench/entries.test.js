// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'bun:test';
import { tabs } from '$lib/gates.js';
import { formatDashboardHash, parseDashboardHash } from '$lib/dashboard-link.js';
import { DASHBOARD_ENTRIES, entryHash } from './entries.js';

describe('the page entry points and the dashboard tabs are the same list', () => {
  // The page cannot import gates.js (1 MB of records); this is what keeps the
  // written-out list honest.
  test('same ids, same labels, same order', () => {
    expect(DASHBOARD_ENTRIES).toEqual(tabs.map((t) => ({ id: t.id, label: t.label })));
  });

  test('every entry hash is exactly what dashboard-link.js would format for that tab', () => {
    for (const e of DASHBOARD_ENTRIES) expect(entryHash(e.id)).toBe(formatDashboardHash({ tab: e.id }));
  });

  test('every entry resolves to its own tab when the dashboard reads the hash', () => {
    const known = { tabIds: tabs.map((t) => t.id), subjectIds: [], rungs: [] };
    for (const e of DASHBOARD_ENTRIES) expect(parseDashboardHash(entryHash(e.id), known).tab).toBe(e.id);
  });

  test('a hash carries only the tab: a TTFT link has no subject and no rung', () => {
    expect(entryHash('ttft')).toBe('bench=ttft');
  });

  test('an id that is not an entry is refused rather than linked to the first tab', () => {
    expect(() => entryHash('nope')).toThrow('not a dashboard entry');
  });
});
