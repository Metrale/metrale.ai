// SPDX-License-Identifier: AGPL-3.0-only
//
// The committed ladders against their receipts.
//
// Every number in ladders.generated.json must be recomputable from the raw
// harness file its rung names — by a SECOND implementation of the statistics,
// written here, not imported from the generator. A transcribed number is how
// a chart quietly stops matching its receipts; this is where it would show.
//
// The MoE block pins what was communicated for the 2026-09-19 vLLM one-shot:
// which rungs exist, which are absent and why, which harness copy ran, which
// image, and which kernel was forced. Those are the facts a reader comparing
// engines is owed, so they are pinned as facts rather than trusted as prose.
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ladders from './ladders.generated.json';
import ladder from './ladder.generated.json';
import subjects from './concurrency-subjects.json';
import { buildLadder } from '../../scripts/lib/ladder-build.mjs';
import { engineRoot } from '../../scripts/lib/engine-root.mjs';

// The engine checkout the build reads (site/engine.ref pins its commit).
const REPO = engineRoot();
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (algo, p) => createHash(algo).update(readFileSync(p)).digest('hex');
const manifestPathOf = (s) => resolve(REPO, s.published_manifest);
const rawReader = (s) => (file) => readJson(join(dirname(manifestPathOf(s)), file));
const withManifest = subjects.filter((s) => s.published_manifest !== null);
// A subject manifest may name its vLLM legs by reference (`pairs_with`): the
// MoE's does. Its raw files sit beside the manifest that names them.
const pairedOf = (s) => {
  const m = readJson(manifestPathOf(s));
  if (m.pairs_with === undefined) return null;
  const path = resolve(REPO, m.pairs_with);
  return { manifest: readJson(path), rawOf: (file) => readJson(join(dirname(path), file)) };
};
/** The manifest that names a series: the subject manifest, or the one it pairs with. */
const manifestOfSeries = (s, series) => {
  const own = readJson(manifestPathOf(s));
  return own.series.some((x) => x.id === series.id) ? own : pairedOf(s).manifest;
};
const strip = ({ generated_utc, ...rest }) => rest;

// Independent statistics.
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round2 = (v) => Math.round(v * 100) / 100;

describe('one generated ladder per subject with a manifest', () => {
  test('the keys of ladders.generated.json are exactly the subjects that declare a manifest', () => {
    expect(Object.keys(ladders.subjects).sort()).toEqual(withManifest.map((s) => s.id).sort());
    for (const s of withManifest) {
      expect(ladders.subjects[s.id].manifest).toBe(s.published_manifest);
      expect(ladders.subjects[s.id].workload.checkpoint).toBe(s.checkpoint);
    }
  });

  test('the dense entry deep-equals ladder.generated.json, the file every other consumer reads', () => {
    expect(ladders.subjects['qwen38-27b']).toEqual(strip(ladder));
  });

  test('regenerating from the committed manifests reproduces the committed ladders', () => {
    for (const s of withManifest) {
      const manifest = readJson(manifestPathOf(s));
      const rebuilt = buildLadder(manifest, {
        subject: s,
        rawOf: rawReader(s),
        harnessRepoSha256: hash('sha256', resolve(REPO, manifest.workload.harness)),
        pairsWith: pairedOf(s),
      });
      expect(rebuilt).toEqual(ladders.subjects[s.id]);
    }
  });
});

describe('every published rung recomputes from the raw file it names', () => {
  const cases = withManifest.flatMap((s) =>
    ladders.subjects[s.id].series.flatMap((series) => series.rungs.map((r) => [s.id, series.id, r.c, r.source, r]))
  );
  expect(cases.length).toBeGreaterThan(0);

  test.each(cases)('%s / %s C=%i from %s', (subjectId, seriesId, c, source, r) => {
    const s = withManifest.find((x) => x.id === subjectId);
    const own = manifestOfSeries(s, { id: seriesId });
    const manifests = { [subjectId]: own };
    // A rung pooled from per-rep files names each of them (ladder-build.mjs#sourceFilesOf).
    const docs = (r.sources ?? [source]).map(rawReader(s));
    const rung = { reps: docs.flatMap((d) => d.rungs.find((x) => x.concurrency === c).reps) };
    const doc = docs.reduce((a, d) => (d.started_utc < a.started_utc ? d : a));
    const tok = rung.reps.map((x) => x.tok_s);
    expect(r.reps).toBe(rung.reps.length);
    expect(r.tok_s).toBe(round2(mean(tok)));
    expect(r.tok_s_median).toBe(round2(median(tok)));
    expect(r.spread_pct).toBe(round2(((Math.max(...tok) - Math.min(...tok)) / mean(tok)) * 100));
    expect(r.ttft_p50_ms).toBe(round2(median(rung.reps.map((x) => x.ttft_p50_ms))));
    expect(r.tpot_p50_ms).toBe(round2(median(rung.reps.map((x) => x.tpot_p50_ms))));
    expect(rung.reps.reduce((a, x) => a + x.n_err, 0)).toBe(0);
    expect(r.measured_utc).toBe(doc.started_utc);
    expect(doc.driver_sha256.startsWith(r.harness_sha256)).toBe(true);
    expect(Object.keys(manifests[subjectId].harness_shas)).toContain(r.harness_sha256);
    // The raw header is the instrument the manifest claims.
    const w = manifests[subjectId].workload;
    // A per-rep file is a one-rep, no-warmup run; the manifest's protocol says where the warm-up ran.
    const [reps, warmup] = r.sources ? [1, 0] : [w.reps, w.warmup];
    for (const d of docs)
      expect([d.model, d.isl, d.osl, d.reps, d.warmup, d.seed]).toEqual([w.checkpoint, w.isl_tokens, w.osl_tokens, reps, warmup, w.seed]);
    if (r.sources) expect(r.sources).toHaveLength(w.reps);
  });
});

describe('the MoE one-shot of 2026-09-19', () => {
  const subject = subjects.find((s) => s.id === 'qwen36-35b-a3b');
  const moe = ladders.subjects['qwen36-35b-a3b'];
  const full = moe.series.find((s) => s.id === 'vllm-mtp');
  // The one-shot's own rungs; C=32..128 were filled from its energy re-run.
  const vllm = { ...full, rungs: full.rungs.filter((r) => !r.filled_from) };
  const raw = rawReader(subject)(vllm.rungs[0].source);
  const dense = ladder.series.find((s) => s.id === 'vllm-mtp');
  const vllmManifest = pairedOf(subject).manifest;

  test('is the vLLM side of a scored pair: the Metrale Engine leg is its own manifest, paired by reference', () => {
    expect(moe.series.map((s) => [s.id, s.role, s.scope])).toEqual([
      ['metrale', 'subject', undefined],
      ['vllm-mtp', 'baseline', undefined],
      ['vllm-mtp-energy', 'baseline', 'cost'],
    ]);
    expect(moe.pairs_with).toBe('bench/baselines/qwen36-35b-a3b/published.json');
    expect(vllmManifest.subject_note).toMatch(/no Metrale Engine run exists at this instrument/i);
    expect(moe.subject_note).toBeUndefined();
    expect(full.rungs.every((r) => r.tok_s > 0)).toBe(true);
  });

  test('exactly C=1..16 from one raw file; 32/64/128 are not in it, and come from the energy leg, each rung saying so', () => {
    expect(moe.concurrencies).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(vllm.rungs.map((r) => r.c)).toEqual([1, 2, 4, 8, 16]);
    expect(new Set(vllm.rungs.map((r) => r.source)).size).toBe(1);
    expect(full.unmeasured).toBeUndefined();
    expect(full.filled.rungs).toEqual([32, 64, 128]);
    expect(full.filled.from).toBe('vllm-mtp-energy');
    // The reason the one-shot stopped is still the manifest's own.
    expect(vllmManifest.series.find((s) => s.id === 'vllm-mtp').unmeasured.reason).toMatch(/powercycle/);
    expect(raw.rungs.map((r) => r.concurrency)).toEqual([1, 2, 4, 8, 16]);
    const energy = moe.series.find((s) => s.id === 'vllm-mtp-energy');
    for (const c of full.filled.rungs) {
      const r = full.rungs.find((x) => x.c === c);
      expect(r.filled_from).toBe('vllm-mtp-energy');
      expect(r.tok_s).toBe(energy.rungs.find((x) => x.c === c).tok_s);
    }
  });

  test('the numbers communicated on 2026-09-19, as the raw file yields them', () => {
    expect(vllm.rungs.map((r) => [r.c, r.tok_s, r.spread_pct, r.reps])).toEqual([
      [1, 52.11, 10.93, 3],
      [2, 93.16, 4.96, 3],
      [4, 145.94, 3.33, 3],
      [8, 222.08, 6.44, 3],
      [16, 329.93, 0.34, 3],
    ]);
    expect(raw.rungs.reduce((a, r) => a + r.errors_total, 0)).toBe(0);
    expect(raw.reps).toBe(3);
    expect(raw.warmup).toBe(1);
  });

  test('measured once: every rung carries the same 2026-09-19 stamp', () => {
    expect(new Set(vllm.rungs.map((r) => r.measured_utc))).toEqual(new Set([raw.started_utc]));
    expect(raw.started_utc.slice(0, 10)).toBe('2026-09-19');
    expect(raw.finished_utc.slice(0, 10)).toBe('2026-09-19');
  });

  // The raw driver sha is the revision that RAN (2026-09-19). The tree copy's
  // comments have been edited since, so the two no longer hash equal; the
  // generated repo hash must still be the tree file's, and the recorded sha
  // must still be the one the manifest lists.
  test('the harness revision that ran is listed, and the generated repo hash is the tree file', () => {
    const tree = resolve(REPO, moe.workload.harness);
    expect(moe.harness_repo_sha256).toBe(hash('sha256', tree));
    expect(raw.driver_sha256.slice(0, 10)).toBe('41e242c072');
    expect(Object.keys(moe.baseline_harness_shas)).toEqual([raw.driver_sha256.slice(0, 10), '55a5963e4b', 'equivalence']);
    expect(moe.baseline_harness_shas.equivalence).toMatch(/replaced/);
    // The Metrale Engine leg ran the revision of the energy leg.
    expect(Object.keys(moe.harness_shas)).toEqual(['55a5963e4b']);
  });

  test('the instrument the fingerprint compares: read from the raw header, spelled as a gate record spells it', () => {
    expect(vllm.instrument).toEqual({
      isl: raw.isl,
      osl: raw.osl,
      reps: raw.reps,
      warmup: raw.warmup,
      temperature: raw.temperature,
      seed: raw.seed,
      prompt_mode: 'essay',
      max_model_len: 2048,
      max_batch_size: 128,
      kv_cache_dtype: 'bf16',
    });
    // Declared 2026-09-20 (owner decision). It is DERIVED, not recorded: the
    // raw file carries isl, osl, reps, warmup, temperature, seed and
    // chat_template_kwargs but NOT prompt_mode, so this asserts the value the
    // pinned harness defaults to (harness_w55_conc_ladder.py:75) given that
    // this series' recorded env does not set W55_PROMPT_MODE. It exists so a
    // future concurrency-sweep-moe record on this same instrument can pair
    // with this bar -- ladder-baselines.js counts an undeclared axis as a
    // DIFFERENCE, never a match. Re-check if the raw file is ever replaced.
    expect(vllm.instrument.prompt_mode).toBe('essay');
    expect(vllm.cli).toContain('--max-model-len 2048 --max-num-seqs 128 --gpu-memory-utilization 0.85');
    expect(vllm.cli).toContain('--dtype bfloat16 --kv-cache-dtype auto');
    expect(vllm.cli).toContain('--speculative-config \'{"method":"mtp","num_speculative_tokens":3}\'');
    expect(vllm.instrument_note).toMatch(/auto.*bfloat16/s);
    expect(raw.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(raw.temperature).toBe(0);
    expect(raw.seed).toBe(42);
  });

  test('the engine and image are recorded, and the forced kernel is provenance, not a footnote', () => {
    expect(vllm.engine).toBe('vLLM 0.27.1');
    expect(vllm.build).toBe(dense.build); // the same image digest the dense legs ran, read on the box
    expect(vllm.build_note).toMatch(/docker image inspect/);
    expect(vllm.env).toContain('VLLM_USE_DEEP_GEMM=0');
    expect(vllm.env).toContain('VLLM_TEST_FORCE_FP8_MARLIN=1');
    expect(vllm.kernel_override.env).toBe('VLLM_USE_DEEP_GEMM=0 VLLM_TEST_FORCE_FP8_MARLIN=1');
    expect(vllm.cli).toContain('-e VLLM_USE_DEEP_GEMM=0 -e VLLM_TEST_FORCE_FP8_MARLIN=1');
    expect(vllm.kernel_override.error).toContain('layout.hpp:60');
    expect(vllm.kernel_override.error).toContain('Unknown SF transformation');
    expect(vllm.kernel_override.what).toMatch(/NOT running its own default/);
    expect(moe.box.name).toBe('dgx2 (spark-43fa)');
    expect(moe.workload.checkpoint).toBe('Qwen/Qwen3.6-35B-A3B-FP8');
  });

  test('the raw file is the one the manifest names, byte for byte', () => {
    const file = join(dirname(manifestPathOf(subject)), vllm.rungs[0].source);
    expect(vllm.source_note).toContain(hash('sha256', file));
  });
});

describe('the MoE energy leg of 2026-09-28', () => {
  const subject = subjects.find((s) => s.id === 'qwen36-35b-a3b');
  const moe = ladders.subjects['qwen36-35b-a3b'];
  const vllm = moe.series.find((s) => s.id === 'vllm-mtp');
  const energy = moe.series.find((s) => s.id === 'vllm-mtp-energy');
  const raw = rawReader(subject)(energy.rungs[0].source);

  test('is vllm-mtp re-run with joules: same image, command and instrument, scoped to cost', () => {
    expect(energy.scope).toBe('cost');
    expect(energy.parity).toBe('matched');
    expect(energy.build).toBe(vllm.build);
    expect(energy.cli).toBe(vllm.cli);
    expect(energy.env).toBe(vllm.env);
    expect(energy.instrument).toEqual(vllm.instrument);
    expect(raw.driver_sha256.slice(0, 10)).toBe('55a5963e4b');
    expect(raw.started_utc.slice(0, 10)).toBe('2026-09-28');
  });

  // 2026-09-28: The wide rungs came later the same day, one raw file per fresh vLLM container.
  test('C=1..128: C=1..16 from the first raw file, each wide rung from its own, nothing declared unmeasured', () => {
    expect(energy.rungs.map((r) => [r.c, r.source])).toEqual([
      [1, 'vllm_moe_energy_c1_16.json'],
      [2, 'vllm_moe_energy_c1_16.json'],
      [4, 'vllm_moe_energy_c1_16.json'],
      [8, 'vllm_moe_energy_c1_16.json'],
      [16, 'vllm_moe_energy_c1_16.json'],
      [32, 'vllm_moe_energy_c32.json'],
      [64, 'vllm_moe_energy_c64.json'],
      [128, 'vllm_moe_energy_c128.json'],
    ]);
    expect(energy.unmeasured).toBeUndefined();
    expect(raw.rungs.map((r) => r.concurrency)).toEqual([1, 2, 4, 8, 16]);
    for (const r of energy.rungs.filter((x) => x.c >= 32)) {
      const doc = rawReader(subject)(r.source);
      expect(doc.rungs.map((x) => x.concurrency)).toEqual([r.c]);
      expect(doc.driver_sha256.slice(0, 10)).toBe('55a5963e4b');
    }
  });

  test('throughput agrees with vllm-mtp within 2% at every rung both measured, which is what makes the joules quotable', () => {
    // vllm-mtp stops at C=16, so the wide rungs have no throughput leg to agree with.
    for (const r of energy.rungs.filter((x) => vllm.rungs.some((v) => v.c === x.c))) {
      const ref = vllm.rungs.find((x) => x.c === r.c);
      expect(Math.abs(r.tok_s / ref.tok_s - 1)).toBeLessThan(0.02);
    }
  });

  test('every rung carries joules summed over its three reps, as the raw file yields them', () => {
    expect(energy.rungs.map((r) => [r.c, Math.round((r.gpu_rail_energy_j / r.gpu_rail_energy_window_tokens) * 1000) / 1000])).toEqual([
      [1, 0.641],
      [2, 0.4],
      [4, 0.274],
      [8, 0.191],
      [16, 0.142],
      [32, 0.109],
      [64, 0.092],
      [128, 0.078],
    ]);
    for (const r of energy.rungs) {
      const reps = rawReader(subject)(r.source).rungs.find((x) => x.concurrency === r.c).reps;
      expect(r.gpu_rail_energy_window_tokens).toBe(reps.reduce((a, x) => a + x.completion_tokens, 0));
      expect(reps.every((x) => x.gpu_rail_trustworthy)).toBe(true);
    }
  });

  test('the raw file is the one the manifest names, byte for byte', () => {
    const file = join(dirname(manifestPathOf(subject)), energy.rungs[0].source);
    expect(energy.source_note).toContain(hash('sha256', file));
    for (const r of energy.rungs.filter((x) => x.c >= 32))
      expect(energy.wide_note).toContain(hash('sha256', join(dirname(manifestPathOf(subject)), r.source)));
  });
});

describe('the MoE Metrale Engine leg of 2026-10-01', () => {
  const subject = subjects.find((s) => s.id === 'qwen36-35b-a3b');
  const moe = ladders.subjects['qwen36-35b-a3b'];
  const metrale = moe.series.find((s) => s.role === 'subject');
  const manifest = readJson(manifestPathOf(subject));
  const files = Object.values(manifest.series[0].sources).flat();

  test('C=1..128 on the published instrument, three per-rep files per rung, the same rep count as the vLLM legs', () => {
    expect(metrale.rungs.map((r) => r.c)).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
    expect(metrale.rungs.every((r) => r.reps === 3)).toBe(true);
    expect(moe.workload.reps).toBe(3);
    expect(moe.baseline_workload.reps).toBe(3);
    expect(moe.reps_note).toBeUndefined();
    expect(files).toHaveLength(24);
    expect(new Set(files).size).toBe(24);
    for (const [c, fs] of Object.entries(manifest.series[0].sources)) {
      expect(fs).toHaveLength(3);
      for (const f of fs) {
        const doc = rawReader(subject)(f);
        expect([doc.reps, doc.warmup]).toEqual([1, 0]);
        expect(doc.rungs.map((r) => r.concurrency)).toEqual([Number(c)]);
        expect(doc.driver_sha256.slice(0, 10)).toBe('55a5963e4b');
        expect(doc.started_utc.slice(0, 10)).toBe('2026-10-01');
      }
    }
    for (const r of metrale.rungs) expect(r.gpu_rail_energy_j).toBeGreaterThan(0);
  });

  test('labelled published-ladder data, not a gate record, at the certified binary of main', () => {
    expect(metrale.evidence_note).toMatch(/^Published-ladder data, not a gate record\./);
    expect(metrale.build).toBe('b32255fa42');
    expect(metrale.build_note).toContain('2f66da5dd');
  });

  test('scored against vllm-mtp at every rung, and wins each', () => {
    expect(moe.rows.map((r) => [r.c, r.engine, r.baselines.map((b) => b.id)])).toEqual(
      metrale.rungs.map((r) => [r.c, r.tok_s, ['vllm-mtp']])
    );
    expect(moe.summary).toMatchObject({ rungs: 8, won: 8, all_won: true });
  });

  test('every per-rep file is the one the manifest names, byte for byte', () => {
    for (const f of files) expect(metrale.source_note).toContain(hash('sha256', join(dirname(manifestPathOf(subject)), f)));
  });
});
