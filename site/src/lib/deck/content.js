// SPDX-License-Identifier: AGPL-3.0-only

// Deck copy and derived figures. Same rule as the rest of the site: nothing
// numeric is typed here. Every ratio, rung count, floor, digest and command
// string is read out of the generated records (ladder, benchmarks, gates,
// live), so a re-run of `npm run generate` moves the slides too, and a lost
// rung changes the claim instead of leaving a stale one on a page shown to an
// investor.

import ladder from '$lib/ladder.generated.json';
import bench from '$lib/benchmarks.generated.json';
import gates from '$lib/gates.generated.json';
import live from '$lib/live.generated.json';
import { declaredLimit } from '$lib/gate-limits.js';
import { githubUrl } from '$lib/data.js';

const subject = ladder.series.find((s) => s.role === 'subject');
const matched = ladder.series.find((s) => s.id === 'vllm-mtp');
const unmatched = ladder.series.find((s) => s.id === 'vllm-nospec');

const pct = (r) => `${((r - 1) * 100).toFixed(1)}%`;
const x = (r) => `${r.toFixed(3)}×`;
const rows = [...ladder.rows].sort((a, b) => a.c - b.c);
const top = rows[rows.length - 1];
const bestOf = (r) => r.baselines.find((b) => b.id === r.best_baseline_id)?.tok_s ?? 0;

// The engine commit the site is pinned to (site/engine.ref), not the commit that last changed a
// data file: gates.generated.json is regenerated from the pinned checkout on every build.
export const stamp = `engine ${gates.generated_sha} · ${gates.generated_date}`;

export const claim = {
  engine: subject.engine,
  baseline: matched.label,
  baselineVersion: matched.engine,
  unmatchedLabel: unmatched.label,
  checkpoint: ladder.workload.checkpoint,
  checkpointNote: ladder.workload.checkpoint_note,
  box: ladder.box.gpu,
  boxName: ladder.box.name,
  rungs: ladder.summary.rungs,
  won: ladder.summary.won,
  allWon: ladder.summary.all_won,
  min: x(ladder.summary.min_ratio),
  max: x(ladder.summary.max_ratio),
  minPct: pct(ladder.summary.min_ratio),
  maxPct: pct(ladder.summary.max_ratio),
  concurrencies: ladder.concurrencies.join(', '),
  first: ladder.concurrencies[0],
  last: ladder.concurrencies.at(-1),
  aggregate: ladder.aggregate,
  isl: ladder.workload.isl_tokens,
  osl: ladder.workload.osl_tokens,
  seed: ladder.workload.seed,
  temperature: ladder.workload.temperature,
  reps: ladder.workload.reps,
  warmup: ladder.workload.warmup,
  harnessFile: ladder.workload.harness,
  // The --concs argument, from the same rung list the chart is drawn from, so a
  // lost rung shortens the command as well as the ladder.
  concsArg: ladder.concurrencies.join(','),
  // The driver hash the published engine legs carry, beside the one a reader
  // will actually get from the tree. Both derived: the first is the manifest
  // key whose note names the engine legs, the second is hashed from the file
  // at build time.
  harnessShaEngine: Object.keys(ladder.harness_shas).find((k) => /Engine legs/i.test(ladder.harness_shas[k])),
  harnessShaRepo: ladder.harness_repo_sha256.slice(0, 10),
  resultsUrl: ladder.results_doc_url,
  resultsDoc: ladder.results_doc,
  // The commit a reader checks out to build the measured tree, and the note
  // the record attaches to it.
  engineSha: subject.build_public,
  engineShaNote: subject.build_note,
  // The baseline image, by digest. `build` is "<image>:<tag> @ sha256:…"; the
  // digest is the half a reader pins, the tag is the half they must not.
  baselineImage: matched.build.split('@')[0].trim(),
  baselineDigest: matched.build.split('@')[1]?.trim() ?? '',
  speculation: subject.speculation,
  baselineSpeculation: matched.speculation,
};

// The top rung, in absolute terms: the pair of numbers a reader will look for
// first, so they are printed once here and read from the same row the chart
// draws.
export const proof = {
  topC: top.c,
  topEngine: top.engine.toFixed(2),
  topBaseline: bestOf(top).toFixed(2),
  topRatio: x(top.ratio_vs_best),
  firstC: rows[0].c,
  firstEngine: rows[0].engine.toFixed(2),
  firstBaseline: bestOf(rows[0]).toFixed(2),
  firstRatio: x(rows[0].ratio_vs_best),
  // Whether the matched baseline's top rung is below its previous one: the
  // mechanism slide only makes that observation when the record supports it.
  prevC: rows.at(-2).c,
  baselineFallsAtTop: rows.length > 1 && bestOf(top) < bestOf(rows.at(-2)),
};

// Step 4's serve command, rendered FROM THE RECORD rather than hand-abridged.
//
// An abridged list omitted thirteen flags, six of which are kernel and
// scheduling knobs whose defaults are the OPPOSITE of the certified values.
// Serving that way and then running the ladder measures a differently
// configured engine and lands well under the chart, the walkthrough
// manufacturing evidence against its own claim. Wrapped here rather than in
// the component so the command cannot drift from the record.
const argvLines = (argv, { width = 66, indent = '  ', breakAnywhere = false } = {}) => {
  const out = [];
  let line = '';
  for (const tok of argv) {
    // In a CLI a value belongs to the flag before it, so only a `--` token may
    // start a new line. An env prefix is all standalone assignments, so any
    // token may.
    const canBreak = breakAnywhere || tok.startsWith('--');
    const joined = line ? `${line} ${tok}` : tok;
    if (line && joined.length > width && canBreak) {
      out.push(line);
      line = indent + tok;
    } else {
      line = joined;
    }
  }
  if (line) out.push(line);
  return out;
};

export const serve = {
  env: argvLines(subject.env.split(/\s+/), { breakAnywhere: true, indent: '' }),
  cli: argvLines(subject.cli.split(/\s+/)),
};

// The flags in the certified command whose defaults are the opposite of the
// certified value: named from the command itself, so the warning beside it
// names what the command actually carries.
const KNOBS = [
  '--ssm-h-dtype',
  '--gdn-fused-norm',
  '--ssm-batched-recurrent',
  '--ssm-tail-midchunk',
  '--mtp-gate',
  '--prefill-varlen-batch',
];
export const serveKnobs = KNOBS.filter((k) => subject.cli.split(/\s+/).includes(k));

// The K ladder the subject ran, read out of its environment rather than typed.
export const kLadder = subject.env.match(/METRALE_MTP_K_LADDER=(\S+)/)?.[1] ?? '';

// The rungs won by a margin small enough that ordinary run-to-run drift could
// swallow them. 1.05 is the cutoff because the campaign's own re-measurements
// moved rungs by ~2-4%.
const FRAGILE_MAX_RATIO = 1.05;
const fragileRows = rows.filter((r) => r.ratio_vs_best < FRAGILE_MAX_RATIO);

export const fragile = {
  count: fragileRows.length,
  rungs: fragileRows.map((r) => `C=${r.c}`).join(', '),
  min: fragileRows.length ? x(Math.min(...fragileRows.map((r) => r.ratio_vs_best))) : '',
  max: fragileRows.length ? x(Math.max(...fragileRows.map((r) => r.ratio_vs_best))) : '',
};

// The fingerprint an analyst needs before they can start. Third element is the
// reason the value matters, not a restatement of it.
export const fingerprint = [
  ['box', `${ladder.box.name} — ${ladder.box.gpu}`, ladder.box.note],
  ['checkpoint', ladder.workload.checkpoint, ladder.workload.checkpoint_note],
  ['harness', ladder.workload.harness, 'campaign driver for the published ladder, sha256 pinned per leg'],
  [
    'engine',
    `${subject.engine} @ ${subject.build_public}`,
    'the certified commit as the record names it; every gate record names its own in git_sha',
  ],
  ['baseline', `${matched.engine}, ${claim.baselineImage}`, 'pinned by digest in Step 3, never by tag'],
  ['aggregate', ladder.aggregate, 'the figure every chart and table on this page prints'],
];

// Parity. Every axis is pinned identically on both engines; the value column
// says to what.
export const parity = [
  ['context', '2048 both'],
  ['batch cap', '128 both'],
  ['gpu util', '0.85 both'],
  ['kv cache', 'fp8 both'],
  ['prefix cache', 'on both'],
  ['speculation', 'MTP K=4 both'],
  ['thinking', ladder.workload.thinking],
  ['sampling', ladder.workload.sampling_parity],
  [
    'prompts',
    `ISL ${ladder.workload.isl_tokens} / OSL ${ladder.workload.osl_tokens}, seed ${ladder.workload.seed}, temp ${ladder.workload.temperature}`,
  ],
  ['harness', 'one script, both legs, back to back'],
];

// Heiser's benchmarking-crimes taxonomy, answered. Rows that are still open
// stay open — see Audit.svelte.
export const audit = [
  {
    state: 'clear',
    risk: 'Unfairly tuned competitor',
    answer: `Baseline is vLLM with MTP K=4 and fp8 KV, not vLLM at defaults. The default-config number (${unmatched.label}) is published beside it and is not what we claim against.`,
  },
  {
    state: 'clear',
    risk: 'Selective data range',
    answer: `All ${ladder.summary.rungs} rungs published, C=${claim.first} to ${claim.last}, including the ones we win by ${ladder.summary.min_ratio.toFixed(3)}×.`,
  },
  {
    state: 'clear',
    risk: 'No statistical treatment',
    answer: `${ladder.workload.reps} timed reps per rung with the spread printed; the C=32 A/B publishes every rep so the distributions can be checked for overlap.`,
  },
  {
    state: 'clear',
    risk: 'Relative numbers only',
    answer: 'Absolute tok/s for both engines at every rung, two decimals, matching the repository record byte for byte.',
  },
  {
    state: 'clear',
    risk: 'Incomplete platform spec',
    answer: 'GPU SKU, driver, container digest, harness sha256, engine build SHA and full launch flags for both legs.',
  },
  {
    state: 'clear',
    risk: 'Microbenchmark as end-to-end',
    answer: 'Every number is served over the OpenAI HTTP path with a real client. No kernel-level timing is claimed as serving throughput.',
  },
  {
    state: 'clear',
    risk: 'Best-of instead of representative',
    answer: `Re-measuring C=8 on a later build came out higher than the certified ${rows.find((r) => r.c === 8)?.ratio_vs_best.toFixed(3) ?? ''}×; the certified figure is what is published. Every rung is quoted as a same-day A/B rather than against a stored number.`,
  },
  {
    state: 'open',
    risk: 'Single hardware, single model',
    answer:
      'One GB10 box, one 27B NVFP4 checkpoint. We publish what we measured there and label it as such; no figure here is an extrapolation to another SKU or model class.',
  },
  {
    state: 'open',
    risk: 'Fleet drift over time',
    answer:
      'A fleet-wide shift moved both engines at C=32. The margin narrowed and held; the differential is published rather than the favourable snapshot.',
  },
  {
    state: 'open',
    risk: 'Not third-party audited',
    answer:
      'Everything here is self-run. That is why the artifacts are pinned to the level an external auditor would ask for, and why we would rather you re-ran it than took it.',
  },
];

export const links = {
  results: ladder.results_doc_url,
  repo: githubUrl,
  repoLabel: githubUrl.replace('https://', ''),
  gateDoc: bench.gate_doc,
};

// What CI holds between releases, from the live counts the front page prints
// and the gate limits the engine commits.
export const gateFacts = {
  registered: live.gates.registered,
  committed: live.gates.records,
  signed: live.gates.signed,
  concurrencyPass: live.gates.concurrencyPass,
  concurrencyRecords: live.gates.concurrencyRecords,
  newest: live.gates.newest,
  methodology: bench.methodology,
};

// The floors the concurrency-sweep gate holds for this checkpoint, as declared
// today. A missing declaration is rendered as missing, never as a number.
const SWEEP = 'concurrency-sweep';
const RUNG_MIN = /^c(\d+)_aggregate_tok_s$/;
const RUNG_JOULES = (c) => `c${c}_gpu_rail_joules_per_token`;
const now = Math.floor(Date.now() / 1000);
const limitTable = gates.gate_limits ?? {};
const declared = (key) => declaredLimit(limitTable, SWEEP, claim.checkpoint, key, now);
const sweepRow = limitTable[SWEEP]?.[claim.checkpoint] ?? {};
const floorRungs = Object.keys(sweepRow)
  .map((k) => RUNG_MIN.exec(k))
  .filter(Boolean)
  .map((m) => +m[1])
  .sort((a, b) => a - b);

export const floors = {
  declared: floorRungs.length > 0,
  rows: floorRungs.map((c) => ({
    c,
    tokS: declared(`c${c}_aggregate_tok_s`).min,
    jPerTok: declared(RUNG_JOULES(c)).max,
  })),
  peak: declared('peak_aggregate_tok_s').min,
  minCompletion: declared('min_completion_tokens').min,
  vacuous: declared('vacuous_cells').max,
};

// The gates that judge something other than speed, by id, so the deck can say
// what else the certify command runs without claiming a score it does not
// carry. Only ids the engine actually registers are listed.
const QUALITY_GATES = ['bfcl-subset', 'agentic-webserver', 'ttft-warm-gate', 'ttft-cold-gate', 'serve-matrix'];
export const qualityGates = QUALITY_GATES.filter((id) => gates.registered.includes(id));
