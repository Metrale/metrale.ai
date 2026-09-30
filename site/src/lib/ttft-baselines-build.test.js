// SPDX-License-Identifier: AGPL-3.0-only
//
// Every guard in scripts/lib/ttft-baselines-build.mjs, broken on purpose.
//
// The fixtures are the COMMITTED engine manifests and their raw files, cloned
// and mutated one field at a time, so each case is an input the real generator
// could be handed. A guard never seen to go red is one nobody knows is wired.
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTtftBaselines, engineInstrument, promptKey } from '../../scripts/lib/ttft-baselines-build.mjs';
import { engineRoot } from '../../scripts/lib/engine-root.mjs';
import generated from './ttft-baselines.generated.json';

const REPO = engineRoot();
const clone = (x) => JSON.parse(JSON.stringify(x));
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** One subject's manifest and every file it cites, loaded once. */
function fixture(subject) {
  const rel = `bench/baselines/${subject}/ttft/published.json`;
  const dir = join(REPO, 'bench', 'baselines', subject, 'ttft');
  const manifest = JSON.parse(readFileSync(join(REPO, rel), 'utf8'));
  const files = {};
  const cited = [...(manifest.series ?? []).flatMap((s) => Object.keys(s.sources)), ...Object.keys(manifest.oneshot?.sources ?? {})];
  for (const f of cited) files[f] = readFileSync(join(dir, f), 'utf8');
  return { rel, manifest, files };
}
const MOE = fixture('qwen36-35b-a3b');
const DENSE = fixture('qwen38-27b');

/**
 * Build from a mutated copy. `mut(manifest, files)` edits in place. The
 * manifest's listed hashes are re-pinned to the edited files, so a content
 * edit reaches the guard it is aimed at, unless `stale` keeps the originals.
 */
function build(fix, mut = () => {}, { stale = false } = {}) {
  const manifest = clone(fix.manifest);
  const files = { ...fix.files };
  mut(manifest, files);
  if (!stale) {
    for (const src of [...(manifest.series ?? []).map((s) => s.sources), manifest.oneshot?.sources ?? {}]) {
      for (const f of Object.keys(src)) src[f] = sha(files[f]);
    }
  }
  return buildTtftBaselines(manifest, {
    path: fix.rel,
    rawOf: (f) => JSON.parse(files[f]),
    textOf: (f) => files[f],
    sha256Of: (f) => sha(files[f]),
  });
}
const firstSource = (s) => Object.keys(s.sources)[0];
const editRaw = (files, f, mut) => {
  const doc = JSON.parse(files[f]);
  mut(doc);
  files[f] = JSON.stringify(doc);
};

describe('the committed manifests', () => {
  test('build exactly what the page reads', () => {
    expect([build(DENSE), build(MOE)].map((m) => m.checkpoint).sort()).toEqual(generated.manifests.map((m) => m.checkpoint).sort());
    for (const m of [build(DENSE), build(MOE)]) {
      expect(m).toEqual(generated.manifests.find((g) => g.checkpoint === m.checkpoint));
    }
  });

  test('the dense manifest has no 32k gate run, so its 32k figures are the one-shots', () => {
    const d = build(DENSE);
    expect(d.baselines.filter((b) => b.gate.startsWith('high-isl')).map((b) => b.method)).toEqual(['one-shot', 'one-shot']);
    expect(d.series_note).toContain('No vLLM series at the 32k gate instrument');
  });
});

describe('the guards bite', () => {
  test('a cited file that no longer hashes to its listed sha256', () => {
    const f = firstSource(MOE.manifest.series[0]);
    const touch = (m, files) => (files[f] = `${files[f]} `);
    expect(() => build(MOE, touch, { stale: true })).toThrow(new RegExp(`${f} hashes to [0-9a-f]{64}, the manifest lists`));
    // the control: the same byte edit with the listing updated builds
    expect(() => build(MOE, touch)).not.toThrow();
    const o = Object.keys(MOE.manifest.oneshot.sources)[0];
    expect(() => build(MOE, (m, files) => (files[o] = `${files[o]}\n`), { stale: true })).toThrow(/oneshot: .* hashes to/);
  });

  test('a gate-run figure the raw records do not reproduce', () => {
    expect(() => build(MOE, (m) => (m.series[0].median_ms.median_of_runs += 0.1))).toThrow(
      /recomputes to 9303\.1, the manifest says 9303\.2/
    );
  });

  test('a raw record of another gate, another checkpoint or another sample count', () => {
    const s = MOE.manifest.series[0];
    const f = firstSource(s);
    const withRaw = (mut) => () => build(MOE, (m, files) => editRaw(files, f, mut));
    expect(withRaw((d) => (d.benchmark_id = 'ttft-cold-gate'))).toThrow(/is a ttft-cold-gate record/);
    expect(withRaw((d) => (d.target_model = 'unsloth/Qwen3.8-27B-NVFP4'))).toThrow(/measured unsloth/);
    expect(withRaw((d) => (d.params.repeats = '1'))).toThrow(/ran repeats 1, the instrument says 12/);
    expect(withRaw((d) => delete d.frame.metrics.p90_ms)).toThrow(/carries no median_ms\/p90_ms/);
  });

  test('an instrument that does not say what it sent, or in which cache state', () => {
    expect(() => build(MOE, (m) => delete m.series[0].instrument.prompt_sha256)).toThrow(/neither prompt_sha256 nor prompt_lengths/);
    expect(() => build(MOE, (m) => (m.series[0].instrument.mode = 'hot'))).toThrow(/is not cold or warm/);
  });

  test('a one-shot figure that is not the median of its steady pairs', () => {
    expect(() => build(MOE, (m) => (m.gate_ceilings['high-isl-ttft-cold-moe'].median_ms = 9265.4))).toThrow(
      /median_ms recomputes to 9231\.9, gate_ceilings says 9265\.4/
    );
  });

  // ★ A first request after a vLLM boot pays one-time JIT (41,976 ms vs
  // ~9,230 ms steady). Citing one would make vLLM look 4.5x slower than it is.
  test('a one-shot that cites a first-after-boot pair', () => {
    const cold = MOE.manifest.gate_ceilings.excluded[0].tag;
    expect(() => build(MOE, (m) => (m.gate_ceilings['high-isl-ttft-cold-moe'].pairs[0] = cold))).toThrow(/is not steady/);
  });

  test('a one-shot pair with no line, or one that read another token count', () => {
    const tag = MOE.manifest.gate_ceilings['high-isl-ttft-warm-moe'].pairs[0];
    const drop = (files) => {
      const f = Object.keys(MOE.manifest.oneshot.sources)[0];
      files[f] = files[f]
        .split('\n')
        .filter((l) => !(l.includes(tag) && l.includes('"kind":"warm"')))
        .join('\n');
    };
    expect(() => build(MOE, (m, files) => drop(files))).toThrow(new RegExp(`no warm line for pair ${tag}`));
    expect(() => build(MOE, (m) => (m.oneshot.instrument.prompt_tokens = 32768))).toThrow(
      /read 32772 prompt tokens, the instrument says 32768/
    );
  });

  test('a one-shot whose build no gate-run series shares has no engine name', () => {
    expect(() => build(DENSE, (m) => (m.oneshot.build = 'vllm/vllm-openai@sha256:0000'))).toThrow(/nothing names its engine/);
  });

  test('two baselines of one method for one gate', () => {
    expect(() => build(MOE, (m) => m.series.push(clone(m.series[0])))).toThrow(/two gate-run baselines for high-isl-ttft-cold-moe/);
  });
});

describe('the engine side', () => {
  test('reads the one max_tokens of the TTFT request body', () => {
    const src = readFileSync(join(REPO, 'crates/bench/src/benchmarks/ttft.rs'), 'utf8');
    expect(engineInstrument({ ttftSource: src, fixtures: { x: 'y' } }).osl).toBe(8);
    expect(generated.engine.osl).toBe(8);
  });

  test('refuses a source with no max_tokens or two, and a prompts directory with no fixture', () => {
    expect(() => engineInstrument({ ttftSource: 'nothing', fixtures: { x: 'y' } })).toThrow(/found 0/);
    expect(() => engineInstrument({ ttftSource: '"max_tokens": 8, "max_tokens": 16', fixtures: { x: 'y' } })).toThrow(/found 2/);
    expect(() => engineInstrument({ ttftSource: '"max_tokens": 8', fixtures: {} })).toThrow(/no \.txt fixture/);
  });

  test('the fixture hash the page pairs on is the committed file', () => {
    const txt = readFileSync(join(REPO, 'crates/bench/src/benchmarks/ttft/prompts/long-32k.txt'));
    expect(generated.engine.fixtures['long-32k']).toBe(sha(txt));
  });

  test('promptKey: a sha256, else a length list, else nothing', () => {
    expect(promptKey({ prompt_sha256: 'a'.repeat(64) })).toBe(`sha256:${'a'.repeat(64)}`);
    expect(promptKey({ prompt_sha256: 'short', prompt_lengths: [256, 1024] })).toBe('lengths:256,1024');
    expect(promptKey({ prompt_lengths: [0] })).toBeNull();
    expect(promptKey({})).toBeNull();
  });
});
