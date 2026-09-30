// SPDX-License-Identifier: AGPL-3.0-only
//
// panelsFor — the gate tab's chart list. It had NO test before this file, and
// the decode-floor branch is the one that now decides whether `stability` gets
// drawn at all, so the guard needs a control on both sides: a record that
// carries the key must produce the panel, and one that does not must produce
// exactly the panel list it produced before.
import { describe, expect, test } from 'bun:test';
import { isTtftBench, isTtftTab, panelsFor, recordsFor, tabs } from './gates.js';

/** A decode-floor record carrying whatever metrics the test needs. */
const rec = (metrics) => ({
  benchmark_id: 'decode-floor',
  git_sha: 'abc1234567',
  recorded_at: 1789900000,
  verdict: 'PASS',
  target_model: 'unsloth/Qwen3.8-27B-NVFP4',
  params: {},
  serve_overrides: {},
  metrics,
});

// The shape the September records actually carry, values from 2a822a73b1.
const MEASURED = { server_decode_tok_s: 26.19, arrival_gap_cv: 0.0527, stability: 0.0423 };

describe('panelsFor · decode-floor', () => {
  test('a record carrying stability gets a second panel for it', () => {
    const panels = panelsFor('decode-floor', [rec(MEASURED)]);
    expect(panels).toHaveLength(2);
    expect(panels[1].metrics).toEqual([{ key: 'stability', label: 'stability' }]);
  });

  // ★ ABSENT IS NOT ZERO. `stability` landed with the campaign-3 metrics work;
  // every record older than that has none, and those tabs must render exactly
  // as they did before rather than growing an empty chart.
  test('a record WITHOUT stability gets only the decode-floor panel', () => {
    const { server_decode_tok_s } = MEASURED;
    const panels = panelsFor('decode-floor', [rec({ server_decode_tok_s })]);
    expect(panels).toHaveLength(1);
    expect(panels[0].title).toBe('decode floor');
  });

  // ★ ITS OWN AXIS. stability is a tail spread (~0.04, lower = smoother) and
  // tok/s is ~26. On one axis the stability line is pinned to the bottom and
  // reads as "nothing happening" rather than as a different quantity.
  test('stability is a separate panel with its own unit, never merged into tok/s', () => {
    const [decode, stability] = panelsFor('decode-floor', [rec(MEASURED)]);
    expect(decode.unit).toBe('tok/s');
    expect(stability.unit).not.toBe(decode.unit);
    expect(decode.metrics.map((m) => m.key)).not.toContain('stability');
  });

  test('the newest record decides, so a tab does not lose the panel to old history', () => {
    const { server_decode_tok_s } = MEASURED;
    const panels = panelsFor('decode-floor', [rec({ server_decode_tok_s }), rec(MEASURED)]);
    expect(panels).toHaveLength(2);
  });
});

// ---- the TTFT family --------------------------------------------------------
// The high-ISL gates are TTFT gates whose ids do not start with `ttft`, which
// is why the family is read from the tab definitions: a `startsWith('ttft')`
// check sent them to the "unknown future benchmark" branch, one panel of the
// first metric, with no p90 and no vLLM line.
const HIGH_ISL = ['high-isl-ttft-cold', 'high-isl-ttft-warm', 'high-isl-ttft-cold-moe', 'high-isl-ttft-warm-moe'];

describe('panelsFor · TTFT', () => {
  test('the High-ISL TTFT tab exists, after TTFT, and holds the four high-ISL gates in order', () => {
    const ids = tabs.map((t) => t.id);
    expect(ids.indexOf('ttft-long')).toBe(ids.indexOf('ttft') + 1);
    const t = tabs.find((x) => x.id === 'ttft-long');
    expect(t.label).toBe('High-ISL TTFT');
    expect(t.benches).toEqual(HIGH_ISL);
  });

  test('every high-ISL and synthetic TTFT gate is in the family, and nothing else is', () => {
    for (const id of [...HIGH_ISL, 'ttft-cold-gate', 'ttft-warm-gate']) expect(isTtftBench(id)).toBe(true);
    for (const id of ['decode-floor', 'bfcl-subset', 'concurrency-sweep-moe', 'agentic-webserver']) expect(isTtftBench(id)).toBe(false);
    expect(isTtftTab('ttft')).toBe(true);
    expect(isTtftTab('ttft-long')).toBe(true);
    expect(isTtftTab('decode')).toBe(false);
  });

  test('one panel per statistic: the median tab draws median_ms only, the p90 tab p90_ms only', () => {
    for (const id of [...HIGH_ISL, 'ttft-cold-gate', 'ttft-warm-gate']) {
      const recs = recordsFor(id);
      const mode = id.includes('-cold') ? 'cold' : 'warm';
      const [median] = panelsFor(id, recs, { stat: 'median' });
      const [p90, extra] = panelsFor(id, recs, { stat: 'p90' });
      expect(extra).toBeUndefined();
      expect(median.metrics).toEqual([{ key: 'median_ms', label: 'median' }]);
      expect(p90.metrics).toEqual([{ key: 'p90_ms', label: 'p90' }]);
      expect(median.title).toBe(`${mode} TTFT · median`);
      expect(p90.title).toBe(`${mode} TTFT · p90`);
      expect(median.unit).toBe('ms');
    }
  });

  test('a TTFT panel asked for without a statistic, or for one the tabs do not offer, is refused', () => {
    const recs = recordsFor('high-isl-ttft-cold');
    expect(() => panelsFor('high-isl-ttft-cold', recs)).toThrow(/needs stat median or p90/);
    expect(() => panelsFor('ttft-warm-gate', recordsFor('ttft-warm-gate'), { stat: 'p99' })).toThrow(/needs stat median or p90/);
  });
});
