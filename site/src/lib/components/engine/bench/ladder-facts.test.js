// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'bun:test';
import ladder from '$lib/ladder.generated.json';
import { verified } from '$lib/data.js';
import { RECORD_SIGNING_DOC } from '$lib/receipt.js';
import { caveatsOf, fill, ladderFacts } from './ladder-facts.js';

describe('fill', () => {
  test('replaces every placeholder it has a value for and leaves the rest visible', () => {
    expect(fill('{a} of {b} at C={c}', { a: 8, b: 8 })).toBe('8 of 8 at C={c}');
  });
  test('refuses a non-string', () => {
    expect(() => fill(undefined, {})).toThrow('fill: text must be a string');
  });
});

describe('ladderFacts on the published ladder', () => {
  const f = ladderFacts(ladder);
  const rows = [...ladder.rows].sort((a, b) => a.c - b.c);
  const top = rows[rows.length - 1];

  test('reads the top rung and its scored baseline, formatted as RESULTS.md prints them', () => {
    expect(f.c).toBe(top.c);
    expect(f.from).toBe(rows[0].c);
    expect(f.ratio).toBe(top.ratio_vs_best.toFixed(3));
    expect(f.engine).toBe(top.engine.toFixed(2));
    const best = top.baselines.find((b) => b.id === top.best_baseline_id);
    expect(f.baseline).toBe(best.tok_s.toFixed(2));
    expect(f.baselineLabel).toBe(best.label);
  });
  test('carries the summary and the workload identity', () => {
    expect(f.won).toBe(ladder.summary.won);
    expect(f.rungs).toBe(ladder.summary.rungs);
    expect(f.allWon).toBe(ladder.summary.won === ladder.summary.rungs);
    expect(f.min).toBe(ladder.summary.min_ratio.toFixed(3));
    expect(f.max).toBe(ladder.summary.max_ratio.toFixed(3));
    expect(f.checkpoint).toBe(ladder.workload.checkpoint);
    expect(f.gpu).toBe(ladder.box.gpu);
  });
  test('three decimals on a ratio, two on a throughput, always', () => {
    expect(f.ratio).toMatch(/^\d+\.\d{3}$/);
    expect(f.min).toMatch(/^\d+\.\d{3}$/);
    expect(f.engine).toMatch(/^\d+\.\d{2}$/);
  });
});

describe('ladderFacts refuses a ladder that cannot back the claim', () => {
  const rung = (c, extra = {}) => ({
    c,
    engine: 10,
    ratio_vs_best: 1.1,
    best_baseline_id: 'b',
    baselines: [{ id: 'b', label: 'B', tok_s: 9 }],
    ...extra,
  });
  const summary = { rungs: 1, won: 1, min_ratio: 1.1, max_ratio: 1.1 };
  const base = { workload: { checkpoint: 'x' }, box: { gpu: 'g' }, aggregate: 'a', summary };

  test('no rows', () => {
    expect(() => ladderFacts({ ...base, rows: [] })).toThrow('no rows');
  });
  test('a top rung whose scored baseline is missing', () => {
    expect(() => ladderFacts({ ...base, rows: [rung(1, { best_baseline_id: 'zz' })] })).toThrow('names no baseline zz');
  });
  test('a top rung that is not a measurement', () => {
    expect(() => ladderFacts({ ...base, rows: [rung(1, { engine: 0 })] })).toThrow('not a measurement');
  });
  test('a summary with a hole', () => {
    expect(() => ladderFacts({ ...base, rows: [rung(1)], summary: { rungs: 1, won: 1 } })).toThrow('summary is incomplete');
  });
  test('the top rung is the widest one whatever the row order', () => {
    const f = ladderFacts({ ...base, rows: [rung(8), rung(1), rung(4)] });
    expect(f.c).toBe(8);
    expect(f.from).toBe(1);
  });
});

describe('the signing doc the trust signal links', () => {
  test('is the one the dashboard and every record receipt link', () => {
    expect(verified.trust.signed.url).toBe(RECORD_SIGNING_DOC);
  });
});

describe('caveatsOf', () => {
  const caveats = caveatsOf(ladder, verified.caveats);
  const matched = ladder.series.find((s) => s.role === 'baseline' && s.parity === 'matched' && s.scope !== 'cost');
  const unmatched = ladder.series.filter((s) => s.role === 'baseline' && s.parity === 'unmatched');

  test('every caveat is filled: no placeholder survives to the page', () => {
    for (const c of caveats) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.text).not.toMatch(/\{\w+\}/);
    }
  });
  test('the matched baseline is named as a dated snapshot, with the dates its rungs carry', () => {
    const text = caveats.map((c) => c.text).join('\n');
    const dates = matched.rungs.map((r) => r.measured_utc.slice(0, 10)).sort();
    expect(text).toContain(matched.label);
    expect(text).toContain(matched.engine);
    expect(text).toContain(dates[0]);
    expect(text).toContain(dates[dates.length - 1]);
  });
  test('the box, the checkpoint and the workload are the manifest values', () => {
    const text = caveats.map((c) => c.text).join('\n');
    expect(text).toContain(ladder.box.gpu);
    expect(text).toContain(ladder.workload.checkpoint);
    expect(text).toContain(`ISL ${ladder.workload.isl_tokens}`);
    expect(text).toContain(`OSL ${ladder.workload.osl_tokens}`);
  });
  test('an unmatched leg earns a caveat that names its deltas; without one the caveat is absent', () => {
    const labels = caveats.map((c) => c.label);
    if (unmatched.length > 0) {
      expect(labels).toContain(verified.caveats.unmatched.label);
      const text = caveats.find((c) => c.label === verified.caveats.unmatched.label).text;
      for (const s of unmatched) for (const d of s.parity_deltas) expect(text).toContain(d);
    }
    const noUnmatched = { ...ladder, series: ladder.series.filter((s) => s.parity !== 'unmatched') };
    expect(caveatsOf(noUnmatched, verified.caveats).map((c) => c.label)).not.toContain(verified.caveats.unmatched.label);
  });
  test('the energy leg, a cost-scoped duplicate of the matched baseline, is never the baseline named here', () => {
    // vllm-mtp-energy is `matched` too; it stops at C=16 and exists for the
    // Cost tab. Put it first and the throughput baseline must still win.
    const energyFirst = { ...ladder, series: [...ladder.series].sort((a) => (a.scope === 'cost' ? -1 : 1)) };
    const text = caveatsOf(energyFirst, verified.caveats)
      .map((c) => c.text)
      .join('\n');
    expect(text).toContain(matched.label);
    expect(text).not.toContain('(energy)');
  });
  test('a ladder with no matched baseline is refused', () => {
    expect(() => caveatsOf({ ...ladder, series: [] }, verified.caveats)).toThrow('no matched baseline');
  });
});
