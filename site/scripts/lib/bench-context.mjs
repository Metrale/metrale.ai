// SPDX-License-Identifier: AGPL-3.0-only

// bench-context.mjs — what a BENCH.toml entry says about the context it is
// measured at and the vLLM figure it is read against.
//
//   gate_context[gate][checkpoint] = { model, label, max_model_len, targets, target_context, target_note, caveats }
//
//   model          the kernels/gb10/<model>/ directory that declares the entry
//   label          the entry's `label`, or null
//   max_model_len  `[benchmarks.serve_overrides] max_model_len` as a number, or
//                  null when the entry serves the recipe's own context
//   targets        `targets = { <metric> = <number> }`: the vLLM reference per
//                  metric. No verdict reads it; the page draws it as a bar.
//   target_context `target_max_model_len`: the context of the vLLM serve behind the
//                  targets, or null. The page qualifies a row served at another
//                  context; no verdict reads it. Refused without targets or when
//                  not a positive integer.
//   target_note    `target_note`: the account of the targets written for this page,
//                  or null. Refused without targets. The entry's engineering `note`
//                  is never read: it is written for the engine, not for this page.
//   caveats        `target_caveats = { <metric> = "<text>" }`: a target that is not a
//                  clean bar. The page marks it beside the target and links the mark
//                  to the target_note, so a caveat on an entry with no target_note is
//                  refused, as is one naming no target or with no text.
//
// Only the CURRENT files are read: a target is a reference for today's page,
// not a limit a past record was judged against, so it has no dated ledger.
// Anything malformed is refused rather than skipped: a context read wrongly
// puts a cell in the wrong row of the grid, and a dropped target reads as
// "vLLM not measured" when it was.

const isTable = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const DIGITS = /^[1-9][0-9]*$/;

/**
 * The context and targets one parsed BENCH.toml declares.
 *
 * @param {Record<string, unknown>} parsed output of `parseToml`
 * @param {string} model the kernels/gb10/<model> directory name
 * @param {string} [source] for the error message
 */
export function declaredContextOf(parsed, model, source = 'BENCH.toml') {
  const out = {};
  for (const entry of parsed.benchmarks ?? []) {
    const {
      gate,
      checkpoint,
      label,
      target_note: account,
      serve_overrides: serve,
      targets,
      target_caveats: caveats,
      target_max_model_len: refContext,
    } = entry;
    if (typeof gate !== 'string' || typeof checkpoint !== 'string') {
      throw new TypeError(`${source}: a [[benchmarks]] entry lacks a string gate or checkpoint`);
    }
    if (label !== undefined && typeof label !== 'string') throw new TypeError(`${source}: ${gate} label is not a string`);
    if (account !== undefined && typeof account !== 'string') throw new TypeError(`${source}: ${gate} target_note is not a string`);
    let maxModelLen = null;
    if (isTable(serve) && serve.max_model_len !== undefined) {
      if (typeof serve.max_model_len !== 'string' || !DIGITS.test(serve.max_model_len)) {
        throw new TypeError(`${source}: ${gate} serve_overrides.max_model_len is not a positive integer string`);
      }
      maxModelLen = Number(serve.max_model_len);
    }
    const bars = {};
    if (targets !== undefined) {
      if (!isTable(targets)) throw new TypeError(`${source}: ${gate} targets is not a table`);
      for (const [metric, value] of Object.entries(targets)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new TypeError(`${source}: ${gate} targets.${metric} is not a finite number`);
        }
        bars[metric] = value;
      }
    }
    if (refContext !== undefined) {
      if (!Number.isSafeInteger(refContext) || refContext <= 0) {
        throw new TypeError(`${source}: ${gate} target_max_model_len is not a positive integer`);
      }
      if (Object.keys(bars).length === 0) {
        throw new TypeError(`${source}: ${gate} declares target_max_model_len with no targets for it to describe`);
      }
    }
    const flagged = {};
    if (caveats !== undefined) {
      if (!isTable(caveats)) throw new TypeError(`${source}: ${gate} target_caveats is not a table`);
      for (const [metric, text] of Object.entries(caveats)) {
        if (!Object.hasOwn(bars, metric)) throw new TypeError(`${source}: ${gate} target_caveats.${metric} names no target`);
        if (typeof text !== 'string' || text.trim() === '') {
          throw new TypeError(`${source}: ${gate} target_caveats.${metric} is not a non-empty string`);
        }
        flagged[metric] = text;
      }
      if (Object.keys(flagged).length > 0 && !account?.trim()) {
        throw new TypeError(`${source}: ${gate} has target caveats but no target_note for them to point to`);
      }
    }
    if (account && Object.keys(bars).length === 0) {
      throw new TypeError(`${source}: ${gate} declares target_note with no targets for it to describe`);
    }
    const byCheckpoint = (out[gate] ??= {});
    if (byCheckpoint[checkpoint]) throw new TypeError(`${source}: ${gate} is declared for ${checkpoint} twice`);
    byCheckpoint[checkpoint] = {
      model,
      label: label ?? null,
      max_model_len: maxModelLen,
      targets: bars,
      target_context: refContext ?? null,
      target_note: account?.trim() ? account : null,
      caveats: flagged,
    };
  }
  return out;
}

/** Merge per-file context tables; one (gate, checkpoint) in two files is refused. */
export function mergeDeclaredContext(tables) {
  const out = {};
  for (const [source, table] of tables) {
    for (const [gate, byCheckpoint] of Object.entries(table)) {
      const target = (out[gate] ??= {});
      for (const [checkpoint, context] of Object.entries(byCheckpoint)) {
        if (target[checkpoint]) throw new TypeError(`${source}: ${gate} for ${checkpoint} is already declared elsewhere`);
        target[checkpoint] = context;
      }
    }
  }
  return out;
}
