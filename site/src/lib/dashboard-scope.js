// SPDX-License-Identifier: AGPL-3.0-only
//
// dashboard-scope.js — what the benchmark dashboard shows: one hardware class
// and one model (or every model) at a time.
//
// With every model's certifications on one screen the charts crowd, so the
// dashboard's header carries two selects: the hardware class and the model.
// Both lists are read from the published records, never typed: a class or a
// model appears only when at least one gate record carries it, and a model
// appears under a class only when it has a record on that class. GB10 is the
// only class with records today, so its select holds one option.
//
// The default model is the flagship: the model of `flagshipRecipe` in
// data.js, looked up in the generated model list (the same lookup
// GetRunning makes), so changing the flagship recipe moves the default too.
//
// Pure and dependency-free apart from the class reader, so the rules are
// tested on inputs the call site produces.
import { hardwareClass } from './repro-steps.js';

/** The select value that keeps every model in scope. */
export const ALL_MODELS = 'all';

/**
 * The hardware class of a record (`gb10` from `perf_class: "gb10@spark-28c2"`),
 * or `null` when the record carries none. A record without a class is never
 * shown under a class it did not name.
 */
export const classOf = (record) => hardwareClass(record);

/**
 * Hardware classes with records, and per class the models with records on it,
 * counting only the benches the dashboard draws (`benchIds`, every tab's
 * benches): a model whose only records are on a bench with no tab would open
 * an empty dashboard.
 * @param {Record<string, {records: object[]}>} benchmarks gates.generated.json `benchmarks`
 * @param {string[]} benchIds
 * @returns {{classes: string[], modelsByClass: Record<string, string[]>}}
 */
export function scopeOptions(benchmarks, benchIds) {
  const byClass = new Map();
  for (const id of new Set(benchIds)) {
    for (const r of benchmarks?.[id]?.records ?? []) {
      const cls = classOf(r);
      if (cls === null || typeof r.target_model !== 'string' || r.target_model === '') continue;
      if (!byClass.has(cls)) byClass.set(cls, new Set());
      byClass.get(cls).add(r.target_model);
    }
  }
  const classes = [...byClass.keys()].sort();
  return { classes, modelsByClass: Object.fromEntries(classes.map((c) => [c, [...byClass.get(c)].sort()])) };
}

/**
 * The flagship model: the checkpoint the flagship recipe serves.
 * @param {Array<{subfamilies: Array<{recipes: Array<{recipeId: string, hfId: string}>}>}>} vendors models.generated.json
 * @param {string} recipeId data.js `flagshipRecipe`
 */
export function flagshipModelOf(vendors, recipeId) {
  const r = vendors.flatMap((v) => v.subfamilies.flatMap((f) => f.recipes)).find((x) => x.recipeId === recipeId);
  if (!r) throw new Error(`dashboard-scope: flagship recipe ${recipeId} is not in models.generated.json`);
  return r.hfId;
}

/**
 * Resolve a requested scope against the options. An unknown or missing class
 * lands on the first class; an unknown or missing model lands on the fallback
 * (the flagship) when it has records on that class, else on every model.
 * @returns {{hw: string|null, model: string}}
 */
export function resolveScope({ hw, model }, options, fallbackModel) {
  const cls = options.classes.includes(hw) ? hw : (options.classes[0] ?? null);
  const inClass = cls === null ? [] : options.modelsByClass[cls];
  if (model === ALL_MODELS || inClass.includes(model)) return { hw: cls, model };
  return { hw: cls, model: inClass.includes(fallbackModel) ? fallbackModel : ALL_MODELS };
}

/** Whether a record is in scope. */
export function inScope(record, { hw, model }) {
  return classOf(record) === hw && (model === ALL_MODELS || record.target_model === model);
}

/**
 * `recordsFor` narrowed to the scope, for the components that take one.
 * @param {(benchId: string) => object[]} recordsFor
 */
export const scopedRecordsFor = (recordsFor, scope) => (benchId) => recordsFor(benchId).filter((r) => inScope(r, scope));

/**
 * The concurrency subjects of the model in scope; every subject for all models.
 * A subject of that model keeps its tab when it has no record, as the
 * Concurrency tab always has (its "not yet measured" state).
 */
export const subjectsInScope = (subjects, { model }) => (model === ALL_MODELS ? subjects : subjects.filter((s) => s.checkpoint === model));

/**
 * The tabs that have something in scope. A subject tab (Concurrency, Cost)
 * needs a subject of the model; any other tab needs a record.
 * @param {Array<{id: string, benches: string[]}>} tabs
 * @param {string[]} subjectTabIds
 */
export function tabsInScope(tabs, scope, { recordsFor, subjects, subjectTabIds }) {
  const scoped = scopedRecordsFor(recordsFor, scope);
  const hasSubject = subjectsInScope(subjects, scope).length > 0;
  return tabs.filter((t) => (subjectTabIds.includes(t.id) ? hasSubject : t.benches.some((b) => scoped(b).length > 0)));
}
