// SPDX-License-Identifier: AGPL-3.0-only
//
// chart-nested-interactive.test.js — a chart's role="img" never wraps a
// role="button" point.
//
// role="img" tells assistive tech to treat the whole subtree as one flat
// picture, collapsing every descendant out of the accessibility tree. A
// chart whose points are real role="button" elements (clickable, opening the
// record card) then hides every one of them from a screen reader, even
// though they work fine for a mouse or a tab key — axe's "nested-interactive"
// rule, found live on production by ux-oracle (metrale.ai#72, 2026-10-05).
// The fix is role="group" on any chart svg that has interactive points;
// role="img" stays correct on a chart that never draws one (CostSavings,
// ConcurrencyBaseline, ConcurrencyLadder, and ConcurrencyComparison's own
// non-live states — untouched here, proven elsewhere or simply inapplicable).
//
// Rendered, not grepped for the role alone: each test first proves the chart
// really draws a role="button" point (so a chart with none would not pass
// vacuously), then proves none of them sits inside a role="img" ancestor.
//
// The plugin is scoped to THIS file's imports, like concurrency-tab.test.js.
import { describe, expect, test } from 'bun:test';
import { plugin } from 'bun';
import { compile } from 'svelte/compiler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = fileURLToPath(new URL('./', import.meta.url));
const SELF = fileURLToPath(import.meta.url);

plugin({
  name: 'chart-nested-interactive-ssr',
  setup(build) {
    build.onResolve({ filter: /^\$lib(\/|$)/ }, (a) =>
      a.importer.endsWith('.test.js') && a.importer !== SELF ? undefined : { path: join(LIB, a.path.slice(4)) }
    );
    build.onLoad({ filter: /\.svelte$/ }, (a) => ({
      contents: compile(readFileSync(a.path, 'utf8'), { filename: a.path, generate: 'server' }).js.code,
      loader: 'js',
    }));
  },
});

const { render } = await import('svelte/server');
const { SUBJECTS } = await import('./concurrency-subjects.js');
const GateChart = (await import('./components/GateChart.svelte')).default;
const GateLadderChart = (await import('./components/GateLadderChart.svelte')).default;
const ConcurrencyComparison = (await import('./components/ConcurrencyComparison.svelte')).default;

const html = (C, props) => render(C, { props }).body.replace(/<!--[^]*?(?:-->|$)/g, '');

/** No role="img" element's subtree contains a role="button" element. */
function assertNoNestedInteractive(page) {
  for (const m of page.matchAll(/<svg[^>]*\brole="img"[^>]*>/g)) {
    const start = m.index + m[0].length;
    const end = page.indexOf('</svg>', start);
    const body = page.slice(start, end === -1 ? page.length : end);
    expect(body).not.toContain('role="button"');
  }
}

const MODEL = 'unsloth/Qwen3.8-27B-NVFP4';
const DAY = 86400;
const T0 = 1_800_000_000;
let seq = 0;
const rec = (over = {}) => {
  seq += 1;
  return {
    benchmark_id: 'decode-floor',
    benchmark_name: 'decode floor',
    git_sha: `sha${seq}`,
    recorded_at: T0 + seq * DAY,
    target_model: MODEL,
    served_by: 'recipe',
    verdict: 'PASS',
    verdict_reason: '',
    branch: '',
    params: {},
    metrics: {},
    trend_predecessor: '',
    generated_ancestry: 'unknown',
    ...over,
  };
};
const decode = (v) => rec({ metrics: { server_decode_tok_s: v } });
const DECODE_PANEL = { title: 'decode floor', unit: 'tok/s', metrics: [{ key: 'server_decode_tok_s', label: 'tok/s' }] };

describe('GateChart', () => {
  test('its points are real role="button" descendants, and none sits inside a role="img"', () => {
    const page = html(GateChart, { panel: DECODE_PANEL, records: [decode(30), decode(31), decode(29)], onselect: () => {} });
    expect(page).toContain('role="button"');
    assertNoNestedInteractive(page);
  });
});

describe('GateLadderChart', () => {
  const sweep = (cells, over = {}) =>
    rec({
      benchmark_id: 'concurrency-sweep',
      metrics: Object.fromEntries([
        ...Object.entries(cells).map(([c, v]) => [`c${c}_aggregate_tok_s`, v]),
        ['peak_aggregate_tok_s', Math.max(...Object.values(cells))],
      ]),
      params: { concurrencies: Object.keys(cells).join(', '), isls: '512', osl: '320' },
      ...over,
    });

  test('its points are real role="button" descendants, and none sits inside a role="img"', () => {
    const page = html(GateLadderChart, {
      panel: { title: 'latest gate sweep', unit: 'tok/s' },
      records: [sweep({ 1: 22, 2: 27, 4: 40 })],
      onselect: () => {},
    });
    expect(page).toContain('role="button"');
    assertNoNestedInteractive(page);
  });
});

describe('ConcurrencyComparison', () => {
  const subject = SUBJECTS.find((s) => s.gate === 'concurrency-sweep' && s.checkpoint === MODEL);
  const live = rec({
    benchmark_id: 'concurrency-sweep',
    metrics: { c1_aggregate_tok_s: 22, c2_aggregate_tok_s: 40 },
    params: { concurrencies: '1, 2', isls: '512', osl: '320' },
  });

  test('in the "live" state, its points are real role="button" descendants, and none sits inside a role="img"', () => {
    const page = html(ConcurrencyComparison, {
      subject,
      records: [live],
      rungs: [1, 2],
      onselect: () => {},
      ladders: { subjects: {} },
    });
    expect(page).toContain('role="button"');
    assertNoNestedInteractive(page);
  });

  test('in the empty state (no run yet), role="img" is still correct -- there is nothing interactive to hide', () => {
    const page = html(ConcurrencyComparison, {
      subject,
      records: [],
      rungs: [1, 2],
      onselect: () => {},
      ladders: { subjects: {} },
    });
    expect(page).not.toContain('role="button"');
    expect(page).toContain('role="img"');
  });
});
