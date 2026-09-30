// SPDX-License-Identifier: AGPL-3.0-only
//
// ttft-baselines.js — which vLLM TTFT figure is drawn beside which gate.
//
// Every case here uses the COMMITTED gate records and the generated vLLM
// baselines, so the pairings asserted are the ones the page actually draws;
// the refusals take one of those and move a single axis, so each rule is seen
// to bite on an input the real data could produce.
import { describe, expect, test } from 'bun:test';
import { recordsFor } from './gates.js';
import data from './ttft-baselines.generated.json';
import {
  TTFT_AXES,
  baselineValue,
  describeTtftDiffers,
  differsOf,
  gateInstrumentOf,
  modeOf,
  speedup,
  ttftBaselineFor,
} from './ttft-baselines.js';

const DENSE = 'unsloth/Qwen3.8-27B-NVFP4';
const MOE = 'Qwen/Qwen3.6-35B-A3B-FP8';
const clone = (x) => JSON.parse(JSON.stringify(x));
const LONG_32K = '4f961eabd9433e18166e795052b59239760d4e3cc7fa78c258d0bd1b623a1993';

describe('the pairings the page draws', () => {
  // ★ THE HIGH-ISL GATES ARE ONE-SHOT. vLLM's 12-sample gate run of the MoE
  // 32k prompt is a real measurement of the same prompt, and it is still NOT
  // drawn: the gate records one request per run, and the median of 12 is a
  // different statistic. The one-shot pairs are drawn instead, and the page
  // names the refused run with the axis that refused it.
  test('high-isl-ttft-cold-moe pairs with the vLLM one-shot and names the 12-sample run it refused', () => {
    const v = ttftBaselineFor('high-isl-ttft-cold-moe', MOE, recordsFor('high-isl-ttft-cold-moe'), data);
    expect(v.state).toBe('paired');
    expect(v.baseline.method).toBe('one-shot');
    expect(v.baseline.median_ms).toBe(9231.9);
    expect(v.baseline.box).toBe('dgx3 (spark-28c2)');
    expect(v.refused).toHaveLength(1);
    expect(v.refused[0].baseline.method).toBe('gate-run');
    expect(describeTtftDiffers(v.refused[0].differs)).toBe('reps 12 → 1');
  });

  test('the dense high-ISL gates pair with the dense one-shot, the only vLLM 32k figure for that model', () => {
    for (const [gate, ms] of [
      ['high-isl-ttft-cold', 24115.2],
      ['high-isl-ttft-warm', 2132.3],
    ]) {
      const v = ttftBaselineFor(gate, DENSE, recordsFor(gate), data);
      expect(v.state).toBe('paired');
      expect(v.baseline.method).toBe('one-shot');
      expect(baselineValue(v.baseline, 'median')).toBe(ms);
      expect(baselineValue(v.baseline, 'p90')).toBe(ms);
      expect(v.refused).toEqual([]);
    }
  });

  test('the synthetic TTFT gates pair with the 12-sample vLLM gate runs, per statistic', () => {
    const cold = ttftBaselineFor('ttft-cold-gate', MOE, recordsFor('ttft-cold-gate'), data);
    expect(cold.state).toBe('paired');
    expect(cold.baseline.method).toBe('gate-run');
    expect(baselineValue(cold.baseline, 'median')).toBe(318.1);
    expect(baselineValue(cold.baseline, 'p90')).toBe(1100.5);
    expect(cold.gate).toEqual({ prompt: 'lengths:256,1024,4096', osl: '8', mode: 'cold', reps: '12', prompt_tokens: null });
  });

  test('every TTFT gate with records resolves to a stated outcome, never silence', () => {
    const gates = [
      'ttft-cold-gate',
      'ttft-warm-gate',
      'high-isl-ttft-cold',
      'high-isl-ttft-warm',
      'high-isl-ttft-cold-moe',
      'high-isl-ttft-warm-moe',
    ];
    for (const gate of gates) {
      for (const model of new Set(recordsFor(gate).map((r) => r.target_model))) {
        expect(['paired', 'refused', 'not-measured']).toContain(ttftBaselineFor(gate, model, recordsFor(gate), data).state);
      }
    }
  });

  test('the baseline is drawn from the first run on the newest instrument', () => {
    const recs = recordsFor('high-isl-ttft-warm-moe');
    const v = ttftBaselineFor('high-isl-ttft-warm-moe', MOE, recs, data);
    expect(v.from).toBe(recs[0].recorded_at);
    // An older run on another sample count moves `from` past it.
    const older = { ...clone(recs[0]), recorded_at: recs[0].recorded_at - 86400, params: { ...recs[0].params, repeats: '12' } };
    expect(ttftBaselineFor('high-isl-ttft-warm-moe', MOE, [older, ...recs], data).from).toBe(recs[0].recorded_at);
  });
});

describe('refusal on an instrument mismatch', () => {
  const recs = recordsFor('high-isl-ttft-cold-moe');
  const newest = recs[recs.length - 1];
  const withNewest = (mut) => {
    const r = clone(newest);
    mut(r);
    return [...recs.slice(0, -1), r];
  };

  // Each is an edit the engine could make: a re-cut fixture, a longer reply,
  // a gate re-pointed to the other cache state, a return to 12 samples.
  const cases = [
    ['a re-cut prompt fixture', (d) => (d.engine.fixtures['long-32k'] = 'a'.repeat(64)), null, 'prompt'],
    ['a longer reply', (d) => (d.engine.osl = 16), null, 'osl'],
    ['twelve samples per run', null, (r) => (r.params.repeats = '12'), 'reps'],
    ['a different token count', null, (r) => (r.metrics.prompt_tokens = 32768), 'prompt_tokens'],
  ];
  for (const [what, mutData, mutRecord, axis] of cases) {
    test(`${what} refuses both vLLM figures and names ${axis}`, () => {
      const d = clone(data);
      if (mutData) mutData(d);
      const v = ttftBaselineFor('high-isl-ttft-cold-moe', MOE, mutRecord ? withNewest(mutRecord) : recs, d);
      // `reps 12` pairs the 12-sample run instead; every other move refuses both.
      if (axis === 'reps') {
        expect(v.state).toBe('paired');
        expect(v.baseline.method).toBe('gate-run');
        expect(describeTtftDiffers(v.refused[0].differs)).toBe('reps 1 → 12');
        return;
      }
      expect(v.state).toBe('refused');
      expect(v.refused).toHaveLength(2);
      for (const r of v.refused) expect(r.differs.map((x) => x.axis)).toContain(axis);
    });
  }

  test('a prompt the engine checkout does not hold is named, and matches nothing', () => {
    const d = clone(data);
    delete d.engine.fixtures['long-32k'];
    const v = ttftBaselineFor('high-isl-ttft-cold-moe', MOE, recs, d);
    expect(v.state).toBe('refused');
    expect(v.gate.prompt).toBe('fixture:long-32k (not in the engine checkout)');
  });

  test('the other cache state is never paired: a warm figure is not a cold one', () => {
    const d = clone(data);
    for (const m of d.manifests) for (const b of m.baselines) if (b.gate === 'high-isl-ttft-cold-moe') b.instrument.mode = 'warm';
    const v = ttftBaselineFor('high-isl-ttft-cold-moe', MOE, recs, d);
    expect(v.state).toBe('refused');
    expect(v.refused.every((r) => describeTtftDiffers(r.differs).includes('mode warm → cold'))).toBe(true);
  });

  test('an undeclared axis on either side is a difference, never a match', () => {
    for (const axis of TTFT_AXES) {
      const gate = { prompt: 'p', osl: '8', mode: 'cold', reps: '1' };
      expect(differsOf({ ...gate, [axis]: null }, gate).map((d) => d.axis)).toEqual([axis]);
      expect(differsOf(gate, { ...gate, [axis]: undefined }).map((d) => d.axis)).toEqual([axis]);
    }
    // prompt_tokens is compared only when both report it.
    const full = { prompt: 'p', osl: '8', mode: 'cold', reps: '1' };
    expect(differsOf({ ...full, prompt_tokens: '5' }, full)).toEqual([]);
  });

  test('two baselines matching one gate is a data error, not a choice', () => {
    const d = clone(data);
    const m = d.manifests.find((x) => x.checkpoint === MOE);
    m.baselines.push({ ...clone(m.baselines.find((b) => b.id === 'oneshot-high-isl-ttft-cold-moe')), id: 'twin' });
    expect(() => ttftBaselineFor('high-isl-ttft-cold-moe', MOE, recs, d)).toThrow(/exactly one/);
  });
});

describe('not measured', () => {
  test('a model with no vLLM TTFT manifest says so', () => {
    const d = clone(data);
    d.manifests = d.manifests.filter((m) => m.checkpoint !== DENSE);
    const v = ttftBaselineFor('high-isl-ttft-cold', DENSE, recordsFor('high-isl-ttft-cold'), d);
    expect(v.state).toBe('not-measured');
    expect(v.reason).toBe(`No vLLM TTFT manifest exists for ${DENSE} under bench/baselines/.`);
  });

  // The dense manifest's own words on why it has no 32k gate run ride along.
  test('a manifest with no run of this gate says which manifest, with its own note', () => {
    const d = clone(data);
    const m = d.manifests.find((x) => x.checkpoint === DENSE);
    m.baselines = m.baselines.filter((b) => b.gate !== 'high-isl-ttft-cold');
    const v = ttftBaselineFor('high-isl-ttft-cold', DENSE, recordsFor('high-isl-ttft-cold'), d);
    expect(v.state).toBe('not-measured');
    expect(v.reason).toStartWith('bench/baselines/qwen38-27b/ttft/published.json holds no vLLM run of high-isl-ttft-cold.');
    expect(v.reason).toContain('The 32k baseline for this subject is `oneshot`.');
  });

  test('no records for the model is its own state, not a vLLM verdict', () => {
    expect(ttftBaselineFor('ttft-cold-gate', DENSE, recordsFor('ttft-cold-gate'), data).state).toBe('no-records');
  });
});

describe('the helpers', () => {
  test('modeOf reads the gate id and refuses one without a mode', () => {
    expect(modeOf('high-isl-ttft-warm-moe')).toBe('warm');
    expect(modeOf('ttft-cold-gate')).toBe('cold');
    expect(() => modeOf('decode-floor')).toThrow(/neither cold nor warm/);
  });

  test('the gate instrument hashes the named fixture through the engine data', () => {
    const r = recordsFor('high-isl-ttft-warm')[0];
    expect(gateInstrumentOf(r, data.engine)).toEqual({
      prompt: `sha256:${LONG_32K}`,
      osl: '8',
      mode: 'warm',
      reps: '1',
      prompt_tokens: '32772',
    });
  });

  test('speedup reads lower-is-better both ways, and refuses a non-positive time', () => {
    expect(speedup(100, 261)).toBe('2.61x faster');
    expect(speedup(140, 100)).toBe('1.40x slower');
    expect(speedup(100, 100)).toBe('1.00x faster');
    expect(speedup(0, 100)).toBeNull();
    expect(speedup(undefined, 100)).toBeNull();
  });

  test('baselineValue refuses a statistic the tabs do not offer', () => {
    const b = data.manifests[0].baselines[0];
    expect(() => baselineValue(b, 'p99')).toThrow(/unknown statistic/);
  });
});
