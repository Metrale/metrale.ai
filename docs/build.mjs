#!/usr/bin/env node
// =============================================================================
// docs/build.mjs — publish the engine's book at docs.metrale.ai, into docs/build
// -----------------------------------------------------------------------------
// The book lives in the engine's repository (book/ beside the crates), written
// and kept by the engine team, its Metrale skin and menu-bar wordmark included.
// This script does not change it there. It takes the checkout the site already
// pins (METRALE_ENGINE_ROOT, the same variable the site's generators read),
// copies the book into docs/.book and makes two changes:
//
//   1. the links: the book links its tokens, its fonts and their licences to
//      files outside book/ (web-shared/ and site/static/fonts/ in the engine's
//      repository), which a checkout of book/ alone does not have. This
//      repository keeps the same files at the same paths, so each link is
//      replaced by the file it names, from here
//   2. the hosts: docs/hosts.mjs moves the engine team's hosts to the company's,
//      so the canonical addresses and llms.txt name docs.metrale.ai
//
// Then mdBook builds it, the book's own scripts add llms.txt and the per-page
// social metadata, and the icons, the card, the Pages headers and a version
// stamp are copied in. docs/check.mjs proves the result before it ships.
//
//   METRALE_ENGINE_ROOT=../metrale-inference-alpha node docs/build.mjs   # needs mdbook on PATH
//   MDBOOK=/path/to/mdbook node docs/build.mjs                           # or name the binary
// =============================================================================

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rehost } from './hosts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const ENGINE = resolve(process.env.METRALE_ENGINE_ROOT || join(repo, '..', 'metrale-inference-alpha'));
const BOOK = join(ENGINE, 'book');
const WORK = join(here, '.book');
const OUT = join(here, 'build');
const MDBOOK = process.env.MDBOOK || 'mdbook';

const die = (msg) => {
  console.error(`docs: ${msg}`);
  process.exit(1);
};
if (!existsSync(join(BOOK, 'book.toml'))) die(`no book at ${BOOK}. Point METRALE_ENGINE_ROOT at a checkout of the engine that has book/.`);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const rewrite = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));

// ---- a fresh copy of the book ------------------------------------------------------
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
for (const entry of ['book.toml', 'src', 'theme', 'scripts-gen-llms.mjs', 'scripts-inject-meta.mjs']) {
  if (!existsSync(join(BOOK, entry))) die(`the book has no ${entry}; the layout this script expects has changed`);
  // Links are copied as links, so step 1 can read where each one points.
  cpSync(join(BOOK, entry), join(WORK, entry), { recursive: true, dereference: false });
}

// ---- 1. the links ----------------------------------------------------------------------
// A link is a symlink, or, in a checkout made without symlink support, a small
// text file holding the path the link points to.
const linkTarget = (file) => {
  const st = lstatSync(file);
  if (st.isSymbolicLink()) return readlinkSync(file);
  if (st.size > 200) return null;
  const text = readFileSync(file, 'utf8').trim();
  return /^(?:\.\.\/)+[\w./-]+$/.test(text) ? text : null;
};
let links = 0;
for (const file of walk(join(WORK, 'theme'))) {
  const target = linkTarget(file);
  if (!target) continue;
  const inBook = relative(WORK, file);
  const inEngine = relative(ENGINE, resolve(BOOK, dirname(inBook), target));
  const ours = join(repo, inEngine);
  if (inEngine.startsWith('..') || !existsSync(ours)) die(`the book links ${inBook} to ${inEngine.split(sep).join('/')}, which this repository does not have`);
  rmSync(file, { force: true });
  copyFileSync(ours, file);
  links++;
}
if (!links) die('the book links nothing outside book/; look at theme/ before building, the tokens and the fonts may have moved');

// ---- 2. the hosts ------------------------------------------------------------------------
let moved = 0;
for (const file of walk(WORK)) {
  if (!/\.(md|hbs|mjs|js|toml|css|html|txt)$/.test(file)) continue;
  const before = readFileSync(file, 'utf8');
  const after = rehost(before);
  if (after !== before) {
    writeFileSync(file, after);
    moved++;
  }
}

// ---- build ------------------------------------------------------------------------------
execFileSync(process.execPath, [join(WORK, 'scripts-gen-llms.mjs')], { stdio: 'inherit' });
try {
  execFileSync(MDBOOK, ['build', WORK], { stdio: 'inherit' });
} catch {
  die(`mdbook failed or is not installed (looked for "${MDBOOK}"; the workflow pins 0.4.40)`);
}
execFileSync(process.execPath, [join(WORK, 'scripts-inject-meta.mjs'), join(WORK, 'output')], { stdio: 'inherit' });

// ---- what ships beside the pages -------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
cpSync(join(WORK, 'output'), OUT, { recursive: true });
const STATIC = join(repo, 'site', 'static');
for (const icon of ['favicon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png', 'og-image.png']) {
  if (existsSync(join(STATIC, icon))) copyFileSync(join(STATIC, icon), join(OUT, icon));
}
const headers = join(BOOK, 'deploy', 'cloudflare', '_headers');
if (existsSync(headers)) copyFileSync(headers, join(OUT, '_headers'));
const sha = (dir) => {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};
writeFileSync(join(OUT, 'version.txt'), `engine ${sha(ENGINE)}\nsite ${sha(repo)}\n`);

const html = walk(OUT).filter((f) => f.endsWith('.html')).length;
console.log(
  `docs: ${links} links resolved, ${moved} files rehosted, ${html} pages built into ${OUT} (${(statSize(OUT) / 1024 / 1024).toFixed(1)} MB)`
);

function statSize(dir) {
  return walk(dir).reduce((n, f) => n + statSync(f).size, 0);
}
