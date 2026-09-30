#!/usr/bin/env node
// =============================================================================
// gen-ttft-baselines.mjs — generate src/lib/ttft-baselines.generated.json
// -----------------------------------------------------------------------------
// SSOT: the engine's `bench/baselines/<subject>/ttft/published.json`, one per
//   subject, each naming the raw vLLM records and one-shot lines behind every
//   figure. lib/ttft-baselines-build.mjs recomputes each figure from those
//   files and checks it against the manifest; nothing is transcribed.
//
// Beside the baselines it writes the ENGINE side of the TTFT instrument, read
//   from the same checkout: the osl the TTFT request asks for (ttft.rs) and
//   the sha256 of each committed prompt fixture (ttft/prompts/*.txt). A gate
//   record names its prompt (`params.prompt: "long-32k"`) but not its bytes;
//   the fixture's hash is what lets src/lib/ttft-baselines.js say that vLLM
//   and the engine were sent the same prompt, or refuse to draw them together.
//
// A missing manifest directory is not an error here: a subject with no vLLM
//   TTFT baseline renders an explicit "not measured" state on the page. A
//   manifest that fails a guard IS: a silently dropped baseline would read as
//   "not measured" when it was measured and broken.
//
// Regenerate with:   node site/scripts/gen-ttft-baselines.mjs
// No third-party deps: Node builtins only.
// =============================================================================

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeStable } from './lib/write-stable.mjs';
import { engineRoot } from './lib/engine-root.mjs';
import { buildTtftBaselines, engineInstrument } from './lib/ttft-baselines-build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = engineRoot();
const OUT = resolve(here, '..', 'src', 'lib', 'ttft-baselines.generated.json');
const BASELINES = resolve(REPO, 'bench', 'baselines');
const TTFT_SRC = resolve(REPO, 'crates', 'bench', 'src', 'benchmarks', 'ttft.rs');
const PROMPTS = resolve(REPO, 'crates', 'bench', 'src', 'benchmarks', 'ttft', 'prompts');

const die = (msg) => {
  console.error(`gen-ttft-baselines: ${msg}`);
  process.exit(1);
};
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

let engine;
try {
  const fixtures = Object.fromEntries(
    readdirSync(PROMPTS)
      .filter((f) => f.endsWith('.txt'))
      .sort()
      .map((f) => [f.slice(0, -4), sha256(join(PROMPTS, f))])
  );
  engine = engineInstrument({ ttftSource: readFileSync(TTFT_SRC, 'utf8'), fixtures });
} catch (err) {
  die(err.message.replace(/^gen-ttft-baselines: /, ''));
}

const manifests = [];
for (const subject of readdirSync(BASELINES).sort()) {
  const path = join(BASELINES, subject, 'ttft', 'published.json');
  if (!existsSync(path)) continue;
  const dir = dirname(path);
  const rel = relative(REPO, path);
  try {
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    manifests.push(
      buildTtftBaselines(manifest, {
        path: rel,
        rawOf: (f) => JSON.parse(readFileSync(join(dir, f), 'utf8')),
        textOf: (f) => readFileSync(join(dir, f), 'utf8'),
        sha256Of: (f) => sha256(join(dir, f)),
      })
    );
  } catch (err) {
    die(err.message.replace(/^gen-ttft-baselines: /, ''));
  }
}

const generated_utc = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
writeStable(OUT, { generated_utc, engine, manifests }, ['generated_utc'], (o) => `${JSON.stringify(o, null, 2)}\n`);
for (const m of manifests) {
  console.log(`gen-ttft-baselines: ${m.checkpoint}: ${m.baselines.map((b) => `${b.gate} (${b.method})`).join(', ')}`);
}
console.log(`gen-ttft-baselines: -> ${OUT} (${manifests.length} manifests, osl ${engine.osl})`);
