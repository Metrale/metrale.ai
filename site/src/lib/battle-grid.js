// SPDX-License-Identifier: AGPL-3.0-only

// battle-grid.js — a model's named battles (the engine's bench/battles.toml):
// each cell is the newest record of the model on one gate, one metric, against
// the vLLM figure its BENCH.toml entry declares (`targets`), with the verdict,
// the margin, the cell's own regression limit and the margin over every
// record of the model on that gate.
//
// The verdict and margin follow the engine's `gate::battle::judge` exactly:
//   win   ours is better than the target in the battle's direction
//   loss  ours is worse; tie when equal
//   margin_pct = (target - ours) / target * 100 when lower is better,
//                (ours - target) / target * 100 when higher is; negative is behind
// A battle is won only when it has a cell and every cell is a win, so a cell
// with no record keeps the battle open. A cell can be inside its own limit (the
// regression ratchet) and still lose: both are shown.
//
// Which cells exist is read from the data, never named here:
//   - a gate is in the battle whose `gate_prefixes` its id starts with;
//   - a cell is a `targets` key of that gate's entry that a battle pattern
//     matches (`{n}` = one or more digits);
//   - the grid's row is the gate's mode (cold/warm, when its id names one) and
//     served context; its column is the `{n}` of the pattern, or, for a metric
//     with no `{n}`, the prompt length the gate's limits pin (`prompt_tokens`).
// A battle is SHOWN for a model only once one of its cells has a record, the
// rule context-grid.js uses: vLLM figures with nothing of ours beside them
// would read as a result.
//
// A target its entry flags (`target_caveats`) carries the caveat on its cell,
// and the grid carries the notes those caveats point to (target-notes.js).
// Neither moves a verdict, a margin or a count.
// Each cell carries the context of the vLLM serve behind its target, and each
// row the qualifiers that context implies for it (reference-serve.js); they too
// move nothing.
//
// Pure: everything is passed in, so the tests can hand it any shape.

import { rowQualifiers } from './reference-serve.js';
import { caveatNotes } from './target-notes.js';

/** The `{n}` a pattern captures from `metric`: a number, `true` for a pattern with no `{n}` that matches, or null. */
export function captureOf(pattern, metric) {
  const at = pattern.indexOf('{n}');
  if (at < 0) return pattern === metric ? true : null;
  const pre = pattern.slice(0, at);
  const post = pattern.slice(at + 3);
  if (!metric.startsWith(pre) || !metric.endsWith(post) || metric.length < pre.length + post.length + 1) return null;
  const digits = metric.slice(pre.length, metric.length - post.length);
  return /^[0-9]+$/.test(digits) ? Number(digits) : null;
}

/** The battle a gate id belongs to, or null; a gate two battles claim is refused. */
export function battleOf(battles, gate) {
  const hits = battles.filter((b) => b.gate_prefixes.some((p) => gate.startsWith(p)));
  if (hits.length > 1) throw new Error(`battle-grid: ${gate} is claimed by ${hits.map((b) => b.id).join(' and ')}`);
  return hits[0] ?? null;
}

/** As the engine judges a cell: verdict and margin, or nulls with no value. */
export function judge(value, target, better) {
  if (!Number.isFinite(value)) return { verdict: null, margin_pct: null };
  const ahead = better === 'lower' ? target - value : value - target;
  const verdict = ahead > 0 ? 'win' : ahead < 0 ? 'loss' : 'tie';
  return { verdict, margin_pct: (ahead / target) * 100 };
}

const modeOf = (gate) => /-(cold|warm)(-|$)/.exec(gate)?.[1] ?? null;
const MODE_ORDER = { cold: 0, warm: 1 };

/**
 * @param {object} input
 * @param {object[]} input.battles  gates.generated.json#battles
 * @param {object} input.context    gates.generated.json#gate_context
 * @param {(gate: string) => object[]} input.recordsFor oldest first
 * @param {(record: object, metric: string) => {min: number|null, max: number|null}} input.limitFor
 * @param {(gate: string, checkpoint: string, metric: string) => {min: number|null, max: number|null}} input.declaredLimit
 * @param {(v: number, limit: object) => string|null} input.violationOf
 * @returns {Map<string, object[]>} per checkpoint, its battles in battles.toml order
 */
export function battleSections({ battles, context, recordsFor, limitFor, declaredLimit, violationOf }) {
  const cellsBy = new Map();
  for (const [gate, perCheckpoint] of Object.entries(context ?? {})) {
    const battle = battleOf(battles, gate);
    if (!battle) continue;
    for (const [checkpoint, declared] of Object.entries(perCheckpoint)) {
      for (const [metric, target] of Object.entries(declared.targets)) {
        const rule = battle.metrics.map((r) => ({ ...r, n: captureOf(r.pattern, metric) })).find((r) => r.n !== null);
        if (!rule) continue;
        const column = rule.n === true ? (declaredLimit(gate, checkpoint, 'prompt_tokens').min ?? metric) : rule.n;
        const key = `${checkpoint}\u0000${battle.id}`;
        if (!cellsBy.has(key)) cellsBy.set(key, { checkpoint, battle, cells: [], declared: new Map() });
        const group = cellsBy.get(key);
        group.declared.set(gate, declared);
        group.cells.push({
          gate,
          metric,
          target,
          caveat: declared.caveats?.[metric] ?? null,
          target_context: declared.target_context ?? null,
          better: rule.better,
          mode: modeOf(gate),
          context: declared.max_model_len,
          column,
        });
      }
    }
  }
  const out = new Map();
  for (const b of battles) {
    for (const { checkpoint, battle, cells, declared } of [...cellsBy.values()].filter((v) => v.battle.id === b.id)) {
      const judged = cells.map((c) => cellOf(c, checkpoint, { recordsFor, limitFor, declaredLimit, violationOf }));
      if (!judged.some((c) => c.record)) continue;
      if (!out.has(checkpoint)) out.set(checkpoint, []);
      const notes = caveatNotes([...declared].map(([gate, d]) => ({ gate, ...d })));
      out.get(checkpoint).push(gridOf(battle, judged, notes));
    }
  }
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}

function cellOf(c, checkpoint, { recordsFor, limitFor, declaredLimit, violationOf }) {
  const mine = recordsFor(c.gate).filter((r) => r.target_model === checkpoint);
  const record = mine.at(-1) ?? null;
  const raw = record?.metrics?.[c.metric];
  const value = Number.isFinite(raw) ? raw : null;
  const { verdict, margin_pct } = judge(value, c.target, c.better);
  const limit = record ? limitFor(record, c.metric) : declaredLimit(c.gate, checkpoint, c.metric);
  const bounded = limit.min !== null || limit.max !== null;
  const ratchet = value === null ? 'no-value' : !bounded ? 'unbounded' : violationOf(value, limit) === null ? 'within' : 'breach';
  const trend = mine
    .filter((r) => Number.isFinite(r.metrics?.[c.metric]))
    .map((r) => ({
      recorded_at: r.recorded_at,
      git_sha: r.git_sha,
      margin_pct: judge(r.metrics[c.metric], c.target, c.better).margin_pct,
    }));
  return {
    ...c,
    record,
    value,
    verdict: record ? (verdict ?? 'not-reported') : 'no-record',
    margin_pct,
    limit,
    ratchet,
    trend,
  };
}

function gridOf(battle, cells, notes) {
  const rowKey = (c) => `${c.mode ?? ''}\u0000${c.context ?? ''}`;
  const rows = [...new Map(cells.map((c) => [rowKey(c), { mode: c.mode, context: c.context }])).values()].sort(
    (a, b) => (MODE_ORDER[a.mode] ?? -1) - (MODE_ORDER[b.mode] ?? -1) || (a.context ?? 0) - (b.context ?? 0)
  );
  const columns = [...new Set(cells.map((c) => c.column))].sort((a, b) =>
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  );
  const count = (v) => cells.filter((c) => c.verdict === v).length;
  return {
    id: battle.id,
    name: battle.name,
    note: battle.note,
    notes,
    metrics: battle.metrics,
    better: [...new Set(cells.map((c) => c.better))],
    columns,
    rows: rows.map((r) => {
      const own = cells.filter((c) => rowKey(c) === rowKey(r));
      return {
        ...r,
        qualifiers: rowQualifiers(
          r.context,
          own.map((c) => c.target_context)
        ),
        cells: columns.map((column) => own.find((c) => c.column === column) ?? null),
      };
    }),
    counts: {
      cells: cells.length,
      win: count('win'),
      loss: count('loss'),
      tie: count('tie'),
      open: count('no-record') + count('not-reported'),
    },
    all_cells_win: cells.length > 0 && cells.every((c) => c.verdict === 'win'),
  };
}

/** A column head: `C=8` for a concurrency rung (`c{n}_…`), else the prompt length. */
export function columnLabel(battle, column) {
  if (typeof column !== 'number') return String(column);
  const perRung = battle.metrics.some((m) => m.pattern.startsWith('c{n}'));
  if (perRung) return `C=${column}`;
  return `${column % 1024 === 0 ? `${column / 1024}k` : column}-token prompt`;
}

/** The unit a metric is printed in, from its key: the one reader for both grids. */
export function unitOf(metric) {
  if (/(^|_)tok_s$/.test(metric)) return 'tok/s';
  if (/(^|_)ms(_|$)/.test(metric)) return 'ms';
  if (/(^|_)s(_|$)/.test(metric)) return 's';
  return '';
}

/**
 * One block per checkpoint that has a context section or a battle, sorted:
 * `{checkpoint, context: section|null, battles: grid[]}`.
 */
export function modelBlocks(contextSections, battleSections) {
  const names = new Set([...contextSections.map((s) => s.checkpoint), ...battleSections.keys()]);
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((checkpoint) => ({
      checkpoint,
      context: contextSections.find((s) => s.checkpoint === checkpoint) ?? null,
      battles: battleSections.get(checkpoint) ?? [],
    }));
}

/**
 * The chip beside a battle's name: won only when every cell wins; with no loss,
 * what keeps it open; else how many cells lose.
 *
 * @returns {{text: string, won: boolean}}
 */
export function battleChip({ all_cells_win, counts }) {
  if (all_cells_win) return { text: 'Every cell wins', won: true };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (counts.loss > 0) return { text: `${plural(counts.loss, 'cell loses', 'cells lose')} to vLLM`, won: false };
  const open = [
    counts.open > 0 ? `${plural(counts.open, 'cell', 'cells')} not yet measured` : null,
    counts.tie > 0 ? plural(counts.tie, 'tie', 'ties') : null,
  ].filter(Boolean);
  return { text: `No losses; ${open.join(', ')}`, won: false };
}
