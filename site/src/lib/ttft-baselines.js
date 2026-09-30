// SPDX-License-Identifier: AGPL-3.0-only

// ttft-baselines.js — may a vLLM TTFT figure be drawn beside a gate's runs?
//
// The TTFT tabs draw the engine's gate records against vLLM on the same
// instrument. "Same instrument" is decided here, axis by axis, and never from a
// name: a vLLM number measured on another prompt, another reply length, the
// other cache state or another sample count is a different measurement, and a
// chart that drew it beside the gate would compare two things while claiming
// one.
//
// The axes, each declared on both sides or it is a difference:
//   prompt   the committed fixture's sha256 (a high-ISL gate names its fixture,
//            `params.prompt: "long-32k"`, and the build hashes that file in the
//            engine checkout), or the synthetic gates' length list;
//   osl      the reply length the TTFT request asks for (ttft.rs max_tokens);
//   mode     cold or warm, from the gate id;
//   reps     samples per run. The high-ISL gates are one-shot, so a vLLM gate
//            run of 12 samples is refused for them and the one-shot pairs are
//            drawn instead: the median of 12 and one request are different
//            statistics of the same prefill.
// `prompt_tokens` is compared only where both sides report it: the server's
// own count of what it received, the check that both engines tokenized the
// same bytes to the same length.
//
// The box is NOT an axis: each vLLM manifest names the one box it ran on and
// the page prints it beside the figure. Gate records move between boxes of one
// Speed class, and BENCH.toml bounds them all against the same vLLM figure.
//
// Three outcomes, never a fourth:
//   paired        one baseline matches every axis; it is drawn
//   refused       baselines exist for this gate and model, none matches; each
//                 is named with the axes that differ, and nothing is drawn
//   not-measured  no vLLM baseline exists for this gate and model; the page
//                 says so, with the manifest's own reason when it gives one
//
// Pure: the generated data is passed in, so the tests can hand it mutated
// copies.

export const TTFT_AXES = Object.freeze(['prompt', 'osl', 'mode', 'reps']);
export const TTFT_STATS = Object.freeze(['median', 'p90']);
const OPTIONAL_AXES = Object.freeze(['prompt_tokens']);

/** `cold` or `warm`, from the gate id. An id that names neither is not a TTFT gate. */
export function modeOf(benchId) {
  const m = /-(cold|warm)(-|$)/.exec(benchId ?? '');
  if (!m) throw new Error(`ttft-baselines: ${JSON.stringify(benchId)} names neither cold nor warm`);
  return m[1];
}

/** The synthetic gates spell their lengths `"256, 1024, 4096"`; one spelling on both sides. */
function lengthsKey(text) {
  const parts = String(text ?? '')
    .split(',')
    .map((p) => p.trim());
  const ns = parts.map(Number);
  if (parts.some((p) => p === '') || ns.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  return `lengths:${ns.join(',')}`;
}

const asString = (v) => (v === null || v === undefined ? null : String(v));

/**
 * The instrument of one gate record, in the axes above.
 * @param {object} record a gate record (gates.generated.json)
 * @param {{osl:number, fixtures:Record<string,string>}} engine the generated engine side
 */
export function gateInstrumentOf(record, engine) {
  const p = record?.params ?? {};
  let prompt = null;
  if (typeof p.prompt === 'string' && p.prompt) {
    const sha = engine.fixtures?.[p.prompt];
    // A fixture the engine checkout does not hold cannot be hashed. It stays
    // named, so the refusal says which prompt was missing, and it can match
    // nothing because no baseline spells a prompt this way.
    prompt = sha ? `sha256:${sha}` : `fixture:${p.prompt} (not in the engine checkout)`;
  } else if (p.prompt_lengths !== undefined) {
    prompt = lengthsKey(p.prompt_lengths);
  }
  return {
    prompt,
    osl: asString(engine.osl),
    mode: modeOf(record.benchmark_id),
    reps: asString(p.repeats),
    prompt_tokens: asString(record.metrics?.prompt_tokens),
  };
}

/** The same axes of a generated baseline. */
export function baselineInstrumentOf(baseline) {
  const i = baseline.instrument ?? {};
  return {
    prompt: asString(i.prompt),
    osl: asString(i.osl),
    mode: asString(i.mode),
    reps: asString(i.reps),
    prompt_tokens: asString(i.prompt_tokens),
  };
}

/**
 * Every axis on which the two instruments differ. Required axes differ when
 * either side leaves them undeclared; optional ones only when both declare
 * them and disagree.
 * @returns {Array<{axis:string, gate:string|null, baseline:string|null}>}
 */
export function differsOf(gate, baseline) {
  const out = [];
  for (const axis of TTFT_AXES) {
    const a = gate[axis] ?? null;
    const b = baseline[axis] ?? null;
    if (a === null || b === null || a !== b) out.push({ axis, gate: a, baseline: b });
  }
  for (const axis of OPTIONAL_AXES) {
    const a = gate[axis] ?? null;
    const b = baseline[axis] ?? null;
    if (a !== null && b !== null && a !== b) out.push({ axis, gate: a, baseline: b });
  }
  return out;
}

const short = (v) => (v?.startsWith('sha256:') ? `sha256:${v.slice(7, 15)}…` : v);

/** `reps 12 → 1, prompt_tokens 32772 → 32768`: vLLM's value first, then the gate's. */
export const describeTtftDiffers = (differs) =>
  differs.map(({ axis, gate, baseline }) => `${axis} ${short(baseline) ?? 'undeclared'} → ${short(gate) ?? 'undeclared'}`).join(', ');

/**
 * The vLLM baseline for one gate and one model, or why there is none.
 *
 * The gate's instrument is read from its NEWEST record: an older run on a
 * retired instrument must not decide what the current one is compared with.
 * `from` is the first run on that same instrument, so the page draws the
 * baseline only across the runs it actually compares with.
 *
 * @param {string} benchId
 * @param {string} model a checkpoint id (record.target_model)
 * @param {object[]} records that gate's records of that model, oldest first
 * @param {{engine:object, manifests:object[]}} data ttft-baselines.generated.json
 */
export function ttftBaselineFor(benchId, model, records, data) {
  const mine = records.filter((r) => r.target_model === model);
  if (mine.length === 0) return { state: 'no-records' };
  const newest = mine[mine.length - 1];
  const gate = gateInstrumentOf(newest, data.engine);
  const manifest = data.manifests.find((m) => m.checkpoint === model) ?? null;
  const candidates = (manifest?.baselines ?? []).filter((b) => b.gate === benchId);
  if (candidates.length === 0) {
    return {
      state: 'not-measured',
      reason: manifest
        ? `${manifest.manifest} holds no vLLM run of ${benchId}.${manifest.series_note ? ` ${manifest.series_note}` : ''}`
        : `No vLLM TTFT manifest exists for ${model} under bench/baselines/.`,
      gate,
    };
  }
  const judged = candidates.map((b) => ({ baseline: b, differs: differsOf(gate, baselineInstrumentOf(b)) }));
  const matched = judged.filter((j) => j.differs.length === 0);
  const refused = judged.filter((j) => j.differs.length > 0);
  if (matched.length > 1) {
    throw new Error(`ttft-baselines: ${matched.length} vLLM baselines match ${benchId} on ${model}; exactly one may be drawn`);
  }
  if (matched.length === 0) return { state: 'refused', refused, gate };
  const key = JSON.stringify(gate);
  const first = mine.find((r) => JSON.stringify(gateInstrumentOf(r, data.engine)) === key);
  return { state: 'paired', baseline: matched[0].baseline, refused, gate, from: first.recorded_at };
}

/** The figure a paired baseline contributes to one statistic's panel. */
export function baselineValue(baseline, stat) {
  if (!TTFT_STATS.includes(stat)) throw new Error(`ttft-baselines: unknown statistic ${JSON.stringify(stat)}`);
  const v = baseline[`${stat}_ms`];
  if (!Number.isFinite(v)) throw new Error(`ttft-baselines: ${baseline.id} has no ${stat}_ms`);
  return v;
}

/**
 * How the engine's number compares with vLLM's, lower being better:
 * `2.61x faster` or `1.40x slower`. Two decimals, so a near tie reads as one.
 */
export function speedup(engineMs, vllmMs) {
  if (!(engineMs > 0) || !(vllmMs > 0)) return null;
  const r = vllmMs / engineMs;
  return r >= 1 ? `${r.toFixed(2)}x faster` : `${(1 / r).toFixed(2)}x slower`;
}
