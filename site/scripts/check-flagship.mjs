// SPDX-License-Identifier: AGPL-3.0-only
//
// The front page prints `<command> run <flagshipRecipe>` as its headline
// instruction. Nothing tied that name to the recipe corpus, so retiring or
// renaming a recipe in the engine's recipes/ would leave the site confidently
// advertising a command that fails on the visitor's machine — silently, and
// only for them.
//
// A standalone check run by the BUILD job, not a line inside gen-models.mjs.
// That generator's output is committed and it runs only when someone
// regenerates by hand, which is precisely not the moment a recipe gets
// retired: the guard would have missed the event it exists for.
//
// It reads the corpus CI actually ships against — recipes/ in the engine
// checkout at site/engine.ref, which the build already makes — rather than
// whatever branch a local mirror happens to be sitting on.

import { readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLI } from '../../web-shared/sources.mjs';
import { recipesRoot } from './lib/engine-root.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Required, not defaulted. A fallback to a machine-specific path meant this
// guard could validate against whatever branch a local mirror happened to sit
// on — the exact failure its own header disclaims, reached by forgetting an
// env var rather than by intent. CI sets METRALE_ENGINE_ROOT (engine-inputs);
// a human running this by hand has to say which engine checkout they mean.
let root;
try {
  root = recipesRoot();
} catch (e) {
  console.error(e.message);
  console.error('The recipes are its recipes/ directory, the corpus this site is being built against.');
  process.exit(1);
}

// Imported, not scraped. A regex over data.js has no word boundary and takes
// the first match anywhere in the file, so a comment or an `oldFlagshipRecipe`
// above it would validate the wrong name and pass — failing open, which is the
// one way a guard must never fail.
const { flagshipRecipe, runCommandRaw } = await import(pathToFileURL(resolve(here, '..', 'src', 'lib', 'data.js')).href);

/** Every `<name>.yaml` under the corpus, by stem. */
function recipeStems(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...recipeStems(p));
    else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) out.push(entry.replace(/\.ya?ml$/, ''));
  }
  return out;
}

let stems;
try {
  stems = recipeStems(root);
} catch (e) {
  console.error(`could not read the recipe corpus at ${root}: ${e.message}`);
  console.error('Set METRALE_ENGINE_ROOT to an engine checkout that has recipes/ (site/engine.ref).');
  process.exit(1);
}

if (stems.length === 0) {
  // An empty corpus would make every name "missing", which is a different
  // failure and must not be reported as a retired recipe.
  console.error(`no recipes found under ${root} — the corpus path is wrong, not the name`);
  process.exit(1);
}

const problems = [];
if (!stems.includes(flagshipRecipe)) {
  problems.push(`data.js advertises \`${CLI} run ${flagshipRecipe}\`, and no such recipe exists in the corpus.`);
}
// The pasteable command is checked too, because it is a second place the name
// can be written and the two have already drifted once. A non-string here is a
// rename or a deletion, not an opt-out — failing open on it would quietly stop
// checking the thing this clause exists for.
if (typeof runCommandRaw !== 'string') {
  problems.push('data.js no longer exports runCommandRaw as a string; this guard cannot check it.');
} else if (!runCommandRaw.includes(flagshipRecipe)) {
  problems.push(`runCommandRaw (${runCommandRaw}) does not name the flagship recipe ${flagshipRecipe}.`);
}

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error('The front page would print a command that fails.');
  process.exit(1);
}
console.log(`flagship recipe ${flagshipRecipe} is in the corpus (${stems.length} recipes)`);
