// SPDX-License-Identifier: AGPL-3.0-only
//
// The Verified section's readings of ladder.generated.json: the headline
// comparison at the top rung, and the conditions the comparison holds under.
// Everything here is computed from the generated ladder at build time, so a
// regenerated ladder rewrites the section instead of leaving prose that
// asserts a margin the repository no longer holds. Nothing is typed.

/**
 * `{name}` placeholders in a copy string, filled from `values`. A placeholder
 * with no value stays visible in braces on purpose, which is easier to see in
 * review than a silent blank.
 */
export function fill(text, values) {
  if (typeof text !== 'string') throw new Error('fill: text must be a string');
  return text.replace(/\{(\w+)\}/g, (m, key) => (key in values ? String(values[key]) : m));
}

const need = (cond, what) => {
  if (!cond) throw new Error(`ladder-facts: ${what}`);
};

/**
 * The headline numbers: the top rung, its ratio against the matched baseline
 * the ladder scores against, and the summary. A ladder that cannot supply them
 * is a build failure, not a blank tile.
 */
export function ladderFacts(ladder) {
  need(Array.isArray(ladder?.rows) && ladder.rows.length > 0, 'the ladder has no rows');
  const rows = [...ladder.rows].sort((a, b) => a.c - b.c);
  const top = rows[rows.length - 1];
  const baseline = top.baselines?.find((b) => b.id === top.best_baseline_id);
  need(baseline, `rung C=${top.c} names no baseline ${top.best_baseline_id}`);
  need(
    [top.c, top.engine, top.ratio_vs_best, baseline.tok_s].every((v) => Number.isFinite(v) && v > 0),
    'the top rung is not a measurement'
  );
  const s = ladder.summary;
  need(
    s && Number.isFinite(s.won) && Number.isFinite(s.rungs) && Number.isFinite(s.min_ratio) && Number.isFinite(s.max_ratio),
    'the summary is incomplete'
  );
  return {
    c: top.c,
    from: rows[0].c,
    ratio: top.ratio_vs_best.toFixed(3),
    engine: top.engine.toFixed(2),
    baseline: baseline.tok_s.toFixed(2),
    baselineLabel: baseline.label,
    won: s.won,
    rungs: s.rungs,
    allWon: s.won === s.rungs,
    min: s.min_ratio.toFixed(3),
    max: s.max_ratio.toFixed(3),
    checkpoint: ladder.workload.checkpoint,
    gpu: ladder.box.gpu,
    aggregate: ladder.aggregate,
  };
}

const dateOf = (utc) => String(utc).slice(0, 10);

/**
 * The conditions of the claim, read from the manifest: the box, the
 * checkpoint, the matched baseline as a dated snapshot, the workload, and
 * the legs that are drawn but not scored. The copy templates come from
 * data.js; the values come from here.
 *
 * @param {object} ladder ladder.generated.json
 * @param {{box:string, checkpoint:string, baseline:string, workload:string, unmatched:string, scope:string}} copy
 * @returns {Array<{label:string, text:string}>}
 */
export function caveatsOf(ladder, copy) {
  const w = ladder.workload;
  const series = ladder.series ?? [];
  const matched = series.find((s) => s.role === 'baseline' && s.parity === 'matched' && s.scope !== 'cost');
  need(matched, 'no matched baseline series');
  const unmatched = series.filter((s) => s.role === 'baseline' && s.parity === 'unmatched');
  const measured = matched.rungs.map((r) => dateOf(r.measured_utc)).sort();
  const values = {
    gpu: ladder.box.gpu,
    boxNote: ladder.box.note,
    checkpoint: w.checkpoint,
    checkpointNote: w.checkpoint_note,
    baselineLabel: matched.label,
    baselineEngine: matched.engine,
    baselineSpeculation: matched.speculation,
    baselineFrom: measured[0],
    baselineTo: measured[measured.length - 1],
    isl: w.isl_tokens,
    osl: w.osl_tokens,
    reps: w.reps,
    warmup: w.warmup,
    temperature: w.temperature,
    seed: w.seed,
    unmatchedLabels: unmatched.map((s) => s.label).join(', '),
    unmatchedDeltas: unmatched.flatMap((s) => s.parity_deltas ?? []).join(', '),
  };
  const out = [
    { label: copy.box.label, text: fill(copy.box.text, values) },
    { label: copy.checkpoint.label, text: fill(copy.checkpoint.text, values) },
    { label: copy.baseline.label, text: fill(copy.baseline.text, values) },
    { label: copy.workload.label, text: fill(copy.workload.text, values) },
  ];
  if (unmatched.length > 0) out.push({ label: copy.unmatched.label, text: fill(copy.unmatched.text, values) });
  out.push({ label: copy.scope.label, text: fill(copy.scope.text, values) });
  return out;
}
