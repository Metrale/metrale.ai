// =============================================================================
// page-weight.spec.js — the scripts each page fetches when its app starts
// -----------------------------------------------------------------------------
// The Lighthouse gate demands 100 and serves over HTTP/1.1, six connections at a
// time, so every extra small file is a queued round trip. The app now starts
// after the first paint (src/lib/boot/defer-boot.js), and its modulepreloads
// wait in a <template> until then; the regex below still finds them there.
// Twice a change that looked free cost every page a request: forty components
// each becoming a chunk, and one `import` in the root layout leaving a 22 byte
// facade file behind. Neither failed anything. This reads the build the suite
// has just made and holds the line, in numbers, with no browser needed.
// vite.config.js explains the two named chunks these budgets depend on.
// =============================================================================
import { test, expect } from './fixtures/app.js';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BUILD = 'build';
const preloads = (page) =>
  [...readFileSync(join(BUILD, page), 'utf8').matchAll(/href="[^"]*?(_app\/immutable\/[^"]+\.js)" rel="modulepreload"/g)].map((m) => m[1]);
// A string only the marketing components contain.
const isMarketingChunk = (file) => readFileSync(join(BUILD, file), 'utf8').includes('av-tourstack');

test.describe('page weight', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'chromium', 'reads files, one run is enough'));

  test('a developer page never loads the marketing components', () => {
    for (const page of ['engine.html', 'control.html', 'diligence.html']) {
      expect(preloads(page).filter(isMarketingChunk), `${page} loads the marketing chunk`).toEqual([]);
      expect(readFileSync(join(BUILD, page), 'utf8').includes('.av-receipt'), `${page} inlines marketing CSS`).toBe(false);
    }
  });

  // The gate record set is 1.4 MB of JSON, and a script that size was the
  // longest task on any page that loaded it. /engine printed one commit and date
  // from it and /diligence a few floors; they now read the small files
  // gen-live.mjs cuts from it. The pages that chart records (/benchmarks, and the
  // dashboard /engine opens on a click) load them a benchmark at a time
  // (gate-records-module.js), after the page has started. So no page preloads
  // any, and no script carries more than one benchmark's. Only record data names
  // a record file's path under .benchmarks/, and each record names its gate.
  const RECORD = '"path":".benchmarks/';
  test("no page preloads gate records, and each benchmark's records are a script of their own", () => {
    const pages = readdirSync(BUILD, { recursive: true }).filter((f) => f.endsWith('.html'));
    expect(pages.length).toBeGreaterThan(20);
    const carrying = pages.filter((page) => preloads(page).some((file) => readFileSync(join(BUILD, file), 'utf8').includes(RECORD)));
    expect(carrying).toEqual([]);
    const scripts = readdirSync(join(BUILD, '_app'), { recursive: true }).filter((f) => f.endsWith('.js'));
    const withRecords = scripts.map((f) => readFileSync(join(BUILD, '_app', f), 'utf8')).filter((text) => text.includes(RECORD));
    expect(withRecords.length).toBeGreaterThan(5);
    for (const text of withRecords) expect(new Set(text.match(/"benchmark_id":"[^"]+"/g)).size).toBe(1);
  });

  // Measured when this was written: marketing 8 or 9, /engine 13, /control and
  // /diligence 11. One spare each. Raising a number here is a decision to make
  // every visit to that page slower, so say why in the commit.
  const BUDGET = {
    'index.html': 10,
    'why-metrale.html': 9,
    'pricing.html': 9,
    'company.html': 9,
    'engine.html': 14,
    'control.html': 12,
    'diligence.html': 12,
  };
  for (const [page, max] of Object.entries(BUDGET)) {
    test(`${page} preloads at most ${max} scripts`, () => {
      expect(preloads(page).length).toBeLessThanOrEqual(max);
    });
  }
});
