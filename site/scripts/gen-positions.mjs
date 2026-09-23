#!/usr/bin/env node
// =============================================================================
// gen-positions.mjs — generate src/lib/positions.generated.json from the roles
// -----------------------------------------------------------------------------
// SSOT: src/lib/content/positions.jsonl, one role per line. The rules for a
// line live in src/lib/content/positions.js (parsePositions), shared with the
// unit test that reads the same file.
//
// This generator is STRUCTURAL: a bad line is a nonzero exit and a failed
// build, because the alternative is a careers page that quietly lost a role.
//
// Regenerate with:   node site/scripts/gen-positions.mjs
//
// Output: { positions: [ { id, title, team, location, status, summary, does,
//           requirements } ] }, in file order, nothing added. No date stamp,
//           so the file only changes when a role does.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePositions } from '../src/lib/content/positions.js';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '..', 'src', 'lib', 'content', 'positions.jsonl');
const OUT = resolve(here, '..', 'src', 'lib', 'positions.generated.json');

let positions;
try {
  positions = parsePositions(readFileSync(SRC, 'utf8'));
} catch (e) {
  console.error(`gen-positions: ${e.message}`);
  process.exit(1);
}

const next = JSON.stringify({ positions }, null, 2) + '\n';
let prev = null;
try {
  prev = readFileSync(OUT, 'utf8');
} catch {
  /* first run */
}
if (prev !== next) writeFileSync(OUT, next);
console.log(`gen-positions: ${positions.length} role${positions.length === 1 ? '' : 's'}${prev === next ? ' (unchanged)' : ''}`);
