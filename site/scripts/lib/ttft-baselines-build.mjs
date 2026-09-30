// SPDX-License-Identifier: AGPL-3.0-only

// ttft-baselines-build.mjs — the vLLM TTFT baselines of one manifest.
//
// Input: one `bench/baselines/<subject>/ttft/published.json` from the engine,
// and its raw files. Output: the baselines the TTFT tabs may draw, each with
// the instrument it was measured on, so src/lib/ttft-baselines.js can pair it
// with a gate or refuse to, axis by axis.
//
// Pure: files are read through the callbacks, and every violation is a thrown
// Error naming the manifest and the series. gen-ttft-baselines.mjs turns the
// throw into a build failure; the bun tests call this directly against the
// committed manifests and mutated copies, so each guard is seen to bite.
//
// Two kinds of baseline come out of a manifest:
//   * a GATE RUN (`series[]`): `met benchmark run <gate>` pointed at vLLM,
//     three runs. Its figure is the median over runs of each run's
//     median_ms / p90_ms, recomputed here from the raw records;
//   * a ONE-SHOT (`oneshot` + `gate_ceilings`): per pair, one cold request and
//     the byte-identical request again (warm). Its figure is the median of the
//     steady pairs' TTFTs named by `gate_ceilings.<gate>.pairs`, recomputed
//     from the .ndjson lines. One request per pair means one sample, so its
//     median and its p90 are the same number, as they are on a one-shot gate
//     record.
//
// Guards, each broken on purpose in ttft-baselines-build.test.js:
//   * every file a manifest cites hashes to the sha256 it lists;
//   * a raw gate record names the series' gate, the manifest's checkpoint and
//     the series' repeats, and the recomputed median over runs equals the
//     manifest's `median_of_runs` to its 0.1 ms rounding;
//   * a one-shot figure equals `gate_ceilings.<gate>` to the same rounding,
//     every cited pair is present, steady, and read the fixture's token count;
//   * a one-shot's engine is named by a gate-run series with the same build.
//     The one-shot block carries a build but no label: the name is taken from
//     the series that proves it is the same image, never assumed.

import { modeOf } from '../../src/lib/ttft-baselines.js';

const fail = (where, msg) => {
  throw new Error(`gen-ttft-baselines: ${where}: ${msg}`);
};

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r1 = (v) => Math.round(v * 10) / 10;
const MODES = Object.freeze(['cold', 'warm']);

/**
 * The prompt a TTFT instrument used, as one comparable string: the fixture's
 * sha256 for a committed prompt, else the synthetic prompt's length list.
 * `null` when neither is declared: an instrument that does not say what it
 * sent pairs with nothing.
 */
export function promptKey(instrument) {
  if (typeof instrument?.prompt_sha256 === 'string' && /^[0-9a-f]{64}$/.test(instrument.prompt_sha256)) {
    return `sha256:${instrument.prompt_sha256}`;
  }
  const lengths = instrument?.prompt_lengths;
  if (Array.isArray(lengths) && lengths.length > 0 && lengths.every((n) => Number.isInteger(n) && n > 0)) {
    return `lengths:${lengths.join(',')}`;
  }
  return null;
}

function checkSources(where, sources, sha256Of) {
  if (!sources || typeof sources !== 'object' || Object.keys(sources).length === 0) fail(where, 'cites no sources');
  for (const [file, want] of Object.entries(sources)) {
    const got = sha256Of(file);
    if (got !== want) fail(where, `${file} hashes to ${got}, the manifest lists ${want}`);
  }
}

function gateRun(manifest, s, where, { rawOf, sha256Of }) {
  const ins = s.instrument;
  if (!ins || typeof ins !== 'object') fail(where, 'declares no instrument');
  if (!MODES.includes(ins.mode)) fail(where, `instrument.mode ${JSON.stringify(ins.mode)} is not cold or warm`);
  if (!Number.isInteger(ins.osl) || !Number.isInteger(ins.reps)) fail(where, 'instrument.osl and instrument.reps must be integers');
  const prompt = promptKey(ins);
  if (prompt === null) fail(where, 'instrument declares neither prompt_sha256 nor prompt_lengths');
  checkSources(where, s.sources, sha256Of);

  const runs = Object.keys(s.sources).map((file) => {
    const raw = rawOf(file);
    if (raw.benchmark_id !== ins.gate) fail(where, `${file} is a ${raw.benchmark_id} record, the series is ${ins.gate}`);
    if (raw.target_model !== manifest.workload.checkpoint)
      fail(where, `${file} measured ${raw.target_model}, the manifest is ${manifest.workload.checkpoint}`);
    if (String(raw.params?.repeats) !== String(ins.reps))
      fail(where, `${file} ran repeats ${raw.params?.repeats}, the instrument says ${ins.reps}`);
    const m = raw.frame?.metrics ?? {};
    if (!Number.isFinite(m.median_ms) || !Number.isFinite(m.p90_ms)) fail(where, `${file} carries no median_ms/p90_ms`);
    return { median_ms: m.median_ms, p90_ms: m.p90_ms };
  });
  const out = {};
  for (const stat of ['median_ms', 'p90_ms']) {
    const v = median(runs.map((r) => r[stat]));
    const declared = s[stat]?.median_of_runs;
    if (r1(v) !== declared) fail(where, `${stat} over runs recomputes to ${r1(v)}, the manifest says ${declared}`);
    out[stat] = r1(v);
  }
  return {
    id: s.id,
    gate: ins.gate,
    method: 'gate-run',
    label: s.label,
    engine: s.engine,
    build: s.build,
    instrument: { mode: ins.mode, osl: ins.osl, reps: ins.reps, prompt, prompt_tokens: ins.prompt_tokens ?? null },
    ...out,
    runs: runs.length,
    statistic: `median over ${runs.length} runs of each run's median and p90 (${ins.reps} samples per run${
      ins.prompt_lengths ? ` per length, pooled over ${ins.prompt_lengths.join('/')}` : ''
    })`,
    box_state: s.box_state ?? null,
  };
}

function oneShots(manifest, where, { textOf, sha256Of }, series) {
  const o = manifest.oneshot;
  const ceilings = manifest.gate_ceilings;
  if (!o) return [];
  if (!ceilings || typeof ceilings !== 'object') fail(where, 'has a oneshot block but no gate_ceilings naming its pairs');
  const ins = o.instrument;
  const prompt = promptKey(ins);
  if (prompt === null) fail(`${where} oneshot`, 'instrument declares no prompt_sha256');
  if (!Number.isInteger(ins.osl)) fail(`${where} oneshot`, 'instrument.osl must be an integer');
  checkSources(`${where} oneshot`, o.sources, sha256Of);

  const same = series.filter((s) => s.build === o.build);
  if (same.length === 0) fail(`${where} oneshot`, `no gate-run series has its build ${o.build}, so nothing names its engine`);
  const names = new Set(same.map((s) => `${s.label}\u0000${s.engine}`));
  if (names.size !== 1) fail(`${where} oneshot`, 'the series sharing its build disagree on the engine name');

  // One line per request, keyed by pair tag and kind.
  const lines = new Map();
  for (const file of Object.keys(o.sources)) {
    for (const [i, text] of textOf(file).split('\n').entries()) {
      if (!text.trim()) continue;
      let line;
      try {
        line = JSON.parse(text);
      } catch (err) {
        fail(`${where} oneshot`, `${file}:${i + 1} is not JSON: ${err.message}`);
      }
      lines.set(`${line.r?.tag}\u0000${line.kind}`, line);
    }
  }
  const pairByTag = new Map((o.pairs ?? []).map((p) => [p.tag, p]));

  const out = [];
  for (const [gate, c] of Object.entries(ceilings)) {
    if (gate === 'rule' || gate === 'excluded') continue;
    const at = `${where} oneshot ${gate}`;
    let mode;
    try {
      mode = modeOf(gate);
    } catch (err) {
      fail(at, err.message);
    }
    if (!Array.isArray(c.pairs) || c.pairs.length === 0) fail(at, 'names no pairs');
    const values = c.pairs.map((tag) => {
      const pair = pairByTag.get(tag);
      if (!pair) fail(at, `pair ${tag} is not in oneshot.pairs`);
      if (pair.steady !== true) fail(at, `pair ${tag} is not steady: a first request after boot measures start-up, not prefill`);
      const line = lines.get(`${tag}\u0000${mode}`);
      if (!line) fail(at, `no ${mode} line for pair ${tag} in the cited files`);
      if (line.r?.usage?.prompt_tokens !== ins.prompt_tokens)
        fail(at, `pair ${tag} read ${line.r?.usage?.prompt_tokens} prompt tokens, the instrument says ${ins.prompt_tokens}`);
      if (!Number.isFinite(line.r?.ttft_ms)) fail(at, `pair ${tag} carries no ttft_ms`);
      return line.r.ttft_ms;
    });
    const v = r1(median(values));
    for (const stat of ['median_ms', 'p90_ms']) {
      if (v !== c[stat]) fail(at, `${stat} recomputes to ${v}, gate_ceilings says ${c[stat]}`);
    }
    out.push({
      id: `oneshot-${gate}`,
      gate,
      method: 'one-shot',
      label: same[0].label,
      engine: same[0].engine,
      build: o.build,
      instrument: { mode, osl: ins.osl, reps: 1, prompt, prompt_tokens: ins.prompt_tokens },
      median_ms: v,
      p90_ms: v,
      runs: values.length,
      statistic: `median of ${values.length} steady one-shot ${mode} requests, one sample each (first request after a vLLM boot excluded)`,
      box_state: null,
    });
  }
  return out;
}

/**
 * @param {object} manifest a parsed ttft/published.json
 * @param {{ path: string, rawOf: (f:string)=>object, textOf: (f:string)=>string, sha256Of: (f:string)=>string }} io
 *   `path` is the manifest's path in the engine repo; files are relative to its directory
 */
export function buildTtftBaselines(manifest, { path, rawOf, textOf, sha256Of }) {
  const where = path;
  if (manifest?.schema !== 1) fail(where, `schema ${JSON.stringify(manifest?.schema)} is not 1`);
  const checkpoint = manifest.workload?.checkpoint;
  if (typeof checkpoint !== 'string' || !checkpoint) fail(where, 'names no workload.checkpoint');
  if (typeof manifest.box?.name !== 'string') fail(where, 'names no box');
  const series = manifest.series ?? [];
  const seen = new Set();
  const baselines = [];
  for (const s of series) {
    const b = gateRun(manifest, s, `${where} series ${s.id}`, { rawOf, sha256Of });
    baselines.push(b);
  }
  baselines.push(...oneShots(manifest, where, { textOf, sha256Of }, series));
  for (const b of baselines) {
    const key = `${b.gate}\u0000${b.method}`;
    if (seen.has(key)) fail(where, `two ${b.method} baselines for ${b.gate}`);
    seen.add(key);
  }
  return {
    manifest: path,
    checkpoint,
    box: manifest.box.name,
    measured: manifest.status ?? null,
    series_note: manifest.series_note ?? null,
    baselines: baselines.map((b) => ({ ...b, checkpoint, box: manifest.box.name, manifest: path })),
  };
}

/**
 * The engine side of the instrument, read from the checkout the site builds
 * against: the osl the TTFT request asks for, and the sha256 of every
 * committed prompt fixture by the name a record's `params.prompt` uses.
 * @param {{ ttftSource: string, fixtures: Record<string, string> }} input
 *   ttft.rs as text, and fixture name → sha256
 */
export function engineInstrument({ ttftSource, fixtures }) {
  const hits = [...ttftSource.matchAll(/"max_tokens":\s*(\d+)/g)];
  if (hits.length !== 1) fail('crates/bench/src/benchmarks/ttft.rs', `expected one "max_tokens" in the request body, found ${hits.length}`);
  if (Object.keys(fixtures).length === 0) fail('crates/bench/src/benchmarks/ttft/prompts', 'holds no .txt fixture');
  return { osl: Number(hits[0][1]), fixtures };
}
