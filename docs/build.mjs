#!/usr/bin/env node
// =============================================================================
// docs/build.mjs — publish the engine's book as Metrale's, into docs/build
// -----------------------------------------------------------------------------
// The book lives in the engine's repository (book/ beside the crates), written
// and kept by the engine team. This script does not change it there. It takes
// the checkout the site already pins (AVAROK_ENGINE_ROOT, the same variable the
// site's generators read), copies the book into docs/.book, and lays Metrale
// over it in four moves:
//
//   1. the tokens: this repository's web-shared/avarok-tokens.css replaces the
//      copy the book links, so the docs, the site and the blog share one palette
//   2. the type: the site's Urbanist and IBM Plex Mono, self hosted, in place of
//      the system stacks the book falls back to
//   3. the layer: docs/theme/metrale.css and metrale.js, which put the lockup in
//      the menu bar; nothing in the book's own skin is edited
//   4. the words: docs/rebrand.mjs renames what a reader sees, and nothing else
//
// Then mdBook builds it, the book's own scripts add llms.txt and the per-page
// social metadata, and the icons, the card, the Pages headers and a version
// stamp are copied in. docs/check.mjs proves the result before it ships.
//
//   AVAROK_ENGINE_ROOT=../atlas node docs/build.mjs     # needs mdbook on PATH
//   MDBOOK=/path/to/mdbook node docs/build.mjs           # or name the binary
// =============================================================================

import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebrand } from './rebrand.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const ENGINE = resolve(process.env.AVAROK_ENGINE_ROOT || join(repo, '..', 'atlas'));
const BOOK = join(ENGINE, 'book');
const WORK = join(here, '.book');
const OUT = join(here, 'build');
const MDBOOK = process.env.MDBOOK || 'mdbook';

const die = (msg) => {
  console.error(`docs: ${msg}`);
  process.exit(1);
};
if (!existsSync(join(BOOK, 'book.toml'))) die(`no book at ${BOOK}. Point AVAROK_ENGINE_ROOT at a checkout of the engine that has book/.`);

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const rewrite = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));

// ---- 1. a fresh copy of the book -------------------------------------------
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
for (const entry of ['book.toml', 'src', 'theme', 'scripts-gen-llms.mjs', 'scripts-inject-meta.mjs']) {
  if (!existsSync(join(BOOK, entry))) die(`the book has no ${entry}; the layout this script expects has changed`);
  cpSync(join(BOOK, entry), join(WORK, entry), {
    recursive: true,
    dereference: true,
  });
}

// ---- the tokens ---------------------------------------------------------------
copyFileSync(join(repo, 'web-shared', 'avarok-tokens.css'), join(WORK, 'theme', 'css', 'avarok-tokens.css'));

// ---- 2. the type ------------------------------------------------------------------
const FONTS = join(repo, 'site', 'static', 'fonts');
const faces = [
  ['urbanist-latin-wght-normal.woff2', "font-family: 'Urbanist'; font-style: normal; font-weight: 100 900"],
  ['urbanist-latin-wght-italic.woff2', "font-family: 'Urbanist'; font-style: italic; font-weight: 100 900"],
  ['ibm-plex-mono-latin-400-normal.woff2', "font-family: 'IBM Plex Mono'; font-style: normal; font-weight: 400"],
  ['ibm-plex-mono-latin-600-normal.woff2', "font-family: 'IBM Plex Mono'; font-style: normal; font-weight: 600"],
];
mkdirSync(join(WORK, 'theme', 'fonts'), { recursive: true });
const fontCss = ["/* The site's faces, self hosted beside the pages. Written by docs/build.mjs. */"];
for (const [file, decl] of faces) {
  if (!existsSync(join(FONTS, file))) die(`missing font ${file} under site/static/fonts`);
  copyFileSync(join(FONTS, file), join(WORK, 'theme', 'fonts', file));
  fontCss.push(`@font-face { ${decl}; font-display: swap; src: url('${file}') format('woff2'); }`);
}
writeFileSync(join(WORK, 'theme', 'fonts', 'fonts.css'), fontCss.join('\n') + '\n');

// ---- 3. the layer ------------------------------------------------------------------
copyFileSync(join(here, 'theme', 'metrale.css'), join(WORK, 'theme', 'css', 'metrale.css'));
const wordmark = readFileSync(join(repo, 'assets', 'brand', 'svg', 'wordmark-ondark.svg'), 'utf8')
  .replace(/<\?xml[^>]*>\s*/, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .trim();
writeFileSync(
  join(WORK, 'theme', 'metrale.js'),
  readFileSync(join(here, 'theme', 'metrale.js'), 'utf8').replaceAll('__WORDMARK__', JSON.stringify(wordmark))
);

rewrite(join(WORK, 'book.toml'), (t) => {
  const line = 'additional-css = ["theme/css/avarok-tokens.css", "theme/css/avarok.css"]';
  if (!t.includes(line)) die('book.toml no longer lists the two stylesheets this script layers on; look at it before building');
  return rebrand(t.replace(line, `${line.slice(0, -1)}, "theme/css/metrale.css"]\nadditional-js = ["theme/metrale.js"]`));
});

// ---- 4. the words ------------------------------------------------------------------
let pages = 0;
for (const f of walk(join(WORK, 'src'))) {
  if (!f.endsWith('.md')) continue;
  rewrite(f, rebrand);
  pages++;
}
// The company, where the book names it as the publisher, is Metrale, not the engine.
rewrite(join(WORK, 'theme', 'head.hbs'), (t) => rebrand(t.replace('content="Atlas Inference"', 'content="Metrale"')));
rewrite(join(WORK, 'scripts-inject-meta.mjs'), (t) => rebrand(t.replace("name: 'Atlas Inference'", "name: 'Metrale'")));
rewrite(join(WORK, 'scripts-gen-llms.mjs'), rebrand);

// ---- build ------------------------------------------------------------------------
execFileSync(process.execPath, [join(WORK, 'scripts-gen-llms.mjs')], {
  stdio: 'inherit',
});
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
    return execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
};
writeFileSync(join(OUT, 'version.txt'), `engine ${sha(ENGINE)}\nsite ${sha(repo)}\n`);

const html = walk(OUT).filter((f) => f.endsWith('.html')).length;
console.log(`docs: ${pages} chapters renamed, ${html} pages built into ${OUT} (${(statSize(OUT) / 1024 / 1024).toFixed(1)} MB)`);

function statSize(dir) {
  return walk(dir).reduce((n, f) => n + statSync(f).size, 0);
}
