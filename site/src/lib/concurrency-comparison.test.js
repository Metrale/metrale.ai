// SPDX-License-Identifier: AGPL-3.0-only
//
// The comparison decisions, pure: which state a subject tab is in, which
// one-shot baselines may be drawn against a gate record, and what the tile
// beside "vLLM baseline" says. The rendered checks live in
// concurrency-tab.test.js; these prove the rules on inputs the call sites
// produce, including the refusal that keeps a ladder-instrument vLLM leg off
// a gate-instrument axis.
import { describe, expect, test } from 'bun:test';
import ladders from './ladders.generated.json';
import subjects from './concurrency-subjects.json';
import { vllmOnlyLadder } from '../../test-stubs/moe-vllm-only-ladder.js';
import {
  absentReasonOf,
  baselineOnlyFor,
  baselineSeriesOf,
  baselineTileOf,
  comparisonStateOf,
  fingerprintOf,
  ladderFor,
  oneShotChip,
  pairWith,
  publishedBeyondLive,
  publishedExtensionOf,
  publishedFor,
} from './concurrency-comparison.js';
import { recordsFor } from './gates.js';

const byId = (id) => subjects.find((s) => s.id === id);
const DENSE = byId('qwen38-27b');
const MOE = byId('qwen36-35b-a3b');
const DFLASH = byId('qwen38-27b-dflash');
// The baseline-only shape these rules are written against: the MoE vLLM
// manifest alone (test-stubs/moe-vllm-only-ladder.js). The real MoE ladder is
// a scored pair since 2026-09-29, and is asserted as one below.
const moe = vllmOnlyLadder;
const vllm = moe.series.find((s) => s.id === 'vllm-mtp');

// A passing main-branch gate record on the gate instrument, string-valued as
// the harness records it.
const gate = (over = {}) => ({
  benchmark_id: MOE.gate,
  target_model: MOE.checkpoint,
  git_sha: 'feedfacede',
  recorded_at: 1_800_000_000,
  verdict: 'PASS',
  branch: '',
  params: { concurrencies: '1, 2, 4', isls: '512', osl: '320', prompt_mode: 'natural' },
  serve_overrides: { max_batch_size: '128', kv_cache_dtype: 'fp8', max_model_len: '4096' },
  metrics: { c1_aggregate_tok_s: 10, c2_aggregate_tok_s: 20, c4_aggregate_tok_s: 40 },
  ...over,
});
const ON_GATE = { isl: 512, osl: 320, prompt_mode: 'natural', max_model_len: 4096, max_batch_size: 128, kv_cache_dtype: 'fp8' };
const withInstrument = (instrument) => ({ ...moe, series: [{ ...vllm, instrument }] });
const laddersWith = (ladder) => ({ subjects: { ...ladders.subjects, [MOE.id]: ladder } });
// Every committed ladder, with the MoE's as the vLLM manifest alone would build it.
const baseOnly = laddersWith(moe);

describe('which ladder a subject gets', () => {
  test('its own, only for its checkpoint; none when it declares no manifest', () => {
    expect(ladderFor(MOE, ladders)).toBe(ladders.subjects[MOE.id]);
    expect(ladderFor(MOE, baseOnly)).toBe(moe);
    expect(ladderFor(DFLASH, ladders)).toBeNull();
    expect(ladderFor({ ...MOE, checkpoint: DENSE.checkpoint }, ladders)).toBeNull();
    expect(ladderFor({ ...MOE, published_manifest: null }, ladders)).toBeNull();
    expect(ladderFor({ ...MOE, id: 'other' }, ladders)).toBeNull();
  });

  test('a pair and a baseline-only ladder are told apart by the subject series, not by name', () => {
    expect(publishedFor(DENSE, ladders)).toBe(ladders.subjects[DENSE.id]);
    expect(baselineOnlyFor(DENSE, ladders)).toBeNull();
    expect(publishedFor(MOE, ladders)).toBe(ladders.subjects[MOE.id]);
    expect(baselineOnlyFor(MOE, ladders)).toBeNull();
    expect(publishedFor(MOE, baseOnly)).toBeNull();
    expect(baselineOnlyFor(MOE, baseOnly)).toBe(moe);
    const promoted = { ...moe, series: [...moe.series, { id: 'metrale', role: 'subject', rungs: [] }] };
    expect(publishedFor(MOE, laddersWith(promoted))).toBe(promoted);
    expect(baselineOnlyFor(MOE, laddersWith(promoted))).toBeNull();
  });
});

describe('the state, in precedence order', () => {
  test('live-when-it-pairs > published > live > baseline > none', () => {
    // DENSE has a published pair AND this record is on the RETIRED gate
    // instrument, so nothing pairs and the frozen pair is still the best
    // thing to draw. The case where it DOES pair is the describe below.
    expect(comparisonStateOf(DENSE, [gate({ target_model: DENSE.checkpoint })], ladders)).toBe('published');
    expect(comparisonStateOf(MOE, [], baseOnly)).toBe('baseline');
    expect(comparisonStateOf(MOE, [gate()], baseOnly)).toBe('live');
    expect(comparisonStateOf(MOE, [gate({ verdict: 'FAIL' })], baseOnly)).toBe('baseline');
    expect(comparisonStateOf(MOE, [gate({ branch: 'pr/x' })], baseOnly)).toBe('baseline');
    // The committed MoE ladder is a pair: with no live record, or one that
    // pairs with nothing, it is what the tab draws.
    expect(comparisonStateOf(MOE, [], ladders)).toBe('published');
    expect(comparisonStateOf(MOE, [gate()], ladders)).toBe('published');
    expect(comparisonStateOf(DFLASH, [], ladders)).toBe('none');
    expect(comparisonStateOf({ ...MOE, published_manifest: null }, [], ladders)).toBe('none');
  });
});

describe('pairing a one-shot with a gate record', () => {
  test('THE REFUSAL: the MoE one-shot is on the ladder instrument and is never drawn against a gate record', () => {
    const { drawn, refused } = pairWith(gate(), moe);
    expect(drawn).toEqual([]);
    expect(refused).toHaveLength(1);
    expect(refused[0].series).toBe(vllm);
    expect(refused[0].differs).toEqual([
      { axis: 'isl', a: '512', b: '128' },
      { axis: 'osl', a: '320', b: '1024' },
      { axis: 'prompt_mode', a: 'natural', b: 'essay' },
      { axis: 'max_model_len', a: '4096', b: '2048' },
      { axis: 'kv_cache_dtype', a: 'fp8', b: 'bf16' },
    ]);
    expect(refused[0].why).toBe(
      'isl 512 → 128, osl 320 → 1024, prompt_mode natural → essay, max_model_len 4096 → 2048, kv_cache_dtype fp8 → bf16'
    );
  });

  test('POSITIVE CONTROL: a one-shot fingerprinted on the gate axes is drawn, one-sided axes ignored', () => {
    const { drawn, refused } = pairWith(gate(), withInstrument(ON_GATE));
    expect(refused).toEqual([]);
    expect(drawn.map((b) => b.id)).toEqual(['vllm-mtp']);
    // A gate record axis the baseline never declared (ssm_cache_slots) is no mismatch.
    const withSlots = gate({
      serve_overrides: { max_batch_size: '128', kv_cache_dtype: 'fp8', max_model_len: '4096', ssm_cache_slots: '32' },
    });
    expect(pairWith(withSlots, withInstrument(ON_GATE)).drawn).toHaveLength(1);
  });

  test('one axis off is a refusal that names that axis', () => {
    const { drawn, refused } = pairWith(gate(), withInstrument({ ...ON_GATE, kv_cache_dtype: 'bf16' }));
    expect(drawn).toEqual([]);
    expect(refused[0].why).toBe('kv_cache_dtype fp8 → bf16');
  });

  test('the checkpoint is part of the fingerprint, read from the ladder', () => {
    expect(fingerprintOf(moe, vllm)).toEqual({ checkpoint: MOE.checkpoint, instrument: vllm.instrument });
    const other = pairWith(gate({ target_model: DENSE.checkpoint }), withInstrument(ON_GATE));
    expect(other.drawn).toEqual([]);
    expect(other.refused[0].why).toBe(`checkpoint ${DENSE.checkpoint} → ${MOE.checkpoint}`);
  });
});

describe('the tile follows the chart', () => {
  test('pair, dated one-shot, other instrument, none', () => {
    expect(baselineTileOf(DENSE, [], ladders)).toBe('published pair');
    expect(baselineTileOf(MOE, [], baseOnly)).toBe('one-shot · 2026-09-19');
    expect(baselineTileOf(MOE, [gate()], baseOnly)).toBe('other instrument');
    expect(baselineTileOf(MOE, [], ladders)).toBe('published pair');
    expect(baselineTileOf(MOE, [gate()], laddersWith(withInstrument(ON_GATE)))).toBe('one-shot · 2026-09-19');
    expect(baselineTileOf(DFLASH, [], ladders)).toBe('none');
    expect(baselineTileOf(DFLASH, [gate({ benchmark_id: DFLASH.gate, target_model: DFLASH.checkpoint })], ladders)).toBe('none');
  });
});

describe('what the page says about a rung with no point', () => {
  test('the recorded reason for a listed rung; the plain fact for any other', () => {
    expect(absentReasonOf(moe, 64)).toBe(`C=64 · not measured — ${vllm.unmeasured.reason}`);
    expect(absentReasonOf(moe, 3)).toBe('C=3 · not in this manifest: neither measured nor listed as unmeasured');
    const noList = withInstrument(vllm.instrument);
    delete noList.series[0].unmeasured;
    expect(absentReasonOf(noList, 64)).toBe('C=64 · not in this manifest: neither measured nor listed as unmeasured');
  });

  test('the one-shot chip is dated from the rungs', () => {
    expect(oneShotChip(vllm)).toBe('vLLM + MTP · one-shot · measured 2026-09-19 · not re-run');
    const twoDays = { ...vllm, rungs: [{ measured_utc: '2026-09-19T22:25:43Z' }, { measured_utc: '2026-09-20T01:00:00Z' }] };
    expect(oneShotChip(twoDays)).toBe('vLLM + MTP · one-shot · measured 2026-09-19 → 2026-09-20 · not re-run');
  });
});

// ── the live Metrale Engine leg outranks the frozen published pair ───────────────────
//
// Ask, 2026-09-21: "the first chart shows metrale vs vllm; we MUST make that
// graph show the latest values of Metrale Engine ... the bottom graph needs to be the
// same test as the top one". Two changes make that true and BOTH are load-
// bearing, so both are controlled here:
//   * kernels/gb10/qwen3.8-27b/BENCH.toml re-points the gate to the published
//     ladder's instrument (isl 128 / osl 1024 / essay / ctx 2048), and
//     bench/ladder38/published.json declares the prompt_mode those vLLM legs
//     ran, without which a REQUIRED axis is undeclared and nothing can pair;
//   * comparisonStateOf prefers a live record that pairs over the snapshot.
// Remove either and these tests go red — proved by mutation, not assumed.
describe('a live record that pairs outranks the published pair', () => {
  const dense = ladders.subjects[DENSE.id];
  // The instrument BENCH.toml pins after the re-point, as a record carries it
  // (strings; threshold params present because a real record carries them and
  // THRESHOLD_PARAM must keep excluding them from the fingerprint).
  const repointed = (over = {}) => ({
    ...gate({ target_model: DENSE.checkpoint }),
    params: {
      concurrencies: '1, 2, 4, 8, 16, 32, 64, 128',
      isls: '128',
      osl: '1024',
      prompt_mode: 'essay',
      warmup: '1',
      min_c1: '0',
      min_peak: '0',
    },
    serve_overrides: {
      max_batch_size: '128',
      kv_cache_dtype: 'fp8',
      ssm_cache_slots: '32',
      max_model_len: '2048',
    },
    ...over,
  });

  // ★ THE SHAPE THE GATE ACTUALLY EMITS, asserted separately from `repointed()`.
  // That fixture still declares `ssm_cache_slots: '32'`, which the gate pinned
  // when it was written. On 2026-09-22 the entry was re-pointed at the
  // THROUGHPUT recipe and its serve_overrides went from seventeen pins to
  // three — max_batch_size, kv_cache_dtype and max_model_len, which survive
  // only because ladder-baselines builds a record's fingerprint from
  // `params` + `serve_overrides` and those three are REQUIRED_AXES. Everything
  // else, ssm_cache_slots included, is now inherited from the recipe and never
  // reaches the record's override map.
  //
  // So this asserts the pairing on the map the live gate will really produce.
  // It is not a duplicate of the test below: that one would keep passing if the
  // pin set changed underneath it, because `comparable()` skips a non-required
  // axis unless BOTH sides declare it — which is exactly why dropping pins is
  // safe, and exactly why nothing would have failed if it were not.
  const asShipped = (over = {}) => ({
    ...repointed(),
    serve_overrides: {
      max_batch_size: '128',
      kv_cache_dtype: 'fp8',
      max_model_len: '2048',
    },
    ...over,
  });

  test('the three-pin record the gate emits still pairs, so the top chart goes live on merge', () => {
    expect(comparisonStateOf(DENSE, [asShipped()], ladders)).toBe('live');
    const { drawn, refused } = pairWith(asShipped(), dense);
    // Drawn against the MATCHED vLLM leg, exactly as the seventeen-pin record
    // was. The no-speculation leg stays refused for the reason it always was —
    // a different context and KV dtype — and NOT because pins were dropped;
    // asserting the reason string is what separates those two explanations.
    expect(drawn.map((d) => d.id)).toEqual(['vllm-mtp']);
    expect(refused.map((r) => r.series.id)).toEqual(['vllm-nospec']);
    expect(refused[0].why).toBe('max_model_len 2048 → 4096, kv_cache_dtype fp8 → bf16');
  });

  test('a REQUIRED axis dropped from the pins refuses the pair rather than drawing it', () => {
    // The control for the test above: the three pins are not decoration. Drop
    // one and the axis reads null, null counts as a difference on a required
    // axis, and the tab must fall back rather than draw an incomparable curve.
    const { max_model_len, ...withoutCtx } = asShipped().serve_overrides;
    const crippled = asShipped({ serve_overrides: withoutCtx });
    expect(pairWith(crippled, dense).drawn).toEqual([]);
    expect(comparisonStateOf(DENSE, [crippled], ladders)).not.toBe('live');
  });

  test('THE ASK: a record on the published instrument makes the dense tab live, drawn against vllm-mtp', () => {
    expect(comparisonStateOf(DENSE, [repointed()], ladders)).toBe('live');
    const { drawn, refused } = pairWith(repointed(), dense);
    expect(drawn.map((d) => d.id)).toEqual(['vllm-mtp']);
    // The no-speculation leg is NOT quietly folded in: it is a different
    // context and a different KV dtype, and it says so.
    expect(refused.map((r) => r.series.id)).toEqual(['vllm-nospec']);
    expect(refused[0].why).toBe('max_model_len 2048 → 4096, kv_cache_dtype fp8 → bf16');
    // and the tile stops saying "published pair" and dates the leg it draws
    expect(baselineTileOf(DENSE, [repointed()], ladders)).toBe('one-shot · 2026-08-17 → 2026-08-18');
    expect(baselineTileOf(DENSE, [gate({ target_model: DENSE.checkpoint })], ladders)).toBe('published pair');
  });

  test('the fallback is not a formality: each axis alone sends it back to the snapshot', () => {
    // One axis at a time, each the value the retired instrument had. Every one
    // of these is a real mutation of the BENCH.toml change, and every one must
    // cost the live series — otherwise "same test top and bottom" is unproved.
    const off = (params, serve) =>
      comparisonStateOf(
        DENSE,
        [repointed({ params: { ...repointed().params, ...params }, serve_overrides: { ...repointed().serve_overrides, ...serve } })],
        ladders
      );
    expect(off({ isls: '512' }, {})).toBe('published');
    expect(off({ osl: '320' }, {})).toBe('published');
    expect(off({ prompt_mode: 'natural' }, {})).toBe('published');
    expect(off({}, { max_model_len: '4096' })).toBe('published');
    expect(off({}, { max_batch_size: '32' })).toBe('published');
    expect(off({}, { kv_cache_dtype: 'bf16' })).toBe('published');
  });

  test('an UNDECLARED prompt_mode on the manifest is a difference, not a match', () => {
    // The control for the published.json half of the change: strip the axis
    // the manifest now declares and the pair is refused again, naming it.
    const { prompt_mode: _drop, ...noMode } = dense.series.find((b) => b.id === 'vllm-mtp').instrument;
    const stripped = {
      ...dense,
      series: dense.series.map((b) => (b.id === 'vllm-mtp' ? { ...b, instrument: noMode } : b)),
    };
    const { drawn, refused } = pairWith(repointed(), stripped);
    expect(drawn).toEqual([]);
    expect(refused.find((r) => r.series.id === 'vllm-mtp').why).toContain('prompt_mode essay → undeclared');
    expect(comparisonStateOf(DENSE, [repointed()], { subjects: { ...ladders.subjects, [DENSE.id]: stripped } })).toBe('published');
  });

  test('a cost-scoped energy leg cannot make the concurrency tab live', () => {
    // The vLLM energy leg is measured on EXACTLY the published
    // instrument, so `comparable()` pairs it happily. If it counted, this tab
    // would report 'live' and then render nothing -- every concurrency
    // component filters `scope: 'cost'` back out at draw time. The published
    // ladder already carries it, so this asserts against the real manifest
    // rather than a fixture: it must be absent from `drawn` and from `refused`
    // alike, because it was never a candidate.
    const energy = dense.series.find((b) => b.id === 'vllm-mtp-energy');
    expect(energy?.scope).toBe('cost');
    const { drawn, refused } = pairWith(repointed(), dense);
    expect([...drawn, ...refused.map((r) => r.series)].map((b) => b.id)).not.toContain('vllm-mtp-energy');
    // and the same leg IS still visible to the reader that wants it
    expect(baselineSeriesOf(dense).map((b) => b.id)).toContain('vllm-mtp-energy');
  });

  test('a paired record that is not eligible to be live does not win — the live rules still apply first', () => {
    expect(comparisonStateOf(DENSE, [repointed({ verdict: 'FAIL' })], ladders)).toBe('published');
    expect(comparisonStateOf(DENSE, [repointed({ branch: 'pr/x' })], ladders)).toBe('published');
    // newest passing wins, so a retired-instrument record AFTER a re-pointed
    // one takes the tab back to the snapshot rather than drawing a stale pair
    expect(comparisonStateOf(DENSE, [repointed(), gate({ target_model: DENSE.checkpoint })], ladders)).toBe('published');
    expect(comparisonStateOf(DENSE, [gate({ target_model: DENSE.checkpoint }), repointed()], ladders)).toBe('live');
  });
});

// ── the published pair beside a gate that stops short of it ─────────────────
describe('publishedBeyondLive', () => {
  const moeRecords = recordsFor(MOE.gate).filter((r) => r.target_model === MOE.checkpoint);
  const denseRecords = recordsFor(DENSE.gate).filter((r) => r.target_model === DENSE.checkpoint);

  test('the MoE: a live gate run to C=16, and the published ladder to C=128, so C=32/64/128 are beyond it', () => {
    expect(comparisonStateOf(MOE, moeRecords, ladders)).toBe('live');
    const beyond = publishedBeyondLive(MOE, moeRecords, ladders);
    expect(beyond.rungs).toEqual([32, 64, 128]);
    expect(beyond.ladder).toBe(ladders.subjects[MOE.id]);
  });

  test('nothing when the gate covers every published rung (the dense ladder)', () => {
    expect(comparisonStateOf(DENSE, denseRecords, ladders)).toBe('live');
    expect(publishedBeyondLive(DENSE, denseRecords, ladders)).toBeNull();
  });

  test('nothing when the tab already draws the published pair, or has none to draw', () => {
    expect(publishedBeyondLive(MOE, [], ladders)).toBeNull(); // state 'published'
    expect(publishedBeyondLive(MOE, moeRecords, baseOnly)).toBeNull(); // a baseline-only ladder
    expect(publishedBeyondLive(DFLASH, recordsFor(DFLASH.gate), ladders)).toBeNull();
  });
});

describe('publishedExtensionOf', () => {
  const moeRecords = recordsFor(MOE.gate).filter((r) => r.target_model === MOE.checkpoint);
  const denseRecords = recordsFor(DENSE.gate).filter((r) => r.target_model === DENSE.checkpoint);
  const moeLadder = ladders.subjects[MOE.id];
  const subjectLeg = moeLadder.series.find((s) => s.role === 'subject');
  const withSubject = (over) =>
    laddersWith({ ...moeLadder, series: moeLadder.series.map((s) => (s.role === 'subject' ? { ...s, ...over } : s)) });

  test('the MoE: the published leg carries the live chart on from C=16 to C=128', () => {
    const ext = publishedExtensionOf(MOE, moeRecords, ladders);
    expect(ext.series).toBe(subjectLeg);
    expect(ext.rungs.map((r) => r.c)).toEqual([32, 64, 128]);
    expect(ext.rungs).toEqual(subjectLeg.rungs.filter((r) => r.c > 16));
  });

  test('nothing when the gate already reaches every rung, or there is no live pair', () => {
    expect(publishedExtensionOf(DENSE, denseRecords, ladders)).toBeNull();
    expect(publishedExtensionOf(MOE, [], ladders)).toBeNull();
    expect(publishedExtensionOf(MOE, moeRecords, baseOnly)).toBeNull();
  });

  test.each([
    ['kv_cache_dtype', 'fp8'],
    ['max_batch_size', 64],
    ['prompt_mode', 'natural'],
  ])('refused when the published leg declares another %s than the live record', (axis, v) => {
    expect(publishedExtensionOf(MOE, moeRecords, withSubject({ instrument: { ...subjectLeg.instrument, [axis]: v } }))).toBeNull();
    // control: the same ladder with the leg's own instrument extends
    expect(publishedExtensionOf(MOE, moeRecords, withSubject({ instrument: { ...subjectLeg.instrument } }))).not.toBeNull();
  });

  test('only rungs wider than the gate: a gate reaching C=32 leaves C=64/128', () => {
    const last = moeRecords.filter((r) => r.verdict === 'PASS' && !r.branch).at(-1);
    const wider = moeRecords.map((r) => (r === last ? { ...r, metrics: { ...r.metrics, c32_aggregate_tok_s: 400 } } : r));
    expect(publishedExtensionOf(MOE, wider, ladders).rungs.map((r) => r.c)).toEqual([64, 128]);
  });
});
