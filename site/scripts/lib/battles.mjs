// SPDX-License-Identifier: AGPL-3.0-only

// battles.mjs — the engine's bench/battles.toml, read for the benchmarks page.
//
//   battles = [{ id, name, gate_prefixes: [string], metrics: [{ pattern, better }], note }]
//
// A battle is a family of gates read together against the reference figure each
// BENCH.toml entry declares (`targets`). The engine's own reader
// (crates/bench/src/gate/battle_load.rs) is the authority; this one refuses the
// same malformed shapes, so the page never draws a battle the engine would not
// load. `{n}` in a pattern stands for one or more digits.

const isTable = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;
const BETTER = new Set(['lower', 'higher']);

/** Why a metric pattern is malformed, or null. */
export function patternProblem(pattern) {
  if (!isText(pattern)) return 'an empty metric pattern';
  const rest = pattern.replace('{n}', '');
  if (rest.includes('{') || rest.includes('}')) return `metric pattern ${JSON.stringify(pattern)} may hold one {n} and no other brace`;
  return null;
}

/**
 * The battles one parsed battles.toml declares.
 *
 * @param {Record<string, unknown>} parsed output of `parseToml`
 * @param {string} [source] for the error message
 */
export function battlesOf(parsed, source = 'bench/battles.toml') {
  if (parsed.schema !== 1) throw new TypeError(`${source}: schema is ${JSON.stringify(parsed.schema)}, this reader knows 1`);
  if (!Array.isArray(parsed.battles) || parsed.battles.length === 0) throw new TypeError(`${source}: declares no [[battles]]`);
  const seen = new Set();
  return parsed.battles.map((b, i) => {
    if (!isTable(b)) throw new TypeError(`${source}: battle ${i} is not a table`);
    const { id, name, gate_prefixes: prefixes, metrics, note } = b;
    if (!isText(id) || !isText(name)) throw new TypeError(`${source}: battle ${i} lacks an id or a name`);
    if (seen.has(id)) throw new TypeError(`${source}: battle ${id} is declared twice`);
    seen.add(id);
    if (!Array.isArray(prefixes) || prefixes.length === 0 || !prefixes.every(isText)) {
      throw new TypeError(`${source}: ${id} gate_prefixes is not a list of non-empty strings`);
    }
    if (!Array.isArray(metrics) || metrics.length === 0) throw new TypeError(`${source}: ${id} declares no metrics`);
    const rules = metrics.map((m) => {
      if (!isTable(m)) throw new TypeError(`${source}: ${id} has a metric that is not a table`);
      const problem = patternProblem(m.pattern);
      if (problem) throw new TypeError(`${source}: ${id}: ${problem}`);
      if (!BETTER.has(m.better)) throw new TypeError(`${source}: ${id} ${m.pattern} better is neither lower nor higher`);
      return { pattern: m.pattern, better: m.better };
    });
    if (note !== undefined && typeof note !== 'string') throw new TypeError(`${source}: ${id} note is not a string`);
    return { id, name, gate_prefixes: [...prefixes], metrics: rules, note: note ?? '' };
  });
}
