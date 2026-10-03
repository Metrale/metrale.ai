// SPDX-License-Identifier: AGPL-3.0-only
//
// The two TTFT tabs, RENDERED — not grepped. Svelte's server compiler turns a
// component into a function returning HTML and bun runs it without a DOM, so
// these assert on what a reader would see: which statistic is selected, which
// panels are drawn, and what the page says about vLLM.
//
// The claims under test:
//   * both TTFT tabs carry a Median | p90 strip, and `stat` in the link picks it;
//   * the High-ISL tab draws the four 32k gates, one statistic at a time;
//   * each gate says what vLLM measured on the same instrument, what it
//     refused to draw and why, and the ratio for the statistic on screen.
//
// The plugin is scoped to THIS file's imports, as in concurrency-tab.test.js.
import { describe, expect, test } from 'bun:test';
import { plugin } from 'bun';
import { compile } from 'svelte/compiler';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = fileURLToPath(new URL('./', import.meta.url));
const SELF = fileURLToPath(import.meta.url);

plugin({
  name: 'ttft-tab-ssr',
  setup(build) {
    build.onResolve({ filter: /^\$lib(\/|$)/ }, (a) =>
      a.importer.endsWith('.test.js') && a.importer !== SELF ? undefined : { path: join(LIB, a.path.slice(4)) }
    );
    build.module('$app/environment', () => ({ contents: 'export const browser = true; export const dev = false;', loader: 'js' }));
    build.module('$app/navigation', () => ({ contents: 'export const replaceState = () => {};', loader: 'js' }));
    build.onLoad({ filter: /\.svelte$/ }, (a) => ({
      contents: compile(readFileSync(a.path, 'utf8'), { filename: a.path, generate: 'server' }).js.code,
      loader: 'js',
    }));
  },
});

const { render } = await import('svelte/server');
const { recordsFor } = await import('./gates.js');
const Dashboard = (await import('./components/BenchmarkDashboard.svelte')).default;
const Section = (await import('./components/GateBenchSection.svelte')).default;

const html = (C, props) =>
  render(C, { props })
    .body.replace(/<!--[^]*?-->/g, '')
    .replace(/\s+/g, ' ');
const text = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');

const open = (hash) => {
  globalThis.location = { hash, pathname: '/', search: '' };
  try {
    return html(Dashboard, { onclose: () => {} });
  } finally {
    delete globalThis.location;
  }
};
const panelTitles = (page) => [...page.matchAll(/class="gate-panel-title">([^<]*)</g)].map((m) => m[1]);
const sectionNames = (page) => [...page.matchAll(/class="gbs-name">([^<]*)</g)].map((m) => m[1]);

describe('the deep link #bench=ttft-long&stat=p90&model=all', () => {
  // `model=all`: every model's gates, the way the tab read before the header's
  // model select scoped it to the flagship (dashboard-scope.js).
  const page = open('#bench=ttft-long&stat=p90&model=all');

  test('selects the High-ISL TTFT tab and the p90 statistic', () => {
    expect(page).toMatch(/id="bd-tab-ttft-long"[^>]*aria-selected="true"/);
    expect(page).toContain('>High-ISL TTFT');
    expect(page).toMatch(/id="tt-tab-p90"[^>]*aria-selected="true"/);
    expect(page).toMatch(/id="tt-tab-median"[^>]*aria-selected="false"/);
    expect(page).toContain('id="tt-panel-p90" role="tabpanel" aria-labelledby="tt-tab-p90"');
  });

  test('draws the four 32k gates, each as one p90 panel', () => {
    expect(sectionNames(page)).toEqual([
      'High-ISL Cold TTFT Gate',
      'High-ISL Warm TTFT Gate',
      'High-ISL Cold TTFT Gate (MoE)',
      'High-ISL Warm TTFT Gate (MoE)',
    ]);
    expect(panelTitles(page)).toEqual(['cold TTFT · p90', 'warm TTFT · p90', 'cold TTFT · p90', 'warm TTFT · p90']);
  });

  test('the header model select says every model is shown', () => {
    expect(page).toMatch(/<option value="all" selected="">all models<\/option>/);
  });

  test('a plain link opens on the flagship: its two 32k gates, the dense pair hidden behind the select', () => {
    const flagship = open('#bench=ttft-long&stat=p90');
    expect(sectionNames(flagship)).toEqual(['High-ISL Cold TTFT Gate (MoE)', 'High-ISL Warm TTFT Gate (MoE)']);
    expect(text(flagship)).toContain('High-ISL Cold TTFT Gate runs on Qwen3.8-27B-NVFP4 — switch the model to see its');
    // The 27B's link shows its own pair.
    expect(sectionNames(open('#bench=ttft-long&model=unsloth%2FQwen3.8-27B-NVFP4'))).toEqual([
      'High-ISL Cold TTFT Gate',
      'High-ISL Warm TTFT Gate',
    ]);
  });

  test('draws a vLLM line on every panel and names it in the legend', () => {
    // The chart line (plot coordinates, one decimal), not the legend swatch (`M1 5 H19`).
    expect(page.match(/<path class="gc-baseline" d="M\d+\.\d /g) ?? []).toHaveLength(4);
    expect(page.match(/<path class="gc-baseline" d="M1 5 H19"/g) ?? []).toHaveLength(4);
    expect(page.match(/vLLM, same instrument/g) ?? []).toHaveLength(4);
  });
});

describe('the Median | p90 strip on both TTFT tabs', () => {
  test('TTFT opens on the median, and its panels are median panels', () => {
    const page = open('#bench=ttft');
    expect(page).toMatch(/id="tt-tab-median"[^>]*aria-selected="true"/);
    expect(panelTitles(page)).toEqual(['warm TTFT · median', 'cold TTFT · median']);
  });

  test('stat=p90 on the TTFT tab switches its panels too', () => {
    expect(panelTitles(open('#bench=ttft&stat=p90'))).toEqual(['warm TTFT · p90', 'cold TTFT · p90']);
  });

  test('an unknown stat lands on the median, never on an empty strip', () => {
    const page = open('#bench=ttft-long&stat=p99&model=all');
    expect(page).toMatch(/id="tt-tab-median"[^>]*aria-selected="true"/);
    expect(panelTitles(page)).toHaveLength(4);
  });

  test('no other tab grows the strip', () => {
    for (const tab of ['bfcl', 'decode', 'concurrency', 'cost']) expect(open(`#bench=${tab}`)).not.toContain('tt-tabs');
  });
});

describe('what each high-ISL gate says about vLLM', () => {
  const section = (benchId, stat) =>
    text(html(Section, { benchId, name: benchId, records: recordsFor(benchId), stat, onselect: () => {} }));

  test('the MoE cold gate: the one-shot figure, its box, and the refused 12-sample run with its reason', () => {
    const t = section('high-isl-ttft-cold-moe', 'median');
    expect(t).toContain('vLLM + MTP on Qwen3.6-35B-A3B-FP8: 9,232 ms median, vLLM 0.27.1, one-shot, 3 steady requests, dgx3 (spark-28c2).');
    expect(t).toContain('Not drawn: vLLM + MTP gate run, 3 runs of 12 samples, which differs in reps 12 → 1.');
  });

  test('the dense cold gate: the dense one-shot, from the dense box', () => {
    const t = section('high-isl-ttft-cold', 'p90');
    expect(t).toContain('vLLM + MTP on Qwen3.8-27B-NVFP4: 24,115 ms p90, vLLM 0.27.1, one-shot, 2 steady requests, dgx2 (spark-43fa).');
    expect(t).not.toContain('not measured');
  });

  test('the ratio tile follows the statistic on screen and the newest run', () => {
    const recs = recordsFor('high-isl-ttft-cold-moe');
    const latest = recs[recs.length - 1].metrics;
    const want = (ms, vllm) => `${(vllm / ms).toFixed(2)}x faster`;
    expect(section('high-isl-ttft-cold-moe', 'median')).toContain(`${want(latest.median_ms, 9231.9)} vs vLLM · median`);
    expect(section('high-isl-ttft-cold-moe', 'p90')).toContain(`${want(latest.p90_ms, 9231.9)} vs vLLM · p90`);
  });

  test('a gate with no vLLM figure says "not measured" and draws no line', () => {
    const recs = recordsFor('high-isl-ttft-cold').map((r) => ({ ...r, target_model: 'example/Unmeasured-1B' }));
    const page = html(Section, { benchId: 'high-isl-ttft-cold', name: 'x', records: recs, stat: 'median', onselect: () => {} });
    expect(text(page)).toContain(
      'vLLM on Unmeasured-1B: not measured. No vLLM TTFT manifest exists for example/Unmeasured-1B under bench/baselines/.'
    );
    expect(page).not.toContain('class="gc-baseline"');
    expect(text(page)).not.toContain('vs vLLM');
  });
});
