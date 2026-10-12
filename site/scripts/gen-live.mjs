#!/usr/bin/env node
// =============================================================================
// gen-live.mjs — the few counts the marketing pages print, in a file they can
// afford to load
// -----------------------------------------------------------------------------
// The marketing pages print two counts that come from large generated files:
//   how many concurrency gate records passed   (gates.generated.json, 1 MB)
//   how many model recipes the engine ships    (models.generated.json)
//
// Importing gates.generated.json to read one integer put a 1 MB chunk on the
// front page and eleven others. This writes the integers to
// src/lib/live.generated.json instead, a few hundred bytes, and
// src/lib/content/live.js reads that. The numbers are still generated, never
// typed, and still come from the same sources as the developer pages.
//
// It also writes src/lib/gate-meta.generated.json: the gate record set's
// registered ids and declared limits without the records themselves, about
// 12 KB. /diligence prints floors and gate names from those, and importing the
// whole record set to read them cost the page 1.4 MB of script to parse before
// it could respond.
//
// Runs after gen-gates.mjs and gen-models.mjs (vite.config.js, package.json).
// Hard-fails on a missing or empty source, because a silently zero count on
// the front page looks like a fact.
//
// Regenerate with:   node site/scripts/gen-live.mjs
// No third-party deps: Node builtins only.
// =============================================================================

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, '..', 'src', 'lib');
const read = (name) => {
  const p = resolve(lib, name);
  if (!existsSync(p)) throw new Error(`gen-live: ${p} is missing, run its generator first`);
  return JSON.parse(readFileSync(p, 'utf8'));
};

const gates = read('gates.generated.json');
const models = read('models.generated.json');

const concurrency = Object.entries(gates.benchmarks ?? {})
  .filter(([id]) => id.startsWith('concurrency'))
  .flatMap(([, b]) => b.records ?? []);
if (concurrency.length === 0) throw new Error('gen-live: gates.generated.json holds no concurrency gate records');

// The signed gate records, counted for the release-gate receipt on /engine.
const all = Object.values(gates.benchmarks ?? {}).flatMap((b) => b.records ?? []);
const newest = all.reduce((t, r) => Math.max(t, r.recorded_at ?? 0), 0);

const recipes = models.reduce((n, v) => n + v.subfamilies.reduce((m, f) => m + f.recipes.length, 0), 0);
if (recipes === 0) throw new Error('gen-live: models.generated.json produced no recipes');

const out = {
  gates: {
    sha: gates.generated_sha,
    date: gates.generated_date,
    registered: gates.registered?.length ?? 0,
    concurrencyRecords: concurrency.length,
    concurrencyPass: concurrency.filter((r) => r.verdict === 'PASS').length,
    records: all.length,
    signed: all.filter((r) => r.signer).length,
    withRecords: Object.values(gates.benchmarks ?? {}).filter((b) => (b.records ?? []).length > 0).length,
    newest: newest ? new Date(newest * 1000).toISOString().slice(0, 10) : null,
  },
  recipes,
};

if (!Array.isArray(gates.registered) || gates.registered.length === 0) throw new Error('gen-live: gates.generated.json registers no gate');
if (!gates.gate_limits) throw new Error('gen-live: gates.generated.json has no gate_limits, run gen-gates.mjs');
const meta = { registered: gates.registered, gate_limits: gates.gate_limits };

/** Write `value` to src/lib/<name> unless it already holds exactly that. */
function write(name, value, summary) {
  const target = resolve(lib, name);
  const text = JSON.stringify(value, null, 2) + '\n';
  if (existsSync(target) && readFileSync(target, 'utf8').replace(/\r\n/g, '\n') === text) {
    console.log(`gen-live: ${target} unchanged (${summary})`);
  } else {
    writeFileSync(target, text);
    console.log(`gen-live: wrote ${target} (${summary})`);
  }
}

write('live.generated.json', out, `${out.gates.concurrencyPass}/${out.gates.concurrencyRecords} concurrency gates, ${recipes} recipes`);
write('gate-meta.generated.json', meta, `${meta.registered.length} gates registered, ${Object.keys(meta.gate_limits).length} with limits`);
