#!/usr/bin/env node
// docs/check.mjs — prove a built book before it ships.
//
// Runs over docs/build after docs/build.mjs. It fails when a page still names
// one of the engine team's hosts that docs/hosts.mjs moves, when the title or the Metrale layer is
// missing, or when something the pages need beside them is missing. A count of
// pages is printed so a build that silently lost chapters is noticed.
//
//   node docs/check.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unmoved } from './hosts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, 'build');
const fail = [];
const bad = (m) => fail.push(m);

if (!existsSync(join(OUT, 'index.html'))) {
  console.error('docs: no build. Run docs/build.mjs first.');
  process.exit(1);
}
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const pages = walk(OUT).filter((f) => f.endsWith('.html'));

for (const f of pages) {
  const hosts = unmoved(readFileSync(f, 'utf8'));
  if (hosts.length) bad(`${relative(OUT, f)} still names ${hosts.join(', ')}`);
}

const index = readFileSync(join(OUT, 'index.html'), 'utf8');
if (!index.includes('The Metrale Engine Book')) bad("the front page does not carry the book's title");
if (!index.includes('metrale.js')) bad('the front page does not load the wordmark script');
if (!index.includes('metrale.css')) bad('the front page does not load the Metrale skin');
for (const needed of [
  'llms.txt',
  '_headers',
  'og-image.png',
  'favicon.svg',
  'version.txt',
  'fonts/fonts.css',
  'fonts/urbanist-latin-wght-normal.woff2',
  'theme/css/metrale-tokens.css',
]) {
  if (!existsSync(join(OUT, needed))) bad(`${needed} is missing beside the pages`);
}
// A link the build did not resolve is shipped as the text of its path.
for (const f of ['theme/css/metrale-tokens.css', 'fonts/urbanist-latin-wght-normal.woff2']) {
  if (existsSync(join(OUT, f)) && statSync(join(OUT, f)).size < 1024) bad(`${f} is a stub, not the file it links to`);
}
// The security headers ride in _headers beside the book's cache rules.
if (existsSync(join(OUT, '_headers'))) {
  const h = readFileSync(join(OUT, '_headers'), 'utf8');
  for (const name of ['Content-Security-Policy', 'Strict-Transport-Security', 'Permissions-Policy'])
    if (!h.includes(`\n  ${name}: `)) bad(`_headers does not set ${name}`);
}
if (existsSync(join(OUT, 'llms.txt'))) {
  const llms = readFileSync(join(OUT, 'llms.txt'), 'utf8');
  if (!llms.includes('https://docs.metrale.ai')) bad('llms.txt does not name docs.metrale.ai');
  if (unmoved(llms).length) bad(`llms.txt still names ${unmoved(llms).join(', ')}`);
}

console.log(`docs: ${pages.length} pages checked`);
if (fail.length) {
  for (const m of fail) console.error(`  FAIL  ${m}`);
  process.exit(1);
}
console.log('docs: the built book reads as Metrale Engine, names the company hosts, and ships what it needs');
