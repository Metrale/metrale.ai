// SPDX-License-Identifier: AGPL-3.0-only

// limit-ledger.mjs — the dated ledger of every floor and ceiling a gate declares.
//
//   ledger[gate][checkpoint][metric][min|max] = [{since, value}, …]
//
// gen-gates.mjs observes each BENCH.toml version git can see, plus the working
// tree, and folds those observations into the ledger the previous build wrote.
// The ledger is the memory: git may see one commit of a file's history or a
// hundred, and a shallow or squashed history must never cost an entry an
// earlier build recorded. Pure, so the fold is tested on its own
// (limit-ledger.test.js) rather than through a git checkout.

const BOUNDS = ['min', 'max'];

/**
 * The previous generation's ledger, keeping only well-formed dated entries: a
 * finite `since` and a finite or null `value`. Anything else is dropped rather
 * than trusted, since it can only lose a date, never invent one.
 * @param {unknown} prev  `gate_limits` of the previous gates.generated.json
 */
export function cleanLedger(prev) {
  const out = {};
  for (const [gate, byCk] of Object.entries(prev ?? {})) {
    for (const [ck, metrics] of Object.entries(byCk ?? {})) {
      for (const [metric, row] of Object.entries(metrics ?? {})) {
        for (const bound of BOUNDS) {
          const series = row?.[bound];
          if (!Array.isArray(series)) continue;
          const clean = series.filter((e) => Number.isFinite(e?.since) && (e.value === null || Number.isFinite(e.value)));
          if (clean.length)
            (((out[gate] ??= {})[ck] ??= {})[metric] ??= {})[bound] = clean.map((e) => ({ since: e.since, value: e.value }));
        }
      }
    }
  }
  return out;
}

/**
 * Fold observations into the prior ledger.
 *
 * @param {object} prior         a cleaned ledger (see cleanLedger)
 * @param {Array<{table: object, since: number}>} observations
 *   each a declared-limits table (bench-toml.mjs#declaredLimitsOf) and the
 *   time it was in force from: one per committed version git can see, and one
 *   for the working tree
 * @param {object} declared      the table in force now (mergeDeclaredLimits)
 * @param {number} now           when `declared` took effect: a bound the
 *   ledger carries that `declared` no longer names is withdrawn from here
 * @returns {object} the ledger, each series sorted by `since` with every run
 *   of one value collapsed to the earliest date it was seen
 */
export function foldLedger(prior, observations, declared, now) {
  const ledger = cleanLedger(prior);
  const observe = (gate, ck, metric, bound, since, value) => {
    ((((ledger[gate] ??= {})[ck] ??= {})[metric] ??= {})[bound] ??= []).push({ since, value });
  };
  for (const { table, since } of observations) {
    for (const [gate, byCk] of Object.entries(table)) {
      for (const [ck, metrics] of Object.entries(byCk)) {
        for (const [metric, lim] of Object.entries(metrics)) {
          for (const bound of BOUNDS) if (lim[bound] !== undefined) observe(gate, ck, metric, bound, since, lim[bound]);
        }
      }
    }
  }

  // A bound the ledger still carries but no file declares any more is
  // withdrawn from the newest observation on: its last entry becomes null.
  for (const [gate, byCk] of Object.entries(ledger)) {
    for (const [ck, metrics] of Object.entries(byCk)) {
      for (const [metric, row] of Object.entries(metrics)) {
        for (const bound of BOUNDS) {
          const series = row[bound];
          if (!series) continue;
          const last = [...series].sort((a, b) => a.since - b.since).at(-1);
          if (declared[gate]?.[ck]?.[metric]?.[bound] === undefined && last.value !== null) series.push({ since: now, value: null });
        }
      }
    }
  }

  // Sort, then collapse each run of one value to the earliest date it was seen.
  for (const byCk of Object.values(ledger)) {
    for (const metrics of Object.values(byCk)) {
      for (const row of Object.values(metrics)) {
        for (const bound of BOUNDS) {
          if (!row[bound]) continue;
          const sorted = row[bound].sort((a, b) => a.since - b.since || String(a.value).localeCompare(String(b.value)));
          const collapsed = [];
          for (const e of sorted) {
            if (collapsed.length && collapsed[collapsed.length - 1].value === e.value) continue;
            collapsed.push({ since: e.since, value: e.value });
          }
          row[bound] = collapsed;
        }
      }
    }
  }
  return ledger;
}
