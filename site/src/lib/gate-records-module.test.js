// SPDX-License-Identifier: AGPL-3.0-only
//
// The browser's copy of the gate record set (gate-records-module.js) must read
// exactly like gates.generated.json once loaded, must load a benchmark's
// records only when asked, and must refuse a read of records not yet loaded.
// Checked against the committed file, and gate-meta.generated.json, which the
// tabs come from, against the same file.
import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateBenchRecordsModule, gateRecordsModule } from './gate-records-module.js';

const JSON_TEXT = readFileSync(new URL('./gates.generated.json', import.meta.url), 'utf8');
const META = JSON.parse(readFileSync(new URL('./gate-meta.generated.json', import.meta.url), 'utf8'));
const IDS = Object.keys(JSON.parse(JSON_TEXT).benchmarks);
const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Write the main module and one module per benchmark, as the build would serve them, and import the main one. */
async function build(text) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-records-'));
  dirs.push(dir);
  const fetched = [];
  for (const id of IDS)
    writeFileSync(join(dir, `${id}.mjs`), `globalThis.__fetched.push(${JSON.stringify(id)});\n${gateBenchRecordsModule(text, id)}`);
  globalThis.__fetched = fetched;
  writeFileSync(
    join(dir, 'gates.mjs'),
    gateRecordsModule(text, (id) => `./${id}.mjs`)
  );
  const { default: data } = await import(join(dir, 'gates.mjs'));
  return { data, fetched };
}

test('once every benchmark is loaded, the module reads exactly like the JSON file', async () => {
  const { data } = await build(JSON_TEXT);
  await data.loadRecords(IDS);
  expect(data).toEqual(JSON.parse(JSON_TEXT));
});

test('a benchmark is fetched only when asked for, once, and the others stay unread', async () => {
  const { data, fetched } = await build(JSON_TEXT);
  expect(fetched).toEqual([]);
  expect(() => data.benchmarks['agentic-webserver'].records).toThrow(/read before they were loaded/);
  await data.loadRecords(['agentic-webserver', 'no-such-gate']);
  await data.loadRecords(['agentic-webserver']);
  expect(fetched).toEqual(['agentic-webserver']);
  expect(data.benchmarks['agentic-webserver'].records).toEqual(JSON.parse(JSON_TEXT).benchmarks['agentic-webserver'].records);
  expect(() => data.benchmarks['bfcl-subset'].records).toThrow(/read before they were loaded/);
});

test('a record set without its records array stops the build', () => {
  const bad = JSON.stringify({ benchmarks: { x: { name: 'x' } } });
  expect(() => gateRecordsModule(bad, (id) => id)).toThrow(/benchmark x has no records array/);
  expect(() => gateBenchRecordsModule(bad, 'x')).toThrow(/benchmark x has no records array/);
  expect(() => gateRecordsModule(JSON.stringify({ registered: [] }), (id) => id)).toThrow(/no benchmarks/);
});

test('the tabs and models gates.js reads from gate-meta match the records they are cut from', () => {
  const gates = JSON.parse(JSON_TEXT);
  const recorded = Object.entries(gates.benchmarks)
    .filter(([, b]) => b.records.length > 0)
    .map(([id]) => id);
  expect([...META.recorded].sort()).toEqual(recorded.sort());
  const models = [...new Set(Object.values(gates.benchmarks).flatMap((b) => b.records.map((r) => r.target_model)))].sort();
  expect(META.models).toEqual(models);
});
