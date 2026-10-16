// SPDX-License-Identifier: AGPL-3.0-only
//
// The battle panels of the benchmarks page (battle-grid.js). Each rule that
// decides a verdict, a margin or whether a battle appears has a control on the
// other side: the direction is the battle's, never "bigger wins"; a cell with
// no value keeps the battle open; a record of another checkpoint is not ours;
// and a cell inside its own regression limit can still lose.
import { describe, expect, test } from 'bun:test';
import { battleOf, battleSections, captureOf, columnLabel, judge, modelBlocks, unitOf } from './battle-grid.js';
import { declaredLimit, limitFor, violationOf } from './gate-limits.js';

const GLM = 'org/GLM-Flash';
const OTHER = 'org/Other';

const BATTLES = [
  {
    id: 'ttft-battle',
    name: 'TTFT battle',
    gate_prefixes: ['ttft-cold-', 'ttft-warm-', 'high-isl-ttft-cold-'],
    metrics: [
      { pattern: 'median_ms', better: 'lower' },
      { pattern: 'median_ms_{n}', better: 'lower' },
    ],
    note: '',
  },
  {
    id: 'decode-battle',
    name: 'Decode battle',
    gate_prefixes: ['concurrency-sweep'],
    metrics: [{ pattern: 'c{n}_aggregate_tok_s', better: 'higher' }],
    note: '',
  },
];

const declared = (max_model_len, targets) => ({ [GLM]: { model: 'glm', label: null, max_model_len, targets } });
// The shape gen-gates.mjs writes. The 256k cold gate is listed before the 64k
// one and warm before cold, so the row order is the grid's, not the input's.
const CONTEXT = {
  'ttft-warm-glm-64k': declared(65536, { median_ms_256: 133, median_ms_1024: 140 }),
  'ttft-cold-glm-256k': declared(262144, { median_ms_256: 488, median_ms_1024: 679 }),
  'ttft-cold-glm-64k': declared(65536, { median_ms_256: 488, median_ms_1024: 679 }),
  'high-isl-ttft-cold-glm-64k': declared(65536, { median_ms: 10479 }),
  'concurrency-sweep-glm': declared(65536, { c1_aggregate_tok_s: 40.11, c12_aggregate_tok_s: 131.74 }),
  // A gate no battle claims, with a target: never a cell.
  'agentic-webserver-glm': declared(65536, { s_per_turn: 4 }),
};
const series = (value) => [{ since: 1, value }];
const LIMITS = {
  'ttft-cold-glm-64k': { [GLM]: { median_ms_256: { max: series(500) }, median_ms_1024: { max: series(700) } } },
  'high-isl-ttft-cold-glm-64k': { [GLM]: { median_ms: { max: series(11446.9) }, prompt_tokens: { min: series(32768) } } },
};
const rec = (gate, metrics, { model = GLM, at = 100, sha = 'a' } = {}) => ({
  benchmark_id: gate,
  target_model: model,
  recorded_at: at,
  git_sha: sha,
  metrics,
});

function sections(records, battles = BATTLES) {
  return battleSections({
    battles,
    context: CONTEXT,
    recordsFor: (gate) => records.filter((r) => r.benchmark_id === gate),
    limitFor: (r, m) => limitFor(r, m, LIMITS),
    declaredLimit: (g, c, m) => declaredLimit(LIMITS, g, c, m, Number.MAX_SAFE_INTEGER),
    violationOf,
  });
}
const battle = (records, id) =>
  sections(records)
    .get(GLM)
    ?.find((b) => b.id === id);
const cell = (grid, mode, context, column) =>
  grid.rows.find((r) => r.mode === mode && r.context === context).cells[grid.columns.indexOf(column)];

const ALL_TTFT_WIN = [
  rec('ttft-cold-glm-64k', { median_ms_256: 420, median_ms_1024: 600 }),
  rec('ttft-cold-glm-256k', { median_ms_256: 430, median_ms_1024: 610 }),
  rec('ttft-warm-glm-64k', { median_ms_256: 100, median_ms_1024: 110 }),
  rec('high-isl-ttft-cold-glm-64k', { median_ms: 9000 }),
];

describe('when a battle appears', () => {
  test('no record of the model: no battle, so no vLLM figure reads as a result', () => {
    expect(sections([]).size).toBe(0);
  });

  test('CONTROL: one record shows the whole battle, every declared cell', () => {
    const b = battle([rec('ttft-cold-glm-64k', { median_ms_256: 420 })], 'ttft-battle');
    expect(b.counts.cells).toBe(7);
    expect(
      sections([rec('ttft-cold-glm-64k', { median_ms_256: 420 })])
        .get(GLM)
        .map((x) => x.id)
    ).toEqual(['ttft-battle']);
  });

  test('a record of ANOTHER checkpoint on the gate does not show the battle', () => {
    expect(sections([rec('ttft-cold-glm-64k', { median_ms_256: 1 }, { model: OTHER })]).size).toBe(0);
  });

  test('a target on a gate no battle claims is not a cell', () => {
    const b = battle(ALL_TTFT_WIN, 'ttft-battle');
    expect(b.rows.flatMap((r) => r.cells).some((c) => c?.gate === 'agentic-webserver-glm')).toBe(false);
  });
});

describe('the verdict and the margin', () => {
  test('lower is better for TTFT: 420 against 488 wins by 13.9%', () => {
    const c = cell(battle(ALL_TTFT_WIN, 'ttft-battle'), 'cold', 65536, 256);
    expect(c.verdict).toBe('win');
    expect(c.margin_pct).toBeCloseTo(13.93, 2);
  });

  test('higher is better for decode: 45 against 40.11 wins, 35 loses with a negative margin', () => {
    const won = cell(battle([rec('concurrency-sweep-glm', { c1_aggregate_tok_s: 45 })], 'decode-battle'), null, 65536, 1);
    const lost = cell(battle([rec('concurrency-sweep-glm', { c1_aggregate_tok_s: 35 })], 'decode-battle'), null, 65536, 1);
    expect([won.verdict, lost.verdict]).toEqual(['win', 'loss']);
    expect(won.margin_pct).toBeCloseTo(12.19, 2);
    expect(lost.margin_pct).toBeCloseTo(-12.74, 2);
  });

  test('a slower TTFT loses with the margin negative: 11103.9 against 10479 is -6.0%', () => {
    const c = cell(battle([rec('high-isl-ttft-cold-glm-64k', { median_ms: 11103.9 })], 'ttft-battle'), 'cold', 65536, 32768);
    expect(c.verdict).toBe('loss');
    expect(c.margin_pct).toBeCloseTo(-5.96, 2);
  });

  test('equal is a tie, not a win', () => {
    expect(judge(488, 488, 'lower')).toEqual({ verdict: 'tie', margin_pct: 0 });
  });

  test('a cell inside its own limit can still lose, and both are shown', () => {
    const c = cell(battle([rec('high-isl-ttft-cold-glm-64k', { median_ms: 11103.9 })], 'ttft-battle'), 'cold', 65536, 32768);
    expect([c.verdict, c.ratchet]).toEqual(['loss', 'within']);
    expect(c.limit.max).toBe(11446.9);
  });

  test('CONTROL: over its limit reads as a breach', () => {
    const c = cell(battle([rec('high-isl-ttft-cold-glm-64k', { median_ms: 12000 })], 'ttft-battle'), 'cold', 65536, 32768);
    expect(c.ratchet).toBe('breach');
  });

  test('a cell with no declared limit says so instead of "within"', () => {
    const c = cell(battle(ALL_TTFT_WIN, 'ttft-battle'), 'warm', 65536, 256);
    expect(c.ratchet).toBe('unbounded');
  });
});

describe('the battle verdict', () => {
  test('CONTROL: every cell recorded and winning is a won battle', () => {
    const b = battle(ALL_TTFT_WIN, 'ttft-battle');
    expect(b.all_cells_win).toBe(true);
    expect(b.counts).toEqual({ cells: 7, win: 7, loss: 0, tie: 0, open: 0 });
  });

  test('one cell with no record keeps the battle open', () => {
    const b = battle(ALL_TTFT_WIN.slice(1), 'ttft-battle');
    expect(b.all_cells_win).toBe(false);
    expect(cell(b, 'cold', 65536, 256).verdict).toBe('no-record');
    expect(b.counts.open).toBe(2);
  });

  test('a record that does not report the metric is open, never a number', () => {
    const records = [...ALL_TTFT_WIN.slice(1), rec('ttft-cold-glm-64k', { median_ms_1024: 600 })];
    const c = cell(battle(records, 'ttft-battle'), 'cold', 65536, 256);
    expect([c.verdict, c.value, c.margin_pct, c.ratchet]).toEqual(['not-reported', null, null, 'no-value']);
    expect(battle(records, 'ttft-battle').all_cells_win).toBe(false);
  });
});

describe('the grid layout', () => {
  test('rows are cold before warm, then by context; columns by prompt length', () => {
    const b = battle(ALL_TTFT_WIN, 'ttft-battle');
    expect(b.rows.map((r) => [r.mode, r.context])).toEqual([
      ['cold', 65536],
      ['cold', 262144],
      ['warm', 65536],
    ]);
    expect(b.columns).toEqual([256, 1024, 32768]);
  });

  test('a metric with no {n} takes its column from the prompt length its limits pin', () => {
    const b = battle(ALL_TTFT_WIN, 'ttft-battle');
    expect(cell(b, 'cold', 65536, 32768).gate).toBe('high-isl-ttft-cold-glm-64k');
    expect(columnLabel(b, 32768)).toBe('32k-token prompt');
    expect(columnLabel(b, 256)).toBe('256-token prompt');
  });

  test('a cell no gate declares is null, not a number', () => {
    expect(cell(battle(ALL_TTFT_WIN, 'ttft-battle'), 'warm', 65536, 32768)).toBeNull();
  });

  test('decode columns are concurrency rungs', () => {
    const b = battle([rec('concurrency-sweep-glm', { c1_aggregate_tok_s: 45 })], 'decode-battle');
    expect(b.columns).toEqual([1, 12]);
    expect(b.columns.map((c) => columnLabel(b, c))).toEqual(['C=1', 'C=12']);
    expect(unitOf('c12_aggregate_tok_s')).toBe('tok/s');
    expect(unitOf('median_ms_256')).toBe('ms');
  });
});

describe('the trend', () => {
  test('is the margin over every record of this checkpoint, oldest first', () => {
    const records = [
      rec('high-isl-ttft-cold-glm-64k', { median_ms: 10000 }, { at: 300, sha: 'c' }),
      rec('high-isl-ttft-cold-glm-64k', { median_ms: 11103.9 }, { at: 100, sha: 'a' }),
      rec('high-isl-ttft-cold-glm-64k', { median_ms: 1 }, { at: 200, sha: 'x', model: OTHER }),
      rec('high-isl-ttft-cold-glm-64k', { median_ms: 10479 }, { at: 200, sha: 'b' }),
    ].sort((a, b) => a.recorded_at - b.recorded_at);
    const c = cell(battle(records, 'ttft-battle'), 'cold', 65536, 32768);
    expect(c.trend.map((t) => t.git_sha)).toEqual(['a', 'b', 'c']);
    expect(c.trend.map((t) => Number(t.margin_pct.toFixed(2)))).toEqual([-5.96, 0, 4.57]);
    expect(c.value).toBe(10000);
  });
});

describe('patterns and claims', () => {
  test.each([
    ['median_ms_{n}', 'median_ms_256', 256],
    ['median_ms_{n}', 'median_ms_', null],
    ['median_ms_{n}', 'median_ms_2x', null],
    ['median_ms_{n}', 'median_ms', null],
    ['median_ms', 'median_ms', true],
    ['median_ms', 'median_ms_256', null],
    ['c{n}_aggregate_tok_s', 'c12_aggregate_tok_s', 12],
    ['c{n}_aggregate_tok_s', 'c12_aggregate_tok_s_p50', null],
  ])('%s against %s', (pattern, metric, want) => {
    expect(captureOf(pattern, metric)).toBe(want);
  });

  test('a gate two battles claim is refused', () => {
    const twice = [...BATTLES, { ...BATTLES[0], id: 'again' }];
    expect(() => battleOf(twice, 'ttft-cold-glm-64k')).toThrow(/claimed by ttft-battle and again/);
    expect(() => sections(ALL_TTFT_WIN, twice)).toThrow(/claimed by/);
  });

  test('CONTROL: one claim reads', () => {
    expect(battleOf(BATTLES, 'ttft-cold-glm-64k').id).toBe('ttft-battle');
    expect(battleOf(BATTLES, 'agentic-webserver-glm')).toBeNull();
  });
});

describe('model blocks', () => {
  test('join a model context section and its battles, and keep a model that has only one of them', () => {
    const blocks = modelBlocks(
      [{ checkpoint: 'b/x' }],
      new Map([
        ['a/y', [{ id: 'ttft-battle' }]],
        ['b/x', [{ id: 'decode-battle' }]],
      ])
    );
    expect(blocks.map((b) => [b.checkpoint, b.context?.checkpoint ?? null, b.battles.map((x) => x.id)])).toEqual([
      ['a/y', null, ['ttft-battle']],
      ['b/x', 'b/x', ['decode-battle']],
    ]);
  });
});
