// SPDX-License-Identifier: AGPL-3.0-only
//
// Every guard in scripts/lib/ladder-build.mjs, broken on purpose.
//
// The fixtures are the COMMITTED manifests and raw files, deep-cloned and
// mutated one field at a time, so each case is an input the real generator
// could be handed. A guard that is never seen to go red is a guard nobody
// knows is wired; every case below is one that would otherwise let a typed
// number, a phantom rung, an unlisted harness revision or a mismatched
// instrument reach the chart.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import subjects from './concurrency-subjects.json';
import { buildLadder, cliFlag, r2, r3 } from '../../scripts/lib/ladder-build.mjs';
import { engineRoot } from '../../scripts/lib/engine-root.mjs';
import { energyOfRung } from './cost.js';

// The engine checkout the build reads (site/engine.ref pins its commit).
const REPO = engineRoot();
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

/**
 * A manifest and its raw files, loaded once, cloned per case. `path` defaults
 * to the subject's published manifest.
 */
function fixture(id, path) {
  const subject = subjects.find((s) => s.id === id);
  const rel = path ?? subject.published_manifest;
  const dir = dirname(resolve(REPO, rel));
  const manifest = readJson(resolve(REPO, rel));
  const raws = {};
  for (const s of manifest.series) for (const f of Object.values(s.sources)) raws[f] ??= readJson(join(dir, f));
  return { subject: { ...subject, published_manifest: rel }, manifest, raws };
}
// The MoE vLLM manifest on its own: a baseline-only ladder, the shape every
// guard below is written against. The subject's published manifest pairs a
// Metrale Engine leg with it by reference (see "a paired manifest" below).
const MOE_VLLM = 'bench/baselines/qwen36-35b-a3b/published.json';
const MOE = fixture('qwen36-35b-a3b', MOE_VLLM);
const DENSE = fixture('qwen38-27b');
const MOE_PAIRED = fixture('qwen36-35b-a3b');

/** Build from a mutated copy: `mut(manifest, raws, subject)` edits in place. */
function build(fix, mut) {
  const manifest = clone(fix.manifest);
  const raws = clone(fix.raws);
  const subject = clone(fix.subject);
  mut?.(manifest, raws, subject);
  return buildLadder(manifest, {
    subject,
    rawOf: (file) => {
      if (!(file in raws)) throw new Error(`cannot read raw ${file}`);
      return raws[file];
    },
    harnessRepoSha256: 'f'.repeat(64),
  });
}
const vllm = (m) => m.series.find((s) => s.id === 'vllm-mtp');
const RAW = 'vllm_moe_c1_16.json';

describe('the committed inputs build', () => {
  test('MoE: a baseline-only ladder, C=1..128 through the energy leg, and no scored pair', () => {
    const l = build(MOE);
    expect(l.concurrencies).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(l.rows).toBeUndefined();
    expect(l.summary).toBeUndefined();
    expect(l.harness_repo_sha256).toBe('f'.repeat(64));
  });

  test('dense: a scored pair, 8 rungs, the matched baseline as the denominator', () => {
    const l = build(DENSE);
    expect(l.summary.rungs).toBe(8);
    expect(l.rows.every((r) => r.best_baseline_id === 'vllm-mtp')).toBe(true);
  });
});

describe('typed numbers are refused', () => {
  test.each(['rungs', 'tok_s', 'rows', 'summary'])('a series carrying "%s"', (k) => {
    expect(() => build(MOE, (m) => (vllm(m)[k] = [{ c: 1, tok_s: 52.11 }]))).toThrow(new RegExp(`typed "${k}"`));
  });
  test.each(['rows', 'summary'])('a manifest carrying top-level "%s"', (k) => {
    expect(() => build(MOE, (m) => (m[k] = []))).toThrow(new RegExp(`typed "${k}"`));
  });
});

describe('the raw file must prove the manifest', () => {
  test('a source that does not exist', () => {
    expect(() => build(MOE, (m) => (vllm(m).sources['1'] = 'nope.json'))).toThrow(/cannot read raw nope.json/);
  });
  test('a source without the rung it is named for', () => {
    expect(() => build(MOE, (m) => (vllm(m).sources['32'] = RAW))).toThrow(/has no rung for C=32/);
  });
  test('a rung with no reps', () => {
    expect(() => build(MOE, (m, raws) => (raws[RAW].rungs[0].reps = []))).toThrow(/C=1 has no reps/);
  });
  test('a request error anywhere in a rung', () => {
    expect(() => build(MOE, (m, raws) => (raws[RAW].rungs[2].reps[1].n_err = 1))).toThrow(/C=4 recorded 1 request errors/);
  });
  test('a non-numeric tok_s', () => {
    expect(() => build(MOE, (m, raws) => (raws[RAW].rungs[0].reps[0].tok_s = '52.11'))).toThrow(/non-numeric tok_s/);
  });
  test.each([
    ['model', 'other/checkpoint', 'checkpoint'],
    ['isl', 512, 'isl_tokens'],
    ['osl', 320, 'osl_tokens'],
    ['reps', 5, 'reps'],
    ['warmup', 0, 'warmup'],
    ['temperature', 0.7, 'temperature'],
    ['seed', 0, 'seed'],
  ])('a raw header whose %s disagrees with the workload', (k, v, wl) => {
    expect(() => build(MOE, (m, raws) => (raws[RAW][k] = v))).toThrow(new RegExp(`header ${k}=.* != workload\\.${wl}`));
  });
  test('a raw file without a date or a driver sha cannot be stamped', () => {
    expect(() => build(MOE, (m, raws) => delete raws[RAW].started_utc)).toThrow(/no started_utc/);
    expect(() => build(MOE, (m, raws) => delete raws[RAW].driver_sha256)).toThrow(/no driver_sha256/);
  });
  test('the subject and the manifest must name one checkpoint', () => {
    expect(() => build(MOE, (m, raws, subject) => (subject.checkpoint = 'unsloth/Qwen3.8-27B-NVFP4'))).toThrow(
      /is for Qwen\/Qwen3.6-35B-A3B-FP8, subject qwen36-35b-a3b is unsloth\/Qwen3.8-27B-NVFP4/
    );
  });
});

describe('harness_shas is exactly the set of revisions the raw files carry', () => {
  test('an unlisted revision — the dgx2 stale-copy failure this exists to catch', () => {
    expect(() => build(MOE, (m, raws) => (raws[RAW].driver_sha256 = 'deadbeef00' + 'a'.repeat(54)))).toThrow(
      /harness revision deadbeef00 produced vllm_moe_c1_16.json but is not listed/
    );
    expect(() => build(MOE, (m) => delete m.harness_shas['41e242c072'])).toThrow(/41e242c072 produced .* but is not listed/);
  });
  test('a listed revision no raw file carries is a phantom', () => {
    expect(() => build(MOE, (m) => (m.harness_shas['0000000000'] = 'imaginary'))).toThrow(/lists 0000000000 but no raw file/);
  });
  test('the dense manifest lists all three revisions its files carry, and no fourth', () => {
    expect(() => build(DENSE, (m) => delete m.harness_shas['1f10d4887b'])).toThrow(
      /1f10d4887b produced c2_metrale_dgx2_20260818.json, c2_vllm_mtp_dgx2_20260818.json/
    );
  });
});

describe('an unmeasured rung is absent everywhere', () => {
  test('listed as unmeasured but present in the raw file', () => {
    expect(() =>
      build(MOE, (m) => {
        delete vllm(m).sources['16'];
        vllm(m).unmeasured.rungs = [16];
      })
    ).toThrow(/C=16 as unmeasured but vllm_moe_c1_16.json contains it/);
  });
  test('listed as unmeasured but also sourced', () => {
    expect(() => build(MOE, (m) => vllm(m).unmeasured.rungs.push(1))).toThrow(/C=1 as unmeasured but sources names a file/);
  });
  test('without a reason, or with a non-rung', () => {
    expect(() => build(MOE, (m) => (vllm(m).unmeasured.reason = ' '))).toThrow(/unmeasured.reason is required/);
    expect(() => build(MOE, (m) => (vllm(m).unmeasured.rungs = [32, 0]))).toThrow(/unmeasured.rungs must be/);
  });
});

describe('a baseline declares the instrument the fingerprint compares', () => {
  test('no instrument at all', () => {
    expect(() => build(MOE, (m) => delete vllm(m).instrument)).toThrow(/declares no instrument/);
  });
  test.each([
    ['isl', 512],
    ['osl', 320],
    ['reps', 1],
    ['warmup', 0],
    ['temperature', 1],
    ['seed', 7],
  ])('instrument.%s disagreeing with the workload', (k, v) => {
    expect(() => build(MOE, (m) => (vllm(m).instrument[k] = v))).toThrow(new RegExp(`instrument\\.${k}=${v} != workload`));
  });
  test.each(['max_model_len', 'max_batch_size', 'kv_cache_dtype'])('instrument.%s undeclared', (k) => {
    expect(() => build(MOE, (m) => delete vllm(m).instrument[k])).toThrow(new RegExp(`instrument\\.${k} is undeclared`));
  });
  test('a batch cap or context the command line does not carry', () => {
    expect(() => build(MOE, (m) => (vllm(m).instrument.max_batch_size = 64))).toThrow(/max_batch_size=64 but its cli says 128/);
    expect(() => build(MOE, (m) => (vllm(m).instrument.max_model_len = 4096))).toThrow(/max_model_len=4096 but its cli says 2048/);
    expect(() => build(MOE, (m) => (vllm(m).cli = 'vllm serve'))).toThrow(/max_batch_size=128 but its cli says nothing/);
  });
  test('a KV dtype spelled differently from the command needs its note', () => {
    expect(() => build(MOE, (m) => delete vllm(m).instrument_note)).toThrow(
      /kv_cache_dtype=bf16 but its cli says auto; add instrument_note/
    );
    // With the command spelling the same value, no note is needed.
    expect(() =>
      build(MOE, (m) => {
        delete vllm(m).instrument_note;
        vllm(m).cli = vllm(m).cli.replace('--kv-cache-dtype auto', '--kv-cache-dtype bf16');
      })
    ).not.toThrow();
  });
});

describe('a pair is scored only when it is whole', () => {
  test('no matched-parity baseline', () => {
    expect(() => build(DENSE, (m) => (vllm(m).parity = 'unmatched'))).toThrow(/no matched-parity baseline/);
  });
  test('a cost-scoped leg that covers every rung never votes in the throughput table', () => {
    const l = build(DENSE);
    const energy = l.series.find((s) => s.id === 'vllm-mtp-energy');
    expect(energy.rungs.map((r) => r.c)).toEqual(l.concurrencies);
    for (const row of l.rows) {
      expect(row.baselines.map((b) => b.id)).not.toContain('vllm-mtp-energy');
      expect(row.best_baseline_id).toBe('vllm-mtp');
    }
    // The control: without its scope the same leg is a second full-ladder matched baseline.
    expect(() => build(DENSE, (m) => delete m.series.find((s) => s.id === 'vllm-mtp-energy').scope)).toThrow(
      /more than one full-ladder matched-parity baseline \(vllm-mtp, vllm-mtp-energy\)/
    );
  });
  test('a baseline missing a subject rung', () => {
    expect(() => build(DENSE, (m) => delete vllm(m).sources['64'])).toThrow(/baseline vllm-mtp is missing rung C=64/);
  });
  test('a second subject, an unknown role, an empty series list', () => {
    expect(() => build(DENSE, (m) => (m.series[2].role = 'subject'))).toThrow(/more than one subject/);
    expect(() => build(MOE, (m) => (vllm(m).role = 'reference'))).toThrow(/unknown role "reference"/);
    expect(() => build(MOE, (m) => (m.series = []))).toThrow(/has no series/);
    expect(() => build(MOE, (m) => m.series.forEach((s) => (s.role = 'variant')))).toThrow(/no baseline series/);
    expect(() => build(MOE, (m) => (m.schema = 2))).toThrow(/schema 2, expected 1/);
  });
});

// The energy a one-shot rung carries, from the committed vLLM energy leg. Its
// reps were each ~99% covered by the sampler; the rung must say so on the page.
describe('the energy of a rung sums its reps and keeps the worst one', () => {
  const ENERGY = 'vllm-mtp-energy';
  const RAW_E = 'vllm_mtp_energy_38.json';
  const series = (l) => l.series.find((s) => s.id === ENERGY);
  // 2026-09-28: A rung's reps live in the file its manifest names: C=1..16 in RAW_E, the wide
  // rungs one file per fresh vLLM serve.
  const repsAt = (raws, c, file = RAW_E) => raws[file].rungs.find((r) => r.concurrency === c).reps;

  test('the count, the window and the joules are sums, and every committed rung is trusted', () => {
    const l = build(DENSE);
    const s = series(l);
    expect(s.rungs.length).toBeGreaterThan(0);
    for (const rung of s.rungs) {
      const reps = repsAt(DENSE.raws, rung.c, rung.source);
      expect(rung.gpu_rail_power_samples).toBe(reps.reduce((a, r) => a + r.gpu_rail_power_samples, 0));
      expect(rung.gpu_rail_energy_window_s).toBe(r2(reps.reduce((a, r) => a + r.gpu_rail_window_s, 0)));
      const worst = reps.reduce((a, r) =>
        r.gpu_rail_power_samples / r.gpu_rail_window_s < a.gpu_rail_power_samples / a.gpu_rail_window_s ? r : a
      );
      expect(rung.gpu_rail_worst_rep_power_samples).toBe(worst.gpu_rail_power_samples);
      const e = energyOfRung(s.label, rung);
      expect(e.concerns).toEqual([]);
      expect(e.trusted).toBe(true);
    }
  });

  // The control: starve one rep of readings and the rung it belongs to must
  // stop being trusted, although the sum over all three still clears 90%.
  test('one starved rep makes its rung untrusted and is named', () => {
    const l = build(DENSE, (m, raws) => (repsAt(raws, 8)[1].gpu_rail_power_samples = 200));
    const rung = series(l).rungs.find((r) => r.c === 8);
    expect(rung.gpu_rail_worst_rep_power_samples).toBe(200);
    const e = energyOfRung(ENERGY, rung);
    expect(e.trusted).toBe(false);
    expect(e.concerns).toEqual([expect.stringContaining('worst rep: the sampler covered 71%')]);
  });
});

describe('helpers', () => {
  test('cliFlag reads the first matching flag, whole-token only', () => {
    expect(cliFlag('x --max-num-seqs 128 --kv-cache-dtype auto', '--max-num-seqs')).toBe('128');
    expect(cliFlag('x --max-batch-size 16', '--max-num-seqs', '--max-batch-size')).toBe('16');
    expect(cliFlag('x --max-num-seqs-extra 9', '--max-num-seqs')).toBeNull();
    expect(cliFlag(undefined, '--x')).toBeNull();
  });
  test('rounding keeps the decimals the site prints', () => {
    expect(r2(52.11033488999998)).toBe(52.11);
    expect(r3(1.0044)).toBe(1.004);
  });
});

// ---- a paired manifest ------------------------------------------------------
// The MoE's published manifest holds the Metrale Engine leg only and names the
// vLLM manifest in `pairs_with`. Every rule that lets the two be scored as one
// pair is broken here on purpose.
function buildPaired(mutSubject, mutBase) {
  const manifest = clone(MOE_PAIRED.manifest);
  const base = clone(MOE.manifest);
  mutSubject?.(manifest);
  mutBase?.(base);
  const reader = (raws) => (file) => {
    if (!(file in raws)) throw new Error(`cannot read raw ${file}`);
    return raws[file];
  };
  return buildLadder(manifest, {
    subject: clone(MOE_PAIRED.subject),
    rawOf: reader(MOE_PAIRED.raws),
    harnessRepoSha256: 'f'.repeat(64),
    pairsWith: { manifest: base, rawOf: reader(MOE.raws) },
  });
}
const subjectOf = (m) => m.series[0];

describe('a paired manifest', () => {
  test('the committed pair scores C=1..128 against vllm-mtp, and says it pairs by reference', () => {
    const l = buildPaired();
    expect(l.concurrencies).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(l.summary.rungs).toBe(8);
    expect(l.rows.every((r) => r.best_baseline_id === 'vllm-mtp')).toBe(true);
    expect(l.pairs_with).toBe(MOE_VLLM);
    expect(l.reps_note).toMatch(/2 timed reps/);
    expect(l.workload.reps).toBe(2);
    expect(l.baseline_workload.reps).toBe(3);
    // Each side's raw files were checked against its own workload.
    expect(l.series.find((s) => s.role === 'subject').rungs.every((r) => r.reps === 2)).toBe(true);
    expect(l.series.find((s) => s.id === 'vllm-mtp-energy').rungs.every((r) => r.reps === 3)).toBe(true);
    // The vLLM manifest's "no subject yet" note describes that file alone, not the pair.
    expect(l.subject_note).toBeUndefined();
  });

  test('refused without the manifest it names, or with one it does not name', () => {
    expect(() =>
      buildLadder(clone(MOE_PAIRED.manifest), { subject: MOE_PAIRED.subject, rawOf: () => ({}), harnessRepoSha256: 'f'.repeat(64) })
    ).toThrow(/pairs_with .*: the generator was not handed that manifest/);
    expect(() =>
      buildLadder(clone(MOE.manifest), {
        subject: MOE.subject,
        rawOf: (f) => MOE.raws[f],
        harnessRepoSha256: 'f'.repeat(64),
        pairsWith: { manifest: clone(MOE.manifest), rawOf: (f) => MOE.raws[f] },
      })
    ).toThrow(/names no pairs_with, but a paired manifest was handed in/);
  });

  test.each([
    ['checkpoint', 'other/checkpoint'],
    ['isl_tokens', 512],
    ['osl_tokens', 320],
    ['warmup', 0],
    ['temperature', 0.7],
    ['seed', 7],
  ])('a paired workload whose %s differs', (k, v) => {
    expect(() => buildPaired(null, (b) => (b.workload[k] = v))).toThrow(new RegExp(`workload\\.${k} `));
  });

  test('a rep count that differs is disclosed or refused', () => {
    expect(() => buildPaired((m) => delete m.reps_note)).toThrow(/reps 2 != 3 and no reps_note says why/);
  });

  test('another box, or a matched vLLM leg on another instrument', () => {
    expect(() => buildPaired(null, (b) => (b.box.name = 'dgx3 (spark-28c2)'))).toThrow(/box dgx2 \(spark-43fa\) != dgx3/);
    expect(() => buildPaired((m) => (subjectOf(m).instrument.kv_cache_dtype = 'fp8'))).toThrow(
      /baseline vllm-mtp is matched but its kv_cache_dtype "bf16" != the subject's "fp8"/
    );
    expect(() => buildPaired((m) => delete subjectOf(m).instrument)).toThrow(/declares no instrument to pair on/);
  });

  test('a pairing manifest holds the subject only, and the paired one holds none', () => {
    expect(() => buildPaired((m) => (subjectOf(m).role = 'baseline'))).toThrow(/exactly one series, role "subject"/);
    expect(() => buildPaired(null, (b) => (b.series[1].role = 'subject'))).toThrow(/the paired manifest has its own subject series/);
  });

  test('each side keeps its own harness_shas', () => {
    expect(() => buildPaired((m) => delete m.harness_shas['55a5963e4b'])).toThrow(/55a5963e4b produced metrale_moe_energy/);
    expect(() => buildPaired(null, (b) => delete b.harness_shas['41e242c072'])).toThrow(/41e242c072 produced vllm_moe_c1_16.json/);
  });
});

// ---- a declared gap filled from the same measurement ------------------------
describe("vllm-mtp's declared gaps, filled from its energy re-run", () => {
  const leg = (l, id) => l.series.find((s) => s.id === id);

  test('C=32/64/128 come from vllm-mtp-energy, throughput only, each rung naming its source', () => {
    const l = build(MOE);
    const v = leg(l, 'vllm-mtp');
    const e = leg(l, 'vllm-mtp-energy');
    expect(v.rungs.map((r) => r.c)).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(v.unmeasured).toBeUndefined();
    expect(v.filled).toEqual({
      from: 'vllm-mtp-energy',
      label: 'vLLM + MTP (energy)',
      rungs: [32, 64, 128],
      measured_days: ['2026-09-28'],
    });
    for (const r of v.rungs.filter((x) => x.c >= 32)) {
      const donor = e.rungs.find((x) => x.c === r.c);
      expect(r.filled_from).toBe('vllm-mtp-energy');
      expect(r.tok_s).toBe(donor.tok_s);
      expect(r.source).toBe(donor.source);
      // The joules stay with the Cost tab's leg, so they are never drawn twice.
      expect(r.gpu_rail_energy_j).toBeUndefined();
    }
    for (const r of v.rungs.filter((x) => x.c <= 16)) expect(r.filled_from).toBeUndefined();
  });

  test.each([
    ['engine', 'vLLM 0.28.0'],
    ['build', 'vllm/vllm-openai:other'],
    ['env', 'HF_HUB_OFFLINE=1'],
    ['cli', 'vllm serve --max-model-len 2048 --max-num-seqs 128 --kv-cache-dtype auto'],
  ])('nothing is filled when the energy leg differs in %s', (k, v) => {
    const l = build(MOE, (m) => {
      const e = m.series.find((s) => s.id === 'vllm-mtp-energy');
      e[k] = v;
      if (k === 'cli') e.instrument_note ??= 'test';
    });
    expect(leg(l, 'vllm-mtp').rungs.map((r) => r.c)).toEqual([1, 2, 4, 8, 16]);
    expect(leg(l, 'vllm-mtp').unmeasured.rungs).toEqual([32, 64, 128]);
    expect(leg(l, 'vllm-mtp').filled).toBeUndefined();
  });

  test('nor when its instrument differs, and only rungs declared unmeasured are ever filled', () => {
    const l = build(MOE, (m) => {
      const e = m.series.find((s) => s.id === 'vllm-mtp-energy');
      e.instrument.prompt_mode = 'natural';
    });
    expect(leg(l, 'vllm-mtp').filled).toBeUndefined();
    const partial = build(MOE, (m) => {
      const v = m.series.find((s) => s.id === 'vllm-mtp');
      v.unmeasured.rungs = [32, 64];
      v.sources['128'] = 'vllm_moe_energy_c128.json';
    });
    expect(leg(partial, 'vllm-mtp').filled.rungs).toEqual([32, 64]);
    expect(leg(partial, 'vllm-mtp').rungs.find((r) => r.c === 128).filled_from).toBeUndefined();
  });

  test('two identical energy legs to fill from is ambiguous, and refused', () => {
    expect(() =>
      build(MOE, (m) => {
        const twin = clone(m.series.find((s) => s.id === 'vllm-mtp-energy'));
        m.series.push({ ...twin, id: 'vllm-mtp-energy-2' });
      })
    ).toThrow(/has 2 identical cost legs to fill from/);
  });
});
