// SPDX-License-Identifier: AGPL-3.0-only

// context-grid.js — one section per model that BENCH.toml compares to vLLM:
// its gates laid out by the context they are served at, each cell its newest
// record's value beside the gate's own limit and the declared vLLM figure.
//
// Which models get a section is read from the data, never named here:
//   - a checkpoint qualifies when one of its BENCH.toml entries declares
//     `targets` (gen-gates.mjs#gate_context), the vLLM figure per metric;
//   - its rows are the entries that pin a context (`max_model_len`);
//   - it is SHOWN only once one of those gates has a record of that
//     checkpoint. Before that the section does not exist: a grid of declared
//     limits and vLLM bars with no measurement of ours beside them would read
//     as a result.
// Once it is shown, a gate with no record yet is a "no record" cell, and a
// metric another gate of the same table declares but this one does not is
// "not gated": neither is drawn as a number.
//
// The vLLM figure is the BENCH.toml `targets` value as declared. The gate's
// own limit decides pass or fail; the battles compare against this figure.
//
// A target its entry flags (`target_caveats`) carries the caveat on its cell,
// and each table carries the notes those caveats point to (target-notes.js).
// Each row carries the context of the vLLM serve behind its targets and the
// qualifier that context implies for the row (reference-serve.js).
//
// Pure: everything is passed in, so the tests can hand it any shape.

import { unitOf } from './battle-grid.js';
import { fmtLimit } from './gate-limits.js';
import { rowQualifier } from './reference-serve.js';
import { caveatNotes } from './target-notes.js';

/** The newest declaration of a bound, whatever date it took effect. */
const NEWEST = Number.MAX_SAFE_INTEGER;

const byNumericKey = (a, b) => a.localeCompare(b, 'en', { numeric: true });

/** How a metric is named in a column head. */
export function metricLabel(key) {
  const perLength = /^median_ms_(\d+)$/.exec(key);
  if (perLength) return `${perLength[1]}-token prompt`;
  const rung = /^c(\d+)_(.+)$/.exec(key);
  if (rung) return rung[2] === 'aggregate_tok_s' ? `C=${rung[1]}` : `C=${rung[1]} ${rung[2].replaceAll('_', ' ')}`;
  if (key === 'median_ms') return 'median';
  return key.replaceAll('_', ' ');
}

/** A value with its unit (battle-grid.js#unitOf). */
export const withUnit = (v, metric) => `${fmtLimit(v)}${unitOf(metric) ? ` ${unitOf(metric)}` : ''}`;

/** A limit as both grids print it: `≤ 449 ms`, `≥ 10`, or empty when unbounded. */
export const limitText = (limit, metric) =>
  [limit.max !== null ? `≤ ${withUnit(limit.max, metric)}` : null, limit.min !== null ? `≥ ${withUnit(limit.min, metric)}` : null]
    .filter(Boolean)
    .join(', ');

/**
 * How the value stands against the vLLM figure, read in the direction the
 * gate's own limit says is better: a ceiling means lower is better, a floor
 * higher. A metric with neither has no direction, and gets none.
 *
 * @returns {{pct: number, side: 'ahead'|'behind'|'level'}|null}
 */
export function againstTarget(value, target, limit) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target === 0) return null;
  const lowerIsBetter = limit.max !== null ? true : limit.min !== null ? false : null;
  if (lowerIsBetter === null) return null;
  const pct = ((value - target) / target) * 100;
  if (value === target) return { pct, side: 'level' };
  return { pct, side: value < target === lowerIsBetter ? 'ahead' : 'behind' };
}

/**
 * @param {object} input
 * @param {object} input.context   gates.generated.json#gate_context
 * @param {object} input.limits    gates.generated.json#gate_limits
 * @param {(gate: string) => object[]} input.recordsFor oldest first
 * @param {(record: object, metric: string) => {min: number|null, max: number|null}} input.limitFor
 * @param {(gate: string, checkpoint: string, metric: string, at: number) => {min: number|null, max: number|null}} input.declaredLimit
 * @param {(gate: string) => {key: string, label: string}|null} input.kindOf the
 *   table a gate belongs in (its tab and, for TTFT, its mode); null keeps it out
 * @param {(v: number, limit: object) => string|null} input.violationOf
 */
export function contextSections({ context, limits, recordsFor, limitFor, declaredLimit, kindOf, violationOf }) {
  const byCheckpoint = new Map();
  for (const [gate, perCheckpoint] of Object.entries(context ?? {})) {
    for (const [checkpoint, declared] of Object.entries(perCheckpoint)) {
      if (!byCheckpoint.has(checkpoint)) byCheckpoint.set(checkpoint, []);
      byCheckpoint.get(checkpoint).push({ gate, ...declared });
    }
  }
  const sections = [];
  for (const [checkpoint, entries] of [...byCheckpoint].sort(([a], [b]) => a.localeCompare(b))) {
    if (!entries.some((e) => Object.keys(e.targets).length > 0)) continue;
    const newest = (gate) =>
      recordsFor(gate)
        .filter((r) => r.target_model === checkpoint)
        .at(-1) ?? null;
    const sized = entries.filter((e) => e.max_model_len !== null && kindOf(e.gate) !== null).map((e) => ({ ...e, record: newest(e.gate) }));
    if (!sized.some((e) => e.record)) continue;
    const tables = new Map();
    for (const e of sized) {
      const kind = kindOf(e.gate);
      if (!tables.has(kind.key)) tables.set(kind.key, { key: kind.key, label: kind.label, entries: [] });
      tables.get(kind.key).entries.push(e);
    }
    sections.push({
      checkpoint,
      model: entries[0].model,
      tables: [...tables.values()].map((t) => tableOf(t, checkpoint, { limits, limitFor, declaredLimit, violationOf })),
    });
  }
  return sections;
}

function tableOf({ key, label, entries }, checkpoint, { limits, limitFor, declaredLimit, violationOf }) {
  const declaredMetrics = (e) => new Set([...Object.keys(limits?.[e.gate]?.[checkpoint] ?? {}), ...Object.keys(e.targets)]);
  const metrics = [...new Set(entries.flatMap((e) => [...declaredMetrics(e)]))].sort(byNumericKey);
  const rows = [...entries]
    .sort((a, b) => a.max_model_len - b.max_model_len || a.gate.localeCompare(b.gate))
    .map((e) => {
      const own = declaredMetrics(e);
      return {
        gate: e.gate,
        context: e.max_model_len,
        qualifier: rowQualifier(e.max_model_len, e.target_context ?? null),
        target_context: e.target_context ?? null,
        record: e.record,
        cells: metrics.map((metric) => {
          if (!own.has(metric)) return { metric, state: 'not-gated' };
          const target = e.targets[metric] ?? null;
          const caveat = e.caveats?.[metric] ?? null;
          const limit = e.record ? limitFor(e.record, metric) : declaredLimit(e.gate, checkpoint, metric, NEWEST);
          const raw = e.record?.metrics?.[metric];
          const value = Number.isFinite(raw) ? raw : null;
          if (!e.record) return { metric, state: 'no-record', value: null, limit, target, caveat, versus: null, violation: null };
          return {
            metric,
            state: value === null ? 'not-reported' : 'measured',
            value,
            limit,
            target,
            caveat,
            versus: againstTarget(value, target, limit),
            violation: value === null ? null : violationOf(value, limit),
          };
        }),
      };
    });
  return { key, label, metrics, rows, notes: caveatNotes(entries) };
}
