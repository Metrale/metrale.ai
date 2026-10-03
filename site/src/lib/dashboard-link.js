// SPDX-License-Identifier: AGPL-3.0-only
//
// dashboard-link.js — the benchmark dashboard's deep link.
//
//   /#bench=concurrency&subject=qwen36-35b-a3b&c=64
//   /#bench=ttft-long&stat=p90
//   /#bench=bfcl&hw=gb10&model=Qwen%2FQwen3.6-35B-A3B-FP8
//
// A hash, not a query string: the page is prerendered and touching
// `url.searchParams` during prerender is a build error, while the hash never
// reaches the prerenderer (the deck made the same call). This module is pure —
// the component reads `location` and writes with `$app/navigation` — and it
// never throws on the hash, because a pasted URL is untrusted input. What is
// valid (tab ids, subject ids, rungs) is passed in, so the resolution rules are
// testable without the generated data and a stale hash cannot pick a tab or
// subject that no longer exists. `stat` is the TTFT tabs' Median | p90 choice;
// its own key rather than `subject`, which names a model on the other tabs.
// `hw` and `model` are the dashboard's scope (dashboard-scope.js): resolved
// here only to "one of the known values, or not given", because the default
// (the flagship, or the model a pasted `subject` names) is the scope module's.

export const RUNG_ALL = 'all';

const KEY = { tab: 'bench', subject: 'subject', rung: 'c', stat: 'stat', hw: 'hw', model: 'model' };
const KNOWN_LISTS = ['tabIds', 'subjectIds', 'rungs', 'stats'];

/** An unknown or missing tab is "not a deep link" — the dashboard opens as it would from a click. */
export function resolveTab(raw, tabIds) {
  return tabIds.includes(raw) ? raw : null;
}

/** An unknown or missing subject lands on the first subject; `null` only when there are none. */
export function resolveSubject(raw, subjectIds) {
  if (subjectIds.includes(raw)) return raw;
  return subjectIds.length > 0 ? subjectIds[0] : null;
}

/**
 * `all` or one of the declared rungs, else `all`. The match is on the exact
 * decimal spelling so `064`, ` 64` and `64.0` do not sneak in as C=64.
 */
export function resolveRung(raw, rungs) {
  if (raw === RUNG_ALL) return RUNG_ALL;
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return RUNG_ALL;
  const c = Number(raw);
  return rungs.includes(c) ? c : RUNG_ALL;
}

/** One of the declared statistics, else the first (the median). `null` only when none are declared. */
export function resolveStat(raw, stats) {
  if (stats.includes(raw)) return raw;
  return stats.length > 0 ? stats[0] : null;
}

// Optional, so a caller with no scope (a test of the tab rules) need not invent one.
const OPTIONAL_LISTS = ['modelIds', 'hwClasses'];

function assertKnown(known) {
  for (const k of KNOWN_LISTS) {
    if (!Array.isArray(known?.[k])) throw new Error(`dashboard-link: known.${k} must be an array`);
  }
  for (const k of OPTIONAL_LISTS) {
    if (known[k] !== undefined && !Array.isArray(known[k])) throw new Error(`dashboard-link: known.${k} must be an array when given`);
  }
}

/** One of the known values, else `null` (not given, or not one this build knows). */
const known1 = (raw, list) => ((list ?? []).includes(raw) ? raw : null);

/**
 * @param {unknown} hash `location.hash`, with or without its leading `#`
 * @param {{tabIds:string[], subjectIds:string[], rungs:number[], stats:string[]}} known
 * @returns {{tab:string|null, subject:string|null, subjectGiven:boolean, c:string|number, stat:string|null, hw:string|null, model:string|null}}
 */
export function parseDashboardHash(hash, known) {
  assertKnown(known);
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  return {
    tab: resolveTab(params.get(KEY.tab), known.tabIds),
    subject: resolveSubject(params.get(KEY.subject), known.subjectIds),
    // Whether the link itself named a known subject: a link from before the
    // model select carries a subject and no model, and the subject decides it.
    subjectGiven: known.subjectIds.includes(params.get(KEY.subject)),
    c: resolveRung(params.get(KEY.rung), known.rungs),
    stat: resolveStat(params.get(KEY.stat), known.stats),
    hw: known1(params.get(KEY.hw), known.hwClasses),
    model: known1(params.get(KEY.model), known.modelIds),
  };
}

export const isDeepLink = (link) => link.tab !== null;

/**
 * The hash for a dashboard state, without the `#`. No tab means no dashboard
 * to link to, so the result is empty; subject and rung are written only when
 * given, so a TTFT link does not carry a concurrency subject, and `stat` only on
 * a TTFT tab. `hw` and `model` follow the tab when given.
 */
export function formatDashboardHash({ tab, subject = null, c = null, stat = null, hw = null, model = null }) {
  if (tab === null || tab === undefined) return '';
  const params = new URLSearchParams();
  params.set(KEY.tab, tab);
  if (hw !== null && hw !== undefined) params.set(KEY.hw, hw);
  if (model !== null && model !== undefined) params.set(KEY.model, model);
  if (subject !== null && subject !== undefined) params.set(KEY.subject, subject);
  if (c !== null && c !== undefined) params.set(KEY.rung, String(c));
  if (stat !== null && stat !== undefined) params.set(KEY.stat, stat);
  return params.toString();
}
