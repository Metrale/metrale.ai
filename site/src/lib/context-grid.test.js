// SPDX-License-Identifier: AGPL-3.0-only
//
// The model sections of the benchmarks page (context-grid.js). Every rule that
// decides whether a number appears has a control on the other side: a section
// exists only with a vLLM figure AND a record of that checkpoint, a cell with
// no record is never a number, and "ahead of vLLM" reads in the direction the
// gate's own limit says is better.
import { describe, expect, test } from 'bun:test';
import { unitOf } from './battle-grid.js';
import { againstTarget, contextSections, limitText, metricLabel, withUnit } from './context-grid.js';
import { contextLabel } from './reference-serve.js';
import { declaredLimit, limitFor, violationOf } from './gate-limits.js';
import { benchesOf, familyOf, kindOf, panelsFor } from './gates.js';

const GLM = 'org/GLM-Flash';
const QWEN = 'org/Qwen-Dense';
const TARGETS = { median_ms_256: 488, median_ms_1024: 679 };

// The shape gen-gates.mjs writes, for a model gated at three contexts and one
// that declares no vLLM figure.
const CONTEXT = {
  'ttft-cold-glm-64k': { [GLM]: { model: 'glm', label: null, max_model_len: 65536, targets: TARGETS } },
  'ttft-cold-glm-512k': { [GLM]: { model: 'glm', label: null, max_model_len: 524288, targets: { median_ms_256: 488 } } },
  'ttft-cold-glm-256k': { [GLM]: { model: 'glm', label: null, max_model_len: 262144, targets: TARGETS } },
  'agentic-webserver-glm': { [GLM]: { model: 'glm', label: null, max_model_len: 524288, targets: {} } },
  'ttft-cold-gate': { [QWEN]: { model: 'qwen', label: null, max_model_len: 4096, targets: {} } },
};
const series = (value) => [{ since: 1, value }];
const LIMITS = {
  'ttft-cold-glm-64k': { [GLM]: { median_ms_256: { max: series(449) }, median_ms_1024: { max: series(684.9) } } },
  // The 512k entry gates only the 256-token prompt: the 1024 column is "not gated" in its row.
  'ttft-cold-glm-512k': { [GLM]: { median_ms_256: { max: series(450.9) } } },
  'ttft-cold-glm-256k': { [GLM]: { median_ms_256: { max: series(441.4) }, median_ms_1024: { max: series(687.2) } } },
  'agentic-webserver-glm': { [GLM]: { webserver_ok: { min: series(10) }, s_per_turn: { max: series(4.274) } } },
  'ttft-cold-gate': { [QWEN]: { median_ms: { max: series(500) } } },
};
const rec = (gate, model, metrics, recorded_at = 100) => ({ benchmark_id: gate, target_model: model, recorded_at, metrics });

function sectionsFor(records) {
  return contextSections({
    context: CONTEXT,
    limits: LIMITS,
    recordsFor: (gate) => records.filter((r) => r.benchmark_id === gate),
    limitFor: (r, m) => limitFor(r, m, LIMITS),
    declaredLimit: (g, c, m, at) => declaredLimit(LIMITS, g, c, m, at),
    kindOf,
    violationOf,
  });
}

describe('when a model section exists', () => {
  test('no record of the model: no section, so no declared number reads as a result', () => {
    expect(sectionsFor([])).toEqual([]);
  });

  test('CONTROL: one record of the model is enough to show its whole grid', () => {
    const [s] = sectionsFor([rec('ttft-cold-glm-64k', GLM, { median_ms_256: 420.7, median_ms_1024: 667.2 })]);
    expect(s.checkpoint).toBe(GLM);
    expect(s.tables.map((t) => t.label)).toEqual(['TTFT · cold', 'Agentic']);
  });

  test('a record of ANOTHER checkpoint on the same gate does not show the model', () => {
    expect(sectionsFor([rec('ttft-cold-glm-64k', QWEN, { median_ms_256: 1 })])).toEqual([]);
  });

  test('a model that declares no vLLM figure gets no section, even with records', () => {
    const got = sectionsFor([rec('ttft-cold-gate', QWEN, { median_ms: 300 })]);
    expect(got).toEqual([]);
  });
});

describe('the grid', () => {
  const [section] = sectionsFor([
    rec('ttft-cold-glm-64k', GLM, { median_ms_256: 420.7, median_ms_1024: 700 }),
    rec('ttft-cold-glm-512k', GLM, { median_ms_256: 460 }),
  ]);
  const ttft = section.tables[0];

  test('rows run by context, columns by prompt length in numeric order', () => {
    expect(ttft.rows.map((r) => r.context)).toEqual([65536, 262144, 524288]);
    expect(ttft.metrics).toEqual(['median_ms_256', 'median_ms_1024']);
  });

  test('a gate with no record is "no record", never a number, and still shows its limit and vLLM figure', () => {
    const [cell] = ttft.rows[1].cells;
    expect(cell).toMatchObject({ state: 'no-record', value: null, limit: { min: null, max: 441.4 }, target: 488 });
  });

  test('a metric the row\'s own entry does not gate is "not gated"', () => {
    expect(ttft.rows[2].cells[1]).toEqual({ metric: 'median_ms_1024', state: 'not-gated' });
  });

  test('a measured cell carries its limit, the vLLM figure, the side it is on and a breach', () => {
    const [ahead, behind] = ttft.rows[0].cells;
    expect(ahead).toMatchObject({ state: 'measured', value: 420.7, target: 488, violation: null });
    expect(ahead.versus.side).toBe('ahead');
    expect(behind.versus.side).toBe('behind');
    expect(behind.violation).toBe('ceiling');
  });

  test('a record that lacks a gated metric says so instead of drawing zero', () => {
    const [s] = sectionsFor([rec('ttft-cold-glm-64k', GLM, { median_ms_256: 400 })]);
    expect(s.tables[0].rows[0].cells[1]).toMatchObject({ state: 'not-reported', value: null, violation: null });
  });

  test('the newest record of the checkpoint is the one shown', () => {
    const [s] = sectionsFor([
      rec('ttft-cold-glm-64k', GLM, { median_ms_256: 400 }, 100),
      rec('ttft-cold-glm-64k', GLM, { median_ms_256: 430 }, 200),
    ]);
    expect(s.tables[0].rows[0].cells[0].value).toBe(430);
  });
});

describe('against the vLLM figure', () => {
  const ceiling = { min: null, max: 1 };
  const floor = { min: 1, max: null };
  test('under a ceiling, lower is ahead; under a floor, higher is ahead', () => {
    expect(againstTarget(400, 488, ceiling).side).toBe('ahead');
    expect(againstTarget(500, 488, ceiling).side).toBe('behind');
    expect(againstTarget(500, 488, floor).side).toBe('ahead');
    expect(againstTarget(400, 488, floor).side).toBe('behind');
    expect(againstTarget(488, 488, ceiling).side).toBe('level');
  });
  test('no limit means no direction, and a missing figure means no comparison', () => {
    expect(againstTarget(400, 488, { min: null, max: null })).toBeNull();
    expect(againstTarget(400, null, ceiling)).toBeNull();
    expect(againstTarget(null, 488, ceiling)).toBeNull();
  });
  test('the percentage is against the vLLM figure', () => {
    expect(againstTarget(366, 488, ceiling).pct).toBeCloseTo(-25, 9);
  });
});

describe('model-owned gate ids join their family', () => {
  test('each GLM gate id lands on its family tab and mode', () => {
    expect(familyOf('ttft-cold-glm-64k')).toBe('ttft');
    expect(familyOf('high-isl-ttft-warm-glm-512k')).toBe('ttft-long');
    expect(familyOf('agentic-webserver-glm')).toBe('agentic');
    expect(kindOf('ttft-warm-glm-256k')).toEqual({ key: 'ttft:warm', label: 'TTFT · warm' });
    expect(kindOf('high-isl-ttft-cold-glm-64k')).toEqual({ key: 'ttft-long:cold', label: 'High-ISL TTFT · cold' });
  });
  test('CONTROL: an id no family rule admits stays off every tab', () => {
    expect(familyOf('kat-equality-gate')).toBeNull();
    expect(familyOf('pre-ttft-cold-gate')).toBeNull();
    expect(kindOf('kat-equality-gate')).toBeNull();
  });
  test('a model-owned agentic gate gets the agentic panels, not the unknown-bench fallback', () => {
    const r = rec('agentic-webserver-glm', GLM, { decode_tps: 50, sum_wall_s: 425.14, webserver_ok: 10, iterations: 10 });
    expect(panelsFor('agentic-webserver-glm', [r]).map((p) => p.title)).toEqual(['Σ wall time', 'webserver_ok per run']);
  });
});

describe('labels', () => {
  test('contexts read as people say them, metrics by prompt length and unit', () => {
    expect(contextLabel(65536)).toBe('64k');
    expect(contextLabel(524288)).toBe('512k');
    expect(contextLabel(40000)).toBe('40000');
    expect(metricLabel('median_ms_4096')).toBe('4096-token prompt');
    expect(metricLabel('s_per_turn')).toBe('s per turn');
    expect([unitOf('median_ms_256'), unitOf('sum_wall_s'), unitOf('s_per_turn'), unitOf('webserver_ok')]).toEqual(['ms', 's', 's', '']);
  });

  test('a throughput is tok/s and its rung reads C=n, never a seconds figure', () => {
    expect(unitOf('c1_aggregate_tok_s')).toBe('tok/s');
    expect(withUnit(43.2, 'c1_aggregate_tok_s')).toBe('43.2 tok/s');
    expect(metricLabel('c1_aggregate_tok_s')).toBe('C=1');
    expect(metricLabel('c16_j_per_tok')).toBe('C=16 j per tok');
    expect(limitText({ min: 40, max: null }, 'c1_aggregate_tok_s')).toBe('≥ 40 tok/s');
    expect(limitText({ min: null, max: 449 }, 'median_ms_256')).toBe('≤ 449 ms');
    expect(limitText({ min: null, max: null }, 'median_ms_256')).toBe('');
  });
});

describe('a tab holds every id its rule admits', () => {
  const rule = { id: 'ttft', label: 'TTFT', member: /^ttft-(cold|warm)-/, order: ['ttft-warm-gate', 'ttft-cold-gate'] };
  test('ordered ids first, as listed, then every other member sorted; non-members stay out', () => {
    const known = ['ttft-cold-glm-64k', 'decode-floor', 'ttft-cold-gate', 'ttft-warm-glm-64k', 'ttft-cold-glm-256k'];
    expect(benchesOf(rule, known)).toEqual([
      'ttft-warm-gate',
      'ttft-cold-gate',
      'ttft-cold-glm-256k',
      'ttft-cold-glm-64k',
      'ttft-warm-glm-64k',
    ]);
  });
  test('an ordered id its own rule does not admit fails the build', () => {
    expect(() => benchesOf({ ...rule, order: ['ttft-warm-gate', 'decode-floor'] }, [])).toThrow(/decode-floor/);
  });
});
