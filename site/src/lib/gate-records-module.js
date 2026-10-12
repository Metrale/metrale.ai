// SPDX-License-Identifier: AGPL-3.0-only
//
// gates.generated.json as the browser loads it: every benchmark's records in a
// script of their own, fetched when a page asks for that benchmark.
//
// The record set is 1.4 MB across seventeen benchmarks, and /benchmarks opens
// on one family of them. Imported whole, the set was one 1.4 MB script that
// had to be compiled and run before the page could start, and on the mobile
// run that was the longest task on the page. Built through this, the page
// loads the family it shows (benchmarks/+page.js) and each other family when
// its tab is reached for, and the /engine dashboard loads them all when it is
// opened.
//
// The module reads like the JSON: `benchmarks[id].records` is the same array.
// Reading it before it has been loaded is a mistake in the page, and throws
// rather than passing an empty list off as "no records". gates.js's
// loadRecords() loads; outside the browser build the JSON already holds every
// record and loadRecords has nothing to do.
//
// vite.config.js serves these modules to the browser build only. The server
// build, the generators and the unit tests read the JSON itself.

/**
 * The record set without its records, and a loader for each benchmark's.
 * @param {string} json the text of gates.generated.json
 * @param {(benchId: string) => string} specifierOf the import specifier of one benchmark's records module
 * @returns {string} an ES module whose default export is the record set
 */
export function gateRecordsModule(json, specifierOf) {
  const data = JSON.parse(json);
  if (!data.benchmarks || typeof data.benchmarks !== 'object') throw new Error('gates.generated.json has no benchmarks');
  const loaders = [];
  for (const [id, bench] of Object.entries(data.benchmarks)) {
    if (!Array.isArray(bench.records)) throw new Error(`gates.generated.json: benchmark ${id} has no records array`);
    delete bench.records;
    loaders.push(`  ${JSON.stringify(id)}: () => import(${JSON.stringify(specifierOf(id))}),`);
  }
  return `const data = JSON.parse(${JSON.stringify(JSON.stringify(data))});
const loaders = {
${loaders.join('\n')}
};
const loaded = new Map();
for (const id of Object.keys(loaders)) {
  Object.defineProperty(data.benchmarks[id], 'records', {
    enumerable: true,
    get() {
      if (!loaded.has(id)) throw new Error(\`the records of \${id} are read before they were loaded: await loadRecords from gates.js first\`);
      return loaded.get(id);
    },
  });
}
// Loads the named benchmarks' records. Names with no records (a family wired
// ahead of its data) are skipped, as the JSON would simply have none.
Object.defineProperty(data, 'loadRecords', {
  value: (ids) =>
    Promise.all(
      ids
        .filter((id) => loaders[id] && !loaded.has(id))
        .map((id) => loaders[id]().then((m) => void loaded.set(id, m.default)))
    ),
});
export default data;
`;
}

/**
 * One benchmark's records.
 * @param {string} json the text of gates.generated.json
 * @param {string} benchId
 * @returns {string} an ES module whose default export is that benchmark's records array
 */
export function gateBenchRecordsModule(json, benchId) {
  const records = JSON.parse(json).benchmarks?.[benchId]?.records;
  if (!Array.isArray(records)) throw new Error(`gates.generated.json: benchmark ${benchId} has no records array`);
  return `export default JSON.parse(${JSON.stringify(JSON.stringify(records))});\n`;
}
